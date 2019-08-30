/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
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

const assert = require("assert");

let {
  createSandbox, setupTimerAndFetch, setupRandomResult, unexpectedError
} = require("./_common");

let Prefs = null;
let Utils = null;
let Notification = null;

// Only starting NodeJS 10 that URL and URLSearchParams are in the global space.
const {URL, URLSearchParams} = require("url");

describe("Notifications", function()
{
  let runner = {};

  beforeEach(function()
  {
    runner = {};
    // Inject our Array and JSON to make sure that instanceof checks on arrays
    // within the sandbox succeed even with data passed in from outside.
    let globals = Object.assign({Array, JSON},
      setupTimerAndFetch.call(runner), setupRandomResult.call(runner));

    let sandboxedRequire = createSandbox({globals});
    (
      {Prefs} = sandboxedRequire("./stub-modules/prefs"),
      {Utils} = sandboxedRequire("./stub-modules/utils"),
      {Notification} = sandboxedRequire("../lib/notification")
    );
  });

  function showNotifications(location)
  {
    let shownNotifications = [];
    function showListener(notification)
    {
      shownNotifications.push(notification);
      Notification.markAsShown(notification.id);
    }
    Notification.addShowListener(showListener);
    Notification.showNext(location && new URL(location));
    Notification.removeShowListener(showListener);
    return shownNotifications;
  }

  function* pairs(array)
  {
    for (let element1 of array)
    {
      for (let element2 of array)
      {
        if (element1 != element2)
          yield [element1, element2];
      }
    }
  }

  function registerHandler(notifications, checkCallback)
  {
    runner.registerHandler("/notification.json", metadata =>
    {
      if (checkCallback)
        checkCallback(metadata);

      let notification = {
        version: 55,
        notifications
      };

      return [200, JSON.stringify(notification)];
    });
  }

  it("No data", function()
  {
    assert.deepEqual(showNotifications(), [], "No notifications should be returned if there is no data");
  });

  it("Single", function()
  {
    let information = {
      id: 1,
      type: "information",
      message: {"en-US": "Information"}
    };

    registerHandler.call(runner, [information]);
    return runner.runScheduledTasks(1).then(() =>
    {
      assert.deepEqual(showNotifications(), [information], "The notification is shown");
      assert.deepEqual(showNotifications(), [], "Informational notifications aren't shown more than once");
    }).catch(unexpectedError.bind(assert));
  });

  it("Information and critical", function()
  {
    let information = {
      id: 1,
      type: "information",
      message: {"en-US": "Information"}
    };
    let critical = {
      id: 2,
      type: "critical",
      message: {"en-US": "Critical"}
    };

    registerHandler.call(runner, [information, critical]);
    return runner.runScheduledTasks(1).then(() =>
    {
      assert.deepEqual(showNotifications(), [critical], "The critical notification is given priority");
      assert.deepEqual(showNotifications(), [critical], "Critical notifications can be shown multiple times");
    }).catch(unexpectedError.bind(assert));
  });

  it("No type", function()
  {
    let information = {
      id: 1,
      message: {"en-US": "Information"}
    };

    registerHandler.call(runner, [information]);
    return runner.runScheduledTasks(1).then(() =>
    {
      assert.deepEqual(showNotifications(), [information], "The notification is shown");
      assert.deepEqual(showNotifications(), [], "Notification is treated as type information");
    }).catch(unexpectedError.bind(assert));
  });

  function testTargetSelectionFunc(propName, value, result)
  {
    return function()
    {
      let targetInfo = {};
      targetInfo[propName] = value;

      let information = {
        id: 1,
        type: "information",
        message: {"en-US": "Information"},
        targets: [targetInfo]
      };

      registerHandler.call(this, [information]);
      return runner.runScheduledTasks(1).then(() =>
      {
        let expected = (result ? [information] : []);
        assert.deepEqual(showNotifications(), expected, "Selected notification for " + JSON.stringify(information.targets));
        assert.deepEqual(showNotifications(), [], "No notification on second call");
      }).catch(unexpectedError.bind(assert));
    };
  }

  describe("Target selection", function()
  {
    for (let [propName, value, result] of [
      ["extension", "adblockpluschrome", true],
      ["extension", "adblockplus", false],
      ["extension", "adblockpluschrome2", false],
      ["extensionMinVersion", "1.4", true],
      ["extensionMinVersion", "1.4.1", true],
      ["extensionMinVersion", "1.5", false],
      ["extensionMaxVersion", "1.5", true],
      ["extensionMaxVersion", "1.4.1", true],
      ["extensionMaxVersion", "1.4.*", true],
      ["extensionMaxVersion", "1.4", false],
      ["application", "chrome", true],
      ["application", "firefox", false],
      ["applicationMinVersion", "27.0", true],
      ["applicationMinVersion", "27", true],
      ["applicationMinVersion", "26", true],
      ["applicationMinVersion", "28", false],
      ["applicationMinVersion", "27.1", false],
      ["applicationMinVersion", "27.0b1", true],
      ["applicationMaxVersion", "27.0", true],
      ["applicationMaxVersion", "27", true],
      ["applicationMaxVersion", "28", true],
      ["applicationMaxVersion", "26", false],
      ["applicationMaxVersion", "27.0b1", false],
      ["platform", "chromium", true],
      ["platform", "gecko", false],
      ["platformMinVersion", "12.0", true],
      ["platformMinVersion", "12", true],
      ["platformMinVersion", "11", true],
      ["platformMinVersion", "13", false],
      ["platformMinVersion", "12.1", false],
      ["platformMinVersion", "12.0b1", true],
      ["platformMaxVersion", "12.0", true],
      ["platformMaxVersion", "12", true],
      ["platformMaxVersion", "13", true],
      ["platformMaxVersion", "11", false],
      ["platformMaxVersion", "12.0b1", false],
      ["blockedTotalMin", "11", false],
      ["blockedTotalMin", "10", true],
      ["blockedTotalMax", "10", true],
      ["blockedTotalMax", "1", false],
      ["locales", ["en-US"], true],
      ["locales", ["en-US", "de-DE"], true],
      ["locales", ["de-DE"], false],
      ["locales", ["en-GB", "de-DE"], false]
    ])
    {
      it(`${propName}=${value}`, testTargetSelectionFunc(propName, value, result));
    }
  });

  describe("No show stats", function()
  {
    beforeEach(function()
    {
      runner.show_statsinpopup_orig = Prefs.show_statsinpopup;
      Prefs.show_statsinpopup = false;
    });

    afterEach(function()
    {
      Prefs.show_statsinpopup = runner.show_statsinpopup_orig;
    });

    for (let [propName, value, result] of [
      ["blockedTotalMin", "10", false],
      ["blockedTotalMax", "10", false]
    ])
    {
      it(`Target ${propName}=${value}`, testTargetSelectionFunc(propName, value, result));
    }
  });

  describe("Multiple targets", function()
  {
    for (let [[propName1, value1, result1], [propName2, value2, result2]] of pairs([
      ["extension", "adblockpluschrome", true],
      ["extension", "adblockplus", false],
      ["extensionMinVersion", "1.4", true],
      ["extensionMinVersion", "1.5", false],
      ["application", "chrome", true],
      ["application", "firefox", false],
      ["applicationMinVersion", "27", true],
      ["applicationMinVersion", "28", false],
      ["platform", "chromium", true],
      ["platform", "gecko", false],
      ["platformMinVersion", "12", true],
      ["platformMinVersion", "13", false],
      ["unknown", "unknown", false]
    ]))
    {
      it(`${propName1}=${value1},${propName2}=${value2}`, function()
      {
        let targetInfo1 = {};
        targetInfo1[propName1] = value1;
        let targetInfo2 = {};
        targetInfo2[propName2] = value2;

        let information = {
          id: 1,
          type: "information",
          message: {"en-US": "Information"},
          targets: [targetInfo1, targetInfo2]
        };

        registerHandler.call(runner, [information]);
        return runner.runScheduledTasks(1).then(() =>
        {
          let expected = (result1 || result2 ? [information] : []);
          assert.deepEqual(showNotifications(), expected, "Selected notification for " + JSON.stringify(information.targets));
        }).catch(unexpectedError.bind(assert));
      });
    }
  });

  it("Parameters sent", function()
  {
    Prefs.notificationdata = {
      data: {
        version: "3"
      }
    };

    let parameters = null;
    registerHandler.call(runner, [], metadata =>
    {
      parameters = decodeURI(metadata.queryString);
    });
    return runner.runScheduledTasks(1).then(() =>
    {
      assert.equal(parameters,
                   "addonName=adblockpluschrome&addonVersion=1.4.1&application=chrome&applicationVersion=27.0&platform=chromium&platformVersion=12.0&lastVersion=3&downloadCount=0",
                   "The correct parameters are sent to the server");
    }).catch(unexpectedError.bind(assert));
  });

  it("First version", async function()
  {
    let checkDownload = async(payload, {queryParam, state: {firstVersion, data},
                                        eFlag = ""}) =>
    {
      runner.registerHandler("/notification.json", ({queryString}) =>
      {
        let params = new URLSearchParams(decodeURI(queryString));

        assert.equal(params.get("firstVersion"), queryParam + eFlag);

        return [200, JSON.stringify(Object.assign({notifications: []}, payload))];
      });

      await runner.runScheduledTasks(24);

      assert.equal(Prefs.notificationdata.firstVersion, firstVersion + eFlag);
      assert.equal(Prefs.notificationdata.data.version, data.version);
    };

    async function testIt({eFlag} = {})
    {
      Prefs.notificationdata = {firstVersion: "0"};

      if (typeof eFlag != "undefined")
      {
        // Set the data property to an empty object to simulate an already
        // installed version.
        Prefs.notificationdata.data = {};
      }

      // First download on 2019-05-07T12:34Z. This gives us the initial value.
      await checkDownload({version: "201905071234"}, {
        queryParam: "0",
        state: {
          firstVersion: "201905071234",
          data: {version: "201905071234"}
        },
        eFlag
      });

      // 30 days and 1 minute since the first download.
      await checkDownload({version: "201906061235"}, {
        queryParam: "20190507",
        state: {
          firstVersion: "201905071234",
          data: {version: "201906061235"}
        },
        eFlag
      });

      // 30 days and 2 minutes since the first download. The value is trimmed to
      // YYYYMM.
      await checkDownload({version: "201906061236"}, {
        queryParam: "201905",
        state: {
          firstVersion: "201905071234",
          data: {version: "201906061236"}
        },
        eFlag
      });

      // 365 days and 1 minute since the first download.
      await checkDownload({version: "202005061235"}, {
        queryParam: "201905",
        state: {
          firstVersion: "201905071234",
          data: {version: "202005061235"}
        },
        eFlag
      });

      // 365 days and 2 minutes since the first download. The value is trimmed to
      // YYYY.
      await checkDownload({version: "202005061236"}, {
        queryParam: "2019",
        state: {
          firstVersion: "201905071234",
          data: {version: "202005061236"}
        },
        eFlag
      });

      // 2,557 days (~7 years) since the first download.
      await checkDownload({version: "202605071234"}, {
        queryParam: "2019",
        state: {
          firstVersion: "201905071234",
          data: {version: "202605071234"}
        },
        eFlag
      });
    }

    try
    {
      await testIt();
      await testIt({eFlag: "-E"});
    }
    catch (error)
    {
      unexpectedError.call(assert, error);
    }
  });

  describe("Expiration interval", function()
  {
    let initialDelay = 1 / 60;
    for (let currentTest of [
      {
        randomResult: 0.5,
        requests: [initialDelay, initialDelay + 24, initialDelay + 48]
      },
      {
        randomResult: 0,        // Changes interval by factor 0.8 (19.2 hours)
        requests: [initialDelay, initialDelay + 20, initialDelay + 40]
      },
      {
        randomResult: 1,        // Changes interval by factor 1.2 (28.8 hours)
        requests: [initialDelay, initialDelay + 29, initialDelay + 58]
      },
      {
        randomResult: 0.25,     // Changes interval by factor 0.9 (21.6 hours)
        requests: [initialDelay, initialDelay + 22, initialDelay + 44]
      },
      {
        randomResult: 0.5,
        skipAfter: initialDelay + 5,
        skip: 10,               // Short break should not increase soft expiration
        requests: [initialDelay, initialDelay + 24]
      },
      {
        randomResult: 0.5,
        skipAfter: initialDelay + 5,
        skip: 30,               // Long break should increase soft expiration, hitting hard expiration
        requests: [initialDelay, initialDelay + 48]
      }
    ])
    {
      let testId = `Math.random() returning ${currentTest.randomResult}`;
      if (typeof currentTest.skip == "number")
        testId += ` skipping ${currentTest.skip} hours after ${currentTest.skipAfter} hours`;

      it(testId, function()
      {
        let requests = [];
        registerHandler.call(runner, [], metadata => requests.push(runner.getTimeOffset()));

        runner.randomResult = currentTest.randomResult;

        let maxHours = Math.round(Math.max.apply(null, currentTest.requests)) + 1;
        return runner.runScheduledTasks(maxHours, currentTest.skipAfter, currentTest.skip).then(() =>
        {
          assert.deepEqual(requests, currentTest.requests, "Requests");
        }).catch(unexpectedError.bind(assert));
      });
    }
  });

  it("Using severity instead of type", function(done)
  {
    let severityNotification = {
      id: 1,
      severity: "information",
      message: {"en-US": "Information"}
    };

    function listener(name)
    {
      if (name !== "notificationdata")
        return;

      Prefs.removeListener(listener);
      let notification = Prefs.notificationdata.data.notifications[0];
      assert.ok(!("severity" in notification), "Severity property was removed");
      assert.ok("type" in notification, "Type property was added");
      assert.equal(notification.type, severityNotification.severity, "Type property has correct value");
      done();
    }
    Prefs.addListener(listener);

    let responseText = JSON.stringify({
      notifications: [severityNotification]
    });
    Notification._onDownloadSuccess({}, responseText, () => {}, () => {});
  });

  it("URL specific", function()
  {
    let withURLFilterFoo = {
      id: 1,
      urlFilters: ["foo.com$document"]
    };
    let withoutURLFilter = {
      id: 2
    };
    let withURLFilterBar = {
      id: 3,
      urlFilters: ["bar.com$document"]
    };
    let subdomainURLFilter = {
      id: 4,
      urlFilters: ["||example.com$document"]
    };

    registerHandler.call(runner, [
      withURLFilterFoo,
      withoutURLFilter,
      withURLFilterBar,
      subdomainURLFilter
    ]);
    return runner.runScheduledTasks(1).then(() =>
    {
      assert.deepEqual(showNotifications(), [withoutURLFilter], "URL-specific notifications are skipped");
      assert.deepEqual(showNotifications("http://foo.com"), [withURLFilterFoo], "URL-specific notification is retrieved");
      assert.deepEqual(showNotifications("http://foo.com"), [], "URL-specific notification is not retrieved");
      assert.deepEqual(showNotifications("http://www.example.com"), [subdomainURLFilter], "URL-specific notification matches subdomain");
    }).catch(unexpectedError.bind(assert));
  });

  it("Interval", function()
  {
    let relentless = {
      id: 3,
      type: "relentless",
      interval: 100
    };

    registerHandler.call(runner, [relentless]);
    return runner.runScheduledTasks(1).then(() =>
    {
      assert.deepEqual(showNotifications(), [relentless], "Relentless notifications are shown initially");
    }).then(() =>
    {
      assert.deepEqual(showNotifications(), [], "Relentless notifications are not shown before the interval");
    }).then(() =>
    {
      // Date always returns a fixed time (see setupTimerAndFetch) so we
      // manipulate the shown data manually.
      Prefs.notificationdata.shown[relentless.id] -= relentless.interval;
      assert.deepEqual(showNotifications(), [relentless], "Relentless notifications are shown after the interval");
    }).catch(unexpectedError.bind(assert));
  });

  it("Relentless", function()
  {
    let relentless = {
      id: 3,
      type: "relentless",
      interval: 100,
      urlFilters: ["foo.com$document", "bar.foo$document"]
    };

    registerHandler.call(runner, [relentless]);
    return runner.runScheduledTasks(1).then(() =>
    {
      assert.deepEqual(showNotifications(), [], "Relentless notification is not shown without URL");
      assert.deepEqual(showNotifications("http://bar.com"), [], "Relentless notification is not shown for a non-matching URL");
      assert.deepEqual(showNotifications("http://foo.com"), [relentless], "Relentless notification is shown for a matching URL");
    }).then(() =>
    {
      assert.deepEqual(showNotifications("http://foo.com"), [], "Relentless notifications are not shown before the interval");
    }).then(() =>
    {
      // Date always returns a fixed time (see setupTimerAndFetch) so we
      // manipulate the shown data manually.
      Prefs.notificationdata.shown[relentless.id] -= relentless.interval;
      assert.deepEqual(showNotifications(), [], "Relentless notifications are not shown after the interval without URL");
      assert.deepEqual(showNotifications("http://bar.com"), [], "Relentless notifications are not shown after the interval for a non-matching URL");
      assert.deepEqual(showNotifications("http://bar.foo.com"), [relentless], "Relentless notifications are shown after the interval for a matching URL");
    }).catch(unexpectedError.bind(assert));
  });

  it("Global opt-out", function()
  {
    Notification.toggleIgnoreCategory("*", true);
    assert.ok(Prefs.notifications_ignoredcategories.indexOf("*") != -1, "Force enable global opt-out");
    Notification.toggleIgnoreCategory("*", true);
    assert.ok(Prefs.notifications_ignoredcategories.indexOf("*") != -1, "Force enable global opt-out (again)");
    Notification.toggleIgnoreCategory("*", false);
    assert.ok(Prefs.notifications_ignoredcategories.indexOf("*") == -1, "Force disable global opt-out");
    Notification.toggleIgnoreCategory("*", false);
    assert.ok(Prefs.notifications_ignoredcategories.indexOf("*") == -1, "Force disable global opt-out (again)");
    Notification.toggleIgnoreCategory("*");
    assert.ok(Prefs.notifications_ignoredcategories.indexOf("*") != -1, "Toggle enable global opt-out");
    Notification.toggleIgnoreCategory("*");
    assert.ok(Prefs.notifications_ignoredcategories.indexOf("*") == -1, "Toggle disable global opt-out");

    Notification.toggleIgnoreCategory("*", false);

    let information = {
      id: 1,
      type: "information"
    };
    let critical = {
      id: 2,
      type: "critical"
    };
    let relentless = {
      id: 3,
      type: "relentless"
    };

    Notification.toggleIgnoreCategory("*", true);
    registerHandler.call(runner, [information]);
    return runner.runScheduledTasks(1).then(() =>
    {
      assert.deepEqual(showNotifications(), [], "Information notifications are ignored after enabling global opt-out");
      Notification.toggleIgnoreCategory("*", false);
      assert.deepEqual(showNotifications(), [information], "Information notifications are shown after disabling global opt-out");

      Notification.toggleIgnoreCategory("*", true);
      Prefs.notificationdata = {};
      registerHandler.call(runner, [critical]);
      return runner.runScheduledTasks(1);
    }).then(() =>
    {
      assert.deepEqual(showNotifications(), [critical], "Critical notifications are not ignored");

      Prefs.notificationdata = {};
      registerHandler.call(this, [relentless]);
      return runner.runScheduledTasks(1);
    }).then(() =>
    {
      assert.deepEqual(showNotifications(), [relentless], "Relentless notifications are not ignored");
    }).catch(unexpectedError.bind(assert));
  });

  it("Message without localization", function()
  {
    let notification = {message: "non-localized"};
    let texts = Notification.getLocalizedTexts(notification);
    assert.equal(texts.message, "non-localized");
  });

  it("Language only", function()
  {
    let notification = {message: {fr: "fr"}};
    Utils.appLocale = "fr";
    let texts = Notification.getLocalizedTexts(notification);
    assert.equal(texts.message, "fr");
    Utils.appLocale = "fr-CA";
    texts = Notification.getLocalizedTexts(notification);
    assert.equal(texts.message, "fr");
  });

  it("Language and country", function()
  {
    let notification = {message: {"fr": "fr", "fr-CA": "fr-CA"}};
    Utils.appLocale = "fr-CA";
    let texts = Notification.getLocalizedTexts(notification);
    assert.equal(texts.message, "fr-CA");
    Utils.appLocale = "fr";
    texts = Notification.getLocalizedTexts(notification);
    assert.equal(texts.message, "fr");
  });

  it("Missing translation", function()
  {
    let notification = {message: {"en-US": "en-US"}};
    Utils.appLocale = "fr";
    let texts = Notification.getLocalizedTexts(notification);
    assert.equal(texts.message, "en-US");
  });
});
