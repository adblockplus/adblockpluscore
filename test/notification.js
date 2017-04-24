/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-2017 eyeo GmbH
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
  createSandbox, setupTimerAndXMLHttp, setupRandomResult, unexpectedError, Cr
} = require("./_common");

let Prefs = null;
let Notification = null;

exports.setUp = function(callback)
{
  // Inject our Array and JSON to make sure that instanceof checks on arrays
  // within the sandbox succeed even with data passed in from outside.
  let globals = Object.assign({Array, JSON},
    setupTimerAndXMLHttp.call(this), setupRandomResult.call(this));

  let sandboxedRequire = createSandbox({globals});
  (
    {Prefs} = sandboxedRequire("./stub-modules/prefs"),
    {Notification} = sandboxedRequire("../lib/notification")
  );

  callback();
};

function showNotifications(url)
{
  let shownNotifications = [];
  function showListener(notification)
  {
    shownNotifications.push(notification);
    Notification.markAsShown(notification.id);
  }
  Notification.addShowListener(showListener);
  Notification.showNext(url);
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
  this.registerHandler("/notification.json", metadata =>
  {
    if (checkCallback)
      checkCallback(metadata);

    let notification = {
      version: 55,
      notifications
    };

    return [Cr.NS_OK, 200, JSON.stringify(notification)];
  });
}

exports.testNoData = function(test)
{
  test.deepEqual(showNotifications(), [], "No notifications should be returned if there is no data");
  test.done();
};

