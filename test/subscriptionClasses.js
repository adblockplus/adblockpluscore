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

let {createSandbox} = require("./_common");

let Filter = null;
let Subscription = null;
let SpecialSubscription = null;
let DownloadableSubscription = null;
let RegularSubscription = null;
let ExternalSubscription = null;

exports.setUp = function(callback)
{
  let sandboxedRequire = createSandbox();
  ({Filter} = sandboxedRequire("../lib/filterClasses"));
  (
    {
      Subscription, SpecialSubscription, DownloadableSubscription
    } = sandboxedRequire("../lib/subscriptionClasses")
  );
  callback();
};

function compareSubscription(test, url, expected, postInit)
{
  expected.push("[Subscription]")
  let subscription = Subscription.fromURL(url);
  if (postInit)
    postInit(subscription)
  let result = subscription.serialize().trim().split("\n");
  test.equal(result.sort().join("\n"), expected.sort().join("\n"), url);
  subscription.delete();
}

exports.testSubscriptionClassDefinitions = function(test)
{
  test.equal(typeof Subscription, "function", "typeof Subscription");
  test.equal(typeof SpecialSubscription, "function", "typeof SpecialSubscription");
  test.equal(typeof DownloadableSubscription, "function", "typeof DownloadableSubscription");

  test.done();
};

exports.testSubscriptionsWithState = function(test)
{
  compareSubscription(test, "~fl~", ["url=~fl~"]);
  compareSubscription(test, "http://test/default", ["url=http://test/default", "title=http://test/default"]);
  compareSubscription(test, "http://test/default_titled", ["url=http://test/default_titled", "title=test"], function(subscription)
  {
    subscription.title = "test";
  });
  compareSubscription(test, "http://test/non_default", [
    "url=http://test/non_default", "title=test", "fixedTitle=true",
    "disabled=true", "lastSuccess=20015998341138",
    "lastDownload=5124097847590911", "lastCheck=18446744069414584320",
    "softExpiration=2682143778081159", "expires=4294967295",
    "downloadStatus=foo", "errors=3", "version=24", "requiredVersion=0.6"
  ], function(subscription)
  {
    subscription.title = "test";
    subscription.fixedTitle = true;
    subscription.disabled = true;
    subscription.lastSuccess = 20015998341138;       // 0x123456789012
    subscription.lastDownload = 5124097847590911;    // 0x123456FFFFFFFF
    subscription.lastCheck = 18446744069414584320;   // 0xFFFFFFFF00000000
    subscription.softExpiration = 2682143778081159;  // 0x9876543210987
    subscription.expires = 4294967295;               // 0xFFFFFFFF
    subscription.downloadStatus = "foo";
    subscription.errors = 3;
    subscription.version = 24
    subscription.requiredVersion = "0.6";
  });
  compareSubscription(test, "~wl~", ["url=~wl~", "disabled=true", "title=Test group"], function(subscription)
  {
    subscription.title = "Test group";
    subscription.disabled = true;
  });

  test.done();
};

exports.testDefaultSubscriptionIDs = function(test)
{
  let subscription1 = Subscription.fromURL(null);
  test.ok(subscription1 instanceof SpecialSubscription, "Special subscription returned by default");
  test.ok(subscription1.url.startsWith("~user~"), "Prefix for default subscription IDs");

  let subscription2 = Subscription.fromURL(null);
  test.ok(subscription2 instanceof SpecialSubscription, "Special subscription returned by default");
  test.ok(subscription2.url.startsWith("~user~"), "Prefix for default subscription IDs");
  test.notEqual(subscription1.url, subscription2.url, "Second call creates new subscription");

  subscription1.delete();
  subscription2.delete();

  test.done();
};

exports.testSubscriptionDefaults = function(test)
{
  let tests = [
    ["blocking", "test"],
    ["whitelist", "@@test"],
    ["elemhide", "##test"],
    ["elemhide", "#@#test"],
    ["elemhide", "foo##[-abp-properties='foo']"],
    ["blocking", "!test"],
    ["blocking", "/??/"],
    ["blocking whitelist", "test", "@@test"],
    ["blocking elemhide", "test", "##test"]
  ];

  for (let [defaults, ...filters] of tests)
  {
    compareSubscription(test, "~user~" + filters.join("~"), ["url=~user~" + filters.join("~"), "defaults= " + defaults], function(subscription)
    {
      for (let text of filters)
      {
        let filter = Filter.fromText(text);
        subscription.makeDefaultFor(filter);
        filter.delete();
      }
    });
  }
  test.done();
};

exports.testGC = function(test)
{
  let subscription1 = Subscription.fromURL("http://example.com/");
  test.equal(subscription1.lastDownload, 0, "Initial download time");

  subscription1.lastDownload = 432;

  let subscription2 = Subscription.fromURL("http://example.com/");
  test.equal(subscription2.lastDownload, 432, "Known subscription returned");

  subscription2.lastDownload = 234;
  test.equal(subscription1.lastDownload, 234, "Changing second wrapper modifies original as well");

  subscription1.delete();
  subscription2.delete();

  let subscription3 = Subscription.fromURL("http://example.com/");
  test.equal(subscription3.lastDownload, 0, "Subscription data has been reset once previous instances have been released");
  subscription3.delete();

  test.done();
};
