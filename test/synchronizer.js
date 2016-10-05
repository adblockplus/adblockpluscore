/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-2016 Eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

let {
  createSandbox, setupTimerAndXMLHttp, setupRandomResult, unexpectedError, Cr,
  MILLIS_IN_SECOND, MILLIS_IN_HOUR
} = require("./_common");

let Filter = null;
let FilterStorage = null;
let Prefs = null;
let Subscription = null;
let Synchronizer = null;

exports.setUp = function(callback)
{
  let globals = Object.assign({}, setupTimerAndXMLHttp.call(this),
    setupRandomResult.call(this));

  let sandboxedRequire = createSandbox({globals});
  (
    {Filter} = sandboxedRequire("../lib/filterClasses"),
    {FilterStorage} = sandboxedRequire("../lib/filterStorage"),
    {Prefs} = sandboxedRequire("./stub-modules/prefs"),
    {Subscription} = sandboxedRequire("../lib/subscriptionClasses"),
    {Synchronizer} = sandboxedRequire("../lib/synchronizer")
  );

  callback();
};

function resetSubscription(subscription)
{
  FilterStorage.updateSubscriptionFilters(subscription, []);
  subscription.lastCheck =  subscription.lastDownload =
    subscription.version = subscription.lastSuccess =
    subscription.expires = subscription.softExpiration = 0;
  subscription.title = "";
  subscription.homepage = null;
  subscription.errors = 0;
  subscription.downloadStatus = null;
  subscription.requiredVersion = null;
}

let initialDelay = 1 / 60;