exports.testSingleNotification = function(test)
{
  let information = {
    id: 1,
    type: "information",
    message: {"en-US": "Information"}
  };

  registerHandler.call(this, [information]);
  this.runScheduledTasks(1).then(() =>
  {
    test.deepEqual(showNotifications(), [information], "The notification is shown");
    test.deepEqual(showNotifications(), [], "Informational notifications aren't shown more than once");
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testInformationAndCritical = function(test)
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

  registerHandler.call(this, [information, critical]);
  this.runScheduledTasks(1).then(() =>
  {
    test.deepEqual(showNotifications(), [critical], "The critical notification is given priority");
    test.deepEqual(showNotifications(), [critical], "Critical notifications can be shown multiple times");
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testNoType = function(test)
{
  let information = {
    id: 1,
    message: {"en-US": "Information"}
  };

  registerHandler.call(this, [information]);
  this.runScheduledTasks(1).then(() =>
  {
    test.deepEqual(showNotifications(), [information], "The notification is shown");
    test.deepEqual(showNotifications(), [], "Notification is treated as type information");
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testTargetSelection = {};

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
  ["applicationMaxVersion", "27.0", true],
  ["applicationMaxVersion", "27", true],
  ["applicationMaxVersion", "28", true],
  ["applicationMaxVersion", "26", false],
  ["platform", "chromium", true],
  ["platform", "gecko", false],
  ["platformMinVersion", "12.0", true],
  ["platformMinVersion", "12", true],
  ["platformMinVersion", "11", true],
  ["platformMinVersion", "13", false],
  ["platformMinVersion", "12.1", false],
  ["platformMaxVersion", "12.0", true],
  ["platformMaxVersion", "12", true],
  ["platformMaxVersion", "13", true],
  ["platformMaxVersion", "11", false]
])
{
  exports.testTargetSelection[`${propName}=${value}`] = function(test)
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
    this.runScheduledTasks(1).then(() =>
    {
      let expected = (result ? [information] : []);
      test.deepEqual(showNotifications(), expected, "Selected notification for " + JSON.stringify(information.targets));
      test.deepEqual(showNotifications(), [], "No notification on second call");
    }).catch(unexpectedError.bind(test)).then(() => test.done());
  };
}

exports.testMultipleTargets = {};

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
  ["platformMinVersion", "13", false]
]))
{
  exports.testMultipleTargets[`${propName1}=${value1},${propName2}=${value2}`] = function(test)
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

    registerHandler.call(this, [information]);
    this.runScheduledTasks(1).then(() =>
    {
      let expected = (result1 || result2 ? [information] : []);
      test.deepEqual(showNotifications(), expected, "Selected notification for " + JSON.stringify(information.targets));
    }).catch(unexpectedError.bind(test)).then(() => test.done());
  };
}

exports.testParametersSent = function(test)
{
  Prefs.notificationdata = {
    data: {
      version: "3"
    }
  };

  let parameters = null;
  registerHandler.call(this, [], metadata =>
  {
    parameters = decodeURI(metadata.queryString);
  });
  this.runScheduledTasks(1).then(() =>
  {
    test.equal(parameters,
          "addonName=adblockpluschrome&addonVersion=1.4.1&application=chrome&applicationVersion=27.0&platform=chromium&platformVersion=12.0&lastVersion=3&downloadCount=0",
          "The correct parameters are sent to the server");
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testExpirationInterval = {};

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
  let testId = "Math.random() returning " + currentTest.randomResult;
  if (typeof currentTest.skip != "number")
    testId += " skipping " + currentTest.skip + " hours after " + currentTest.skipAfter + " hours";
  exports.testExpirationInterval[testId] = function(test)
  {
    let requests = [];
    registerHandler.call(this, [], metadata => requests.push(this.getTimeOffset()));

    this.randomResult = currentTest.randomResult;

    let maxHours = Math.round(Math.max.apply(null, currentTest.requests)) + 1;
    this.runScheduledTasks(maxHours, currentTest.skipAfter, currentTest.skip).then(() =>
    {
      test.deepEqual(requests, currentTest.requests, "Requests");
    }).catch(unexpectedError.bind(test)).then(() => test.done());
  };
}

exports.testUsingSeverityInsteadOfType = function(test)
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
    test.ok(!("severity" in notification), "Severity property was removed");
    test.ok("type" in notification, "Type property was added");
    test.equal(notification.type, severityNotification.severity, "Type property has correct value");
    test.done();
  }
  Prefs.addListener(listener);

  let responseText = JSON.stringify({
    notifications: [severityNotification]
  });
  Notification._onDownloadSuccess({}, responseText, () => {}, () => {});
};

exports.testGlobalOptOut = function(test)
{
  Notification.toggleIgnoreCategory("*", true);
  test.ok(Prefs.notifications_ignoredcategories.indexOf("*") != -1, "Force enable global opt-out");
  Notification.toggleIgnoreCategory("*", true);
  test.ok(Prefs.notifications_ignoredcategories.indexOf("*") != -1, "Force enable global opt-out (again)");
  Notification.toggleIgnoreCategory("*", false);
  test.ok(Prefs.notifications_ignoredcategories.indexOf("*") == -1, "Force disable global opt-out");
  Notification.toggleIgnoreCategory("*", false);
  test.ok(Prefs.notifications_ignoredcategories.indexOf("*") == -1, "Force disable global opt-out (again)");
  Notification.toggleIgnoreCategory("*");
  test.ok(Prefs.notifications_ignoredcategories.indexOf("*") != -1, "Toggle enable global opt-out");
  Notification.toggleIgnoreCategory("*");
  test.ok(Prefs.notifications_ignoredcategories.indexOf("*") == -1, "Toggle disable global opt-out");

  Prefs.notifications_showui = false;
  Notification.toggleIgnoreCategory("*", false);
  test.ok(!Prefs.notifications_showui, "Opt-out UI will not be shown if global opt-out hasn't been enabled yet");
  Notification.toggleIgnoreCategory("*", true);
  test.ok(Prefs.notifications_showui, "Opt-out UI will be shown after enabling global opt-out");
  Notification.toggleIgnoreCategory("*", false);
  test.ok(Prefs.notifications_showui, "Opt-out UI will be shown after enabling global opt-out even if it got disabled again");

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
  registerHandler.call(this, [information]);
  this.runScheduledTasks(1).then(() =>
  {
    test.deepEqual(showNotifications(), [], "Information notifications are ignored after enabling global opt-out");
    Notification.toggleIgnoreCategory("*", false);
    test.deepEqual(showNotifications(), [information], "Information notifications are shown after disabling global opt-out");

    Notification.toggleIgnoreCategory("*", true);
    Prefs.notificationdata = {};
    registerHandler.call(this, [critical]);
    return this.runScheduledTasks(1);
  }).then(() =>
  {
    test.deepEqual(showNotifications(), [critical], "Critical notifications are not ignored");

    Prefs.notificationdata = {};
    registerHandler.call(this, [relentless]);
    return this.runScheduledTasks(1);
  }).then(() =>
  {
    test.deepEqual(showNotifications(), [relentless], "Relentless notifications are not ignored");
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testMessageWithoutLocalization = function(test)
{
  let notification = {message: "non-localized"};
  let texts = Notification.getLocalizedTexts(notification, "en-US");
  test.equal(texts.message, "non-localized");
  test.done();
};

exports.testLanguageOnly = function(test)
{
  let notification = {message: {fr: "fr"}};
  let texts = Notification.getLocalizedTexts(notification, "fr");
  test.equal(texts.message, "fr");
  texts = Notification.getLocalizedTexts(notification, "fr-CA");
  test.equal(texts.message, "fr");
  test.done();
};

exports.testLanguageAndCountry = function(test)
{
  let notification = {message: {"fr": "fr", "fr-CA": "fr-CA"}};
  let texts = Notification.getLocalizedTexts(notification, "fr-CA");
  test.equal(texts.message, "fr-CA");
  texts = Notification.getLocalizedTexts(notification, "fr");
  test.equal(texts.message, "fr");
  test.done();
};

exports.testMissingTranslation = function(test)
{
  let notification = {message: {"en-US": "en-US"}};
  let texts = Notification.getLocalizedTexts(notification, "fr");
  test.equal(texts.message, "en-US");
  test.done();
};