exports.testOneSubscriptionDownloads = function(test)
{
  let subscription = Subscription.fromURL("http://example.com/subscription");
  FilterStorage.addSubscription(subscription);

  let requests = [];
  this.registerHandler("/subscription", metadata =>
  {
    requests.push([this.getTimeOffset(), metadata.method, metadata.path]);
    return [Cr.NS_OK, 200, "[Adblock]\n! ExPiREs: 1day\nfoo\nbar"];
  });

  this.runScheduledTasks(50).then(() =>
  {
    test.deepEqual(requests, [
      [0 + initialDelay, "GET", "/subscription"],
      [24 + initialDelay, "GET", "/subscription"],
      [48 + initialDelay, "GET", "/subscription"],
    ], "Requests after 50 hours");
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testTwoSubscriptionsDownloads = function(test)
{
  let subscription1 = Subscription.fromURL("http://example.com/subscription1");
  FilterStorage.addSubscription(subscription1);

  let subscription2 = Subscription.fromURL("http://example.com/subscription2");
  subscription2.expires =
    subscription2.softExpiration =
    (this.currentTime + 2 * MILLIS_IN_HOUR) / MILLIS_IN_SECOND;
  FilterStorage.addSubscription(subscription2);

  let requests = [];
  let handler = metadata =>
  {
    requests.push([this.getTimeOffset(), metadata.method, metadata.path]);
    return [Cr.NS_OK, 200, "[Adblock]\n! ExPiREs: 1day\nfoo\nbar"];
  };

  this.registerHandler("/subscription1", handler);
  this.registerHandler("/subscription2", handler);

  this.runScheduledTasks(55).then(() =>
  {
    test.deepEqual(requests, [
      [0 + initialDelay, "GET", "/subscription1"],
      [2 + initialDelay, "GET", "/subscription2"],
      [24 + initialDelay, "GET", "/subscription1"],
      [26 + initialDelay, "GET", "/subscription2"],
      [48 + initialDelay, "GET", "/subscription1"],
      [50 + initialDelay, "GET", "/subscription2"],
    ], "Requests after 55 hours");
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testSubscriptionHeaders = {};

for (let currentTest of [
  {header: "[Adblock]", downloadStatus: "synchronize_ok", requiredVersion: null},
  {header: "[Adblock Plus]", downloadStatus: "synchronize_ok", requiredVersion: null},
  {header: "(something)[Adblock]", downloadStatus: "synchronize_ok", requiredVersion: null},
  {header: "[Adblock Plus 0.0.1]", downloadStatus: "synchronize_ok", requiredVersion: "0.0.1"},
  {header: "[Adblock Plus 99.9]", downloadStatus: "synchronize_ok", requiredVersion: "99.9"},
  {header: "[Foo]", downloadStatus: "synchronize_invalid_data", requiredVersion: null}
])
{
  exports.testSubscriptionHeaders[currentTest.header] = function(test)
  {
    let subscription = Subscription.fromURL("http://example.com/subscription");
    FilterStorage.addSubscription(subscription);

    this.registerHandler("/subscription", metadata =>
    {
      return [Cr.NS_OK, 200, currentTest.header + "\n!Expires: 8 hours\nfoo\n!bar\n\n@@bas\n#bam"];
    });

    this.runScheduledTasks(2).then(() =>
    {
      test.equal(subscription.downloadStatus, currentTest.downloadStatus, "Download status");
      test.equal(subscription.requiredVersion, currentTest.requiredVersion, "Required version");

      if (currentTest.downloadStatus == "synchronize_ok")
      {
        test.deepEqual(subscription.filters, [
          Filter.fromText("foo"),
          Filter.fromText("!bar"),
          Filter.fromText("@@bas"),
          Filter.fromText("#bam"),
        ], "Resulting subscription filters");
      }
      else
      {
        test.deepEqual(subscription.filters, [
        ], "Resulting subscription filters");
      }
    }).catch(unexpectedError.bind(test)).then(() => test.done());
  };
}

exports.testsDisabledUpdates  = function(test)
{
  Prefs.subscriptions_autoupdate = false;

  let subscription = Subscription.fromURL("http://example.com/subscription");
  FilterStorage.addSubscription(subscription);

  let requests = 0;
  this.registerHandler("/subscription", metadata =>
  {
    requests++;
    throw new Error("Unexpected request");
  });

  this.runScheduledTasks(50).then(() =>
  {
    test.equal(requests, 0, "Request count");
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testExpirationTime = {};

for (let currentTest of [
  {
    expiration: "default",
    randomResult: 0.5,
    requests: [0 + initialDelay, 5 * 24 +  initialDelay]
  },
  {
    expiration: "1 hours",  // Minimal expiration interval
    randomResult: 0.5,
    requests: [0 + initialDelay, 1 + initialDelay, 2 + initialDelay, 3 + initialDelay]
  },
  {
    expiration: "26 hours",
    randomResult: 0.5,
    requests: [0 + initialDelay, 26 + initialDelay]
  },
  {
    expiration: "2 days",
    randomResult: 0.5,
    requests: [0 + initialDelay, 48 + initialDelay]
  },
  {
    expiration: "20 days",  // Too large, will be corrected
    randomResult: 0.5,
    requests: [0 + initialDelay, 14 * 24 + initialDelay]
  },
  {
    expiration: "35 hours",
    randomResult: 0,        // Changes interval by factor 0.8
    requests: [0 + initialDelay, 28 + initialDelay]
  },
  {
    expiration: "35 hours",
    randomResult: 1,        // Changes interval by factor 1.2
    requests: [0 + initialDelay, 42 + initialDelay]
  },
  {
    expiration: "35 hours",
    randomResult: 0.25,     // Changes interval by factor 0.9
    requests: [0 + initialDelay, 32 + initialDelay]
  },
  {
    expiration: "40 hours",
    randomResult: 0.5,
    skipAfter: 5 + initialDelay,
    skip: 10,               // Short break should not increase soft expiration
    requests: [0 + initialDelay, 40 + initialDelay]
  },
  {
    expiration: "40 hours",
    randomResult: 0.5,
    skipAfter: 5 + initialDelay,
    skip: 30,               // Long break should increase soft expiration
    requests: [0 + initialDelay, 70 + initialDelay]
  },
  {
    expiration: "40 hours",
    randomResult: 0.5,
    skipAfter: 5 + initialDelay,
    skip: 80,               // Hitting hard expiration, immediate download
    requests: [0 + initialDelay, 85 + initialDelay]
  }
])
{
  let testId = `"${currentTest.expiration}"`;
  if (currentTest.randomResult != 0.5)
    testId += " with Math.random() returning " + currentTest.randomResult;
  if (currentTest.skip)
    testId += " skipping " + currentTest.skip + " hours after " + currentTest.skipAfter + " hours";
  exports.testExpirationTime[testId] = function(test)
  {
    let subscription = Subscription.fromURL("http://example.com/subscription");
    FilterStorage.addSubscription(subscription);

    let requests = [];
    this.registerHandler("/subscription", metadata =>
    {
      requests.push(this.getTimeOffset());
      return [Cr.NS_OK, 200, "[Adblock]\nfoo\n!Expires: " + currentTest.expiration + "\nbar"];
    });

    this.randomResult = currentTest.randomResult;

    let maxHours = Math.round(Math.max.apply(null, currentTest.requests)) + 1;
    this.runScheduledTasks(maxHours, currentTest.skipAfter, currentTest.skip).then(() =>
    {
      test.deepEqual(requests, currentTest.requests, "Requests");
    }).catch(unexpectedError.bind(test)).then(() => test.done());
  };
}

exports.testChecksumVerification = {};

for (let [testName, subscriptionBody, expectedResult] of [
  ["Correct checksum", "[Adblock]\n! Checksum: e/JCmqXny6Fn24b7JHsq/A\nfoo\nbar\n", true],
  ["Wrong checksum", "[Adblock]\n! Checksum: wrongggny6Fn24b7JHsq/A\nfoo\nbar\n", false],
  ["Empty lines ignored", "[Adblock]\n! Checksum: e/JCmqXny6Fn24b7JHsq/A\n\nfoo\n\nbar\n\n", true],
  ["CR LF line breaks treated like LR", "[Adblock]\n! Checksum: e/JCmqXny6Fn24b7JHsq/A\nfoo\r\nbar\r\n", true],
  ["CR line breaks treated like LR", "[Adblock]\n! Checksum: e/JCmqXny6Fn24b7JHsq/A\nfoo\rbar\r", true],
  ["Trailing line break not ignored", "[Adblock]\n! Checksum: e/JCmqXny6Fn24b7JHsq/A\nfoo\nbar", false],
  ["Line breaks between lines not ignored", "[Adblock]\n! Checksum: e/JCmqXny6Fn24b7JHsq/A\nfoobar", false],
  ["Lines with spaces not ignored", "[Adblock]\n! Checksum: e/JCmqXny6Fn24b7JHsq/A\n \nfoo\n\nbar\n", false],
  ["Extra content in checksum line is part of the checksum", "[Adblock]\n! Checksum: e/JCmqXny6Fn24b7JHsq/A foobar\nfoo\nbar\n", false],
  ["= symbols after checksum are ignored", "[Adblock]\n! Checksum: e/JCmqXny6Fn24b7JHsq/A===\nfoo\nbar\n", true],
  ["Header line is part of the checksum", "[Adblock Plus]\n! Checksum: e/JCmqXny6Fn24b7JHsq/A\nfoo\nbar\n", false],
  ["Special comments are part of the checksum", "[Adblock]\n! Checksum: e/JCmqXny6Fn24b7JHsq/A\n! Expires: 1\nfoo\nbar\n", false],
])
{
  exports.testChecksumVerification[testName] = function(test)
  {
    let subscription = Subscription.fromURL("http://example.com/subscription");
    FilterStorage.addSubscription(subscription);

    this.registerHandler("/subscription", metadata =>
    {
      return [Cr.NS_OK, 200, subscriptionBody];
    });

    this.runScheduledTasks(2).then(() =>
    {
      test.equal(subscription.downloadStatus, expectedResult ? "synchronize_ok" : "synchronize_checksum_mismatch");
    }).catch(unexpectedError.bind(test)).then(() => test.done());
  };
}

exports.testSpecialComments = {};

for (let [comment, check] of [
  ["! Homepage: http://example.com/", (test, subscription) =>
  {
    test.equal(subscription.homepage, "http://example.com/", "Valid homepage comment");
  }],
  ["! Homepage: ssh://example.com/", (test, subscription) =>
  {
    test.equal(subscription.homepage, null, "Invalid homepage comment");
  }],
  ["! Title: foo", (test, subscription) =>
    {
      test.equal(subscription.title, "foo", "Title comment");
      test.equal(subscription.fixedTitle, true, "Fixed title");
    }],
  ["! Version: 1234", (test, subscription) =>
  {
    test.equal(subscription.version, 1234, "Version comment");
  }]
])
{
  exports.testSpecialComments[comment] = function(test)
  {
    let subscription = Subscription.fromURL("http://example.com/subscription");
    FilterStorage.addSubscription(subscription);

    this.registerHandler("/subscription", metadata =>
    {
      return [Cr.NS_OK, 200, "[Adblock]\n" + comment + "\nfoo\nbar"];
    });

    this.runScheduledTasks(2).then(() =>
    {
      check(test, subscription);
      test.deepEqual(subscription.filters, [Filter.fromText("foo"), Filter.fromText("bar")], "Special comment not added to filters");
    }).catch(unexpectedError.bind(test)).then(() => test.done());
  };
}

exports.testRedirects = function(test)
{
  let subscription = Subscription.fromURL("http://example.com/subscription");
  FilterStorage.addSubscription(subscription);

  this.registerHandler("/subscription", metadata =>
  {
    return [Cr.NS_OK, 200, "[Adblock]\nfoo\n!Redirect: http://example.com/redirected\nbar"];
  });

  let requests;

  this.runScheduledTasks(30).then(() =>
  {
    test.equal(FilterStorage.subscriptions[0], subscription, "Invalid redirect ignored");
    test.equal(subscription.downloadStatus, "synchronize_connection_error", "Connection error recorded");
    test.equal(subscription.errors, 2, "Number of download errors");

    requests = [];

    this.registerHandler("/redirected", metadata =>
    {
      requests.push(this.getTimeOffset());
      return [Cr.NS_OK, 200, "[Adblock]\nfoo\n! Expires: 8 hours\nbar"];
    });

    resetSubscription(subscription);
    return this.runScheduledTasks(15);
  }).then(() =>
  {
    test.equal(FilterStorage.subscriptions[0].url, "http://example.com/redirected", "Redirect followed");
    test.deepEqual(requests, [0 + initialDelay, 8 + initialDelay], "Resulting requests");

    this.registerHandler("/redirected", metadata =>
    {
      return [Cr.NS_OK, 200, "[Adblock]\nfoo\n!Redirect: http://example.com/subscription\nbar"];
    })

    subscription = Subscription.fromURL("http://example.com/subscription");
    resetSubscription(subscription);
    FilterStorage.removeSubscription(FilterStorage.subscriptions[0]);
    FilterStorage.addSubscription(subscription);

    return this.runScheduledTasks(2);
  }).then(() =>
  {
    test.equal(FilterStorage.subscriptions[0], subscription, "Redirect not followed on redirect loop");
    test.equal(subscription.downloadStatus, "synchronize_connection_error", "Download status after redirect loop");
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testFallback = function(test)
{
  Prefs.subscriptions_fallbackerrors = 3;
  Prefs.subscriptions_fallbackurl = "http://example.com/fallback?%SUBSCRIPTION%&%CHANNELSTATUS%&%RESPONSESTATUS%";

  let subscription = Subscription.fromURL("http://example.com/subscription");
  FilterStorage.addSubscription(subscription);

  // No valid response from fallback

  let requests = [];
  let fallbackParams;
  let redirectedRequests;
  this.registerHandler("/subscription", metadata =>
  {
    requests.push(this.getTimeOffset());
    return [Cr.NS_OK, 404, ""];
  });

  this.runScheduledTasks(100).then(() =>
  {
    test.deepEqual(requests, [0 + initialDelay, 24 + initialDelay, 48 + initialDelay, 72 + initialDelay, 96 + initialDelay], "Continue trying if the fallback doesn't respond");

    // Fallback giving "Gone" response

    resetSubscription(subscription);
    requests = [];
    fallbackParams = null;
    this.registerHandler("/fallback", metadata =>
    {
      fallbackParams = decodeURIComponent(metadata.queryString);
      return [Cr.NS_OK, 200, "410 Gone"];
    });

    return this.runScheduledTasks(100);
  }).then(() =>
  {
    test.deepEqual(requests, [0 + initialDelay, 24 + initialDelay, 48 + initialDelay], "Stop trying if the fallback responds with Gone");
    test.equal(fallbackParams, "http://example.com/subscription&0&404", "Fallback arguments");

    // Fallback redirecting to a missing file

    subscription = Subscription.fromURL("http://example.com/subscription");
    resetSubscription(subscription);
    FilterStorage.removeSubscription(FilterStorage.subscriptions[0]);
    FilterStorage.addSubscription(subscription);
    requests = [];

    this.registerHandler("/fallback", metadata =>
    {
      return [Cr.NS_OK, 200, "301 http://example.com/redirected"];
    });
    return this.runScheduledTasks(100);
  }).then(() =>
  {
    test.equal(FilterStorage.subscriptions[0].url, "http://example.com/subscription", "Ignore invalid redirect from fallback");
    test.deepEqual(requests, [0 + initialDelay, 24 + initialDelay, 48 + initialDelay, 72 + initialDelay, 96 + initialDelay], "Requests not affected by invalid redirect");

    // Fallback redirecting to an existing file

    resetSubscription(subscription);
    requests = [];
    redirectedRequests = [];
    this.registerHandler("/redirected", metadata =>
    {
      redirectedRequests.push(this.getTimeOffset());
      return [Cr.NS_OK, 200, "[Adblock]\n!Expires: 1day\nfoo\nbar"];
    });

    return this.runScheduledTasks(100);
  }).then(() =>
  {
    test.equal(FilterStorage.subscriptions[0].url, "http://example.com/redirected", "Valid redirect from fallback is followed");
    test.deepEqual(requests, [0 + initialDelay, 24 + initialDelay, 48 + initialDelay], "Stop polling original URL after a valid redirect from fallback");
    test.deepEqual(redirectedRequests, [48 + initialDelay, 72 + initialDelay, 96 + initialDelay], "Request new URL after a valid redirect from fallback");

    // Checksum mismatch

    this.registerHandler("/subscription", metadata =>
    {
      return [Cr.NS_OK, 200, "[Adblock]\n! Checksum: wrong\nfoo\nbar"];
    });

    subscription = Subscription.fromURL("http://example.com/subscription");
    resetSubscription(subscription);
    FilterStorage.removeSubscription(FilterStorage.subscriptions[0]);
    FilterStorage.addSubscription(subscription);

    return this.runScheduledTasks(100);
  }).then(() =>
  {
    test.equal(FilterStorage.subscriptions[0].url, "http://example.com/redirected", "Wrong checksum produces fallback request");

    // Redirect loop

    this.registerHandler("/subscription", metadata =>
    {
      return [Cr.NS_OK, 200, "[Adblock]\n! Redirect: http://example.com/subscription2"];
    });
    this.registerHandler("/subscription2", metadata =>
    {
      return [Cr.NS_OK, 200, "[Adblock]\n! Redirect: http://example.com/subscription"];
    });

    subscription = Subscription.fromURL("http://example.com/subscription");
    resetSubscription(subscription);
    FilterStorage.removeSubscription(FilterStorage.subscriptions[0]);
    FilterStorage.addSubscription(subscription);

    return this.runScheduledTasks(100);
  }).then(() =>
  {
    test.equal(FilterStorage.subscriptions[0].url, "http://example.com/redirected", "Fallback can still redirect even after a redirect loop");
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testStateFields = function(test)
{
  let subscription = Subscription.fromURL("http://example.com/subscription");
  FilterStorage.addSubscription(subscription);

  this.registerHandler("/subscription", metadata =>
  {
    return [Cr.NS_OK, 200, "[Adblock]\n! Expires: 2 hours\nfoo\nbar"];
  });

  let startTime = this.currentTime;
  this.runScheduledTasks(2).then(() =>
  {
    test.equal(subscription.downloadStatus, "synchronize_ok", "downloadStatus after successful download");
    test.equal(subscription.lastDownload * MILLIS_IN_SECOND, startTime +  initialDelay * MILLIS_IN_HOUR, "lastDownload after successful download");
    test.equal(subscription.lastSuccess * MILLIS_IN_SECOND, startTime +  initialDelay * MILLIS_IN_HOUR, "lastSuccess after successful download");
    test.equal(subscription.lastCheck * MILLIS_IN_SECOND, startTime + (1 +  initialDelay) * MILLIS_IN_HOUR, "lastCheck after successful download");
    test.equal(subscription.errors, 0, "errors after successful download");

    this.registerHandler("/subscription", metadata =>
    {
      return [Cr.NS_ERROR_FAILURE, 0, ""];
    });

    return this.runScheduledTasks(2);
  }).then(() =>
  {
    test.equal(subscription.downloadStatus, "synchronize_connection_error", "downloadStatus after connection error");
    test.equal(subscription.lastDownload * MILLIS_IN_SECOND, startTime + (2 +  initialDelay) * MILLIS_IN_HOUR, "lastDownload after connection error");
    test.equal(subscription.lastSuccess * MILLIS_IN_SECOND, startTime + initialDelay * MILLIS_IN_HOUR, "lastSuccess after connection error");
    test.equal(subscription.lastCheck * MILLIS_IN_SECOND, startTime + (3 + initialDelay) * MILLIS_IN_HOUR, "lastCheck after connection error");
    test.equal(subscription.errors, 1, "errors after connection error");

    this.registerHandler("/subscription", metadata =>
    {
      return [Cr.NS_OK, 404, ""];
    });

    return this.runScheduledTasks(24);
  }).then(() =>
  {
    test.equal(subscription.downloadStatus, "synchronize_connection_error", "downloadStatus after download error");
    test.equal(subscription.lastDownload * MILLIS_IN_SECOND, startTime + (26 + initialDelay) * MILLIS_IN_HOUR, "lastDownload after download error");
    test.equal(subscription.lastSuccess * MILLIS_IN_SECOND, startTime + initialDelay * MILLIS_IN_HOUR, "lastSuccess after download error");
    test.equal(subscription.lastCheck * MILLIS_IN_SECOND, startTime + (27 + initialDelay) * MILLIS_IN_HOUR, "lastCheck after download error");
    test.equal(subscription.errors, 2, "errors after download error");
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};
