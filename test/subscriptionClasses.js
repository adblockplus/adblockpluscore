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
let FilterNotifier = null;

exports.setUp = function(callback)
{
  let sandboxedRequire = createSandbox();
  ({Filter} = sandboxedRequire("../lib/filterClasses"));
  (
    {
      Subscription, SpecialSubscription, DownloadableSubscription
    } = sandboxedRequire("../lib/subscriptionClasses")
  );
  ({FilterNotifier} = sandboxedRequire("../lib/filterNotifier"));
  callback();
};

function compareSubscription(test, url, expected, postInit)
{
  expected.push("[Subscription]");
  let subscription = Subscription.fromURL(url);
  if (postInit)
    postInit(subscription);
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
  compareSubscription(test, "http://test/default_titled", ["url=http://test/default_titled", "title=test"], subscription =>
  {
    subscription.title = "test";
  });
  compareSubscription(test, "http://test/non_default", [
    "url=http://test/non_default", "title=test", "fixedTitle=true",
    "disabled=true", "lastSuccess=20015998341138",
    "lastDownload=5124097847590911", "lastCheck=18446744069414584320",
    "softExpiration=2682143778081159", "expires=4294967295",
    "downloadStatus=foo", "errors=3", "version=24", "requiredVersion=0.6"
  ], subscription =>
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
    subscription.version = 24;
    subscription.requiredVersion = "0.6";
  });
  compareSubscription(test, "~wl~", ["url=~wl~", "disabled=true", "title=Test group"], subscription =>
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
    compareSubscription(test, "~user~" + filters.join("~"), ["url=~user~" + filters.join("~"), "defaults= " + defaults], subscription =>
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

exports.testDownloadableSubscriptionFilters = function(test)
{
  let filter = Filter.fromText("test");

  let subscription = Subscription.fromURL("http://example.com/");
  test.equal(subscription.filterCount, 0, "Initial filter count");
  test.equal(subscription.filterAt(0), null, "Retrieving non-existent filter");
  test.equal(subscription.indexOfFilter(filter), -1, "Index of non-existent filter");

  subscription.delete();
  filter.delete();

  test.done();
};

exports.testSpecialSubscriptionFilters = function(test)
{
  let filter1 = Filter.fromText("filter1");
  let filter2 = Filter.fromText("filter2");
  let subscription = Subscription.fromURL("~user~12345");

  function checkFilterAt(pos, expected, message)
  {
    let filter = subscription.filterAt(pos);
    test.equal(filter && filter.text, expected, message);
    if (filter)
      filter.delete();
  }

  test.equal(subscription.filterCount, 0, "Initial filter count");
  checkFilterAt(0, null, "Retrieving non-existent filter");
  test.equal(subscription.indexOfFilter(filter1), -1, "Index of non-existent filter");

  subscription.insertFilterAt(filter1, 0);
  test.equal(subscription.filterCount, 1, "Filter count after insert");
  checkFilterAt(0, filter1.text, "First filter after insert");
  checkFilterAt(1, null, "Retrieving non-existent filter");
  test.equal(subscription.indexOfFilter(filter1), 0, "Index of existent filter");
  test.equal(subscription.indexOfFilter(filter2), -1, "Index of non-existent filter");

  subscription.insertFilterAt(filter2, 0);
  test.equal(subscription.filterCount, 2, "Filter count after second insert");
  checkFilterAt(0, filter2.text, "First filter after second insert");
  checkFilterAt(1, filter1.text, "Second filter after second insert");
  test.equal(subscription.indexOfFilter(filter1), 1, "Index of first filter");
  test.equal(subscription.indexOfFilter(filter2), 0, "Index of second filter");

  subscription.insertFilterAt(filter1, 1);
  test.equal(subscription.filterCount, 3, "Filter count after inserting duplicate filter");
  checkFilterAt(0, filter2.text, "First filter after inserting duplicate filter");
  checkFilterAt(1, filter1.text, "Second filter after inserting duplicate filter");
  checkFilterAt(2, filter1.text, "Third filter after inserting duplicate filter");
  test.equal(subscription.indexOfFilter(filter1), 1, "Index of first filter");

  subscription.removeFilterAt(1);
  test.equal(subscription.filterCount, 2, "Filter count after remove");
  checkFilterAt(0, filter2.text, "First filter after remove");
  checkFilterAt(1, filter1.text, "Second filter after remove");
  test.equal(subscription.indexOfFilter(filter1), 1, "Index of first filter");

  filter1.delete();
  filter2.delete();
  Filter.fromText("dummy overwriting some released memory").delete();
  checkFilterAt(0, "filter2", "First filter after releasing filter references");
  checkFilterAt(1, "filter1", "Second filter after releasing filter references");

  subscription.delete();

  test.done();
};

exports.testFilterSerialization = function(test)
{
  let filter1 = Filter.fromText("filter1");
  let filter2 = Filter.fromText("filter2");

  let subscription = Subscription.fromURL("~user~12345");
  test.equal(subscription.serializeFilters(), "", "No filters added");

  subscription.insertFilterAt(filter1, 0);
  subscription.insertFilterAt(filter1, 1);
  subscription.insertFilterAt(filter2, 1);
  test.equal(subscription.serializeFilters(), "[Subscription filters]\nfilter1\nfilter2\nfilter1\n", "Three filters added");

  subscription.removeFilterAt(0);
  test.equal(subscription.serializeFilters(), "[Subscription filters]\nfilter2\nfilter1\n", "One filter removed");

  subscription.delete();
  filter1.delete();
  filter2.delete();

  test.done();
};

exports.testNotifications = function(test)
{
  function checkNotifications(action, expected, message)
  {
    let result = null;
    let listener = (topic, subscription) =>
    {
      if (result)
        test.ok(false, "Got more that one notification - " + message);
      else
        result = [topic, subscription.url];
    };
    FilterNotifier.addListener(listener);
    action();
    FilterNotifier.removeListener(listener);
    test.deepEqual(result, expected, message);
  }

  let subscription = Subscription.fromURL("http://example.com/");
  checkNotifications(() =>
  {
    subscription.title = "foobar";
  }, ["subscription.title", "http://example.com/"], "Changing subscription title");
  checkNotifications(() =>
  {
    subscription.title = "foobar";
  }, null, "Setting subscription title to same value");
  checkNotifications(() =>
  {
    subscription.title = null;
  }, ["subscription.title", "http://example.com/"], "Resetting subscription title");

  checkNotifications(() =>
  {
    subscription.disabled = true;
  }, ["subscription.disabled", "http://example.com/"], "Disabling subscription");
  checkNotifications(() =>
  {
    subscription.disabled = true;
  }, null, "Disabling already disabled subscription");
  checkNotifications(() =>
  {
    subscription.disabled = false;
  }, ["subscription.disabled", "http://example.com/"], "Enabling subscription");

  checkNotifications(() =>
  {
    subscription.fixedTitle = true;
  }, ["subscription.fixedTitle", "http://example.com/"], "Marking title as fixed");
  checkNotifications(() =>
  {
    subscription.fixedTitle = false;
  }, ["subscription.fixedTitle", "http://example.com/"], "Marking title as editable");

  checkNotifications(() =>
  {
    subscription.homepage = "http://example.info/";
  }, ["subscription.homepage", "http://example.com/"], "Changing subscription homepage");
  checkNotifications(() =>
  {
    subscription.homepage = null;
  }, ["subscription.homepage", "http://example.com/"], "Resetting subscription homepage");

  checkNotifications(() =>
  {
    subscription.lastCheck = 1234;
  }, ["subscription.lastCheck", "http://example.com/"], "Changing subscription.lastCheck");
  checkNotifications(() =>
  {
    subscription.lastCheck = 1234;
  }, null, "Setting subscription.lastCheck to same value");
  checkNotifications(() =>
  {
    subscription.lastCheck = 0;
  }, ["subscription.lastCheck", "http://example.com/"], "Resetting subscription.lastCheck");

  checkNotifications(() =>
  {
    subscription.lastDownload = 4321;
  }, ["subscription.lastDownload", "http://example.com/"], "Changing subscription.lastDownload");
  checkNotifications(() =>
  {
    subscription.lastDownload = 0;
  }, ["subscription.lastDownload", "http://example.com/"], "Resetting subscription.lastDownload");

  checkNotifications(() =>
  {
    subscription.downloadStatus = "ok";
  }, ["subscription.downloadStatus", "http://example.com/"], "Changing subscription.downloadStatus");
  checkNotifications(() =>
  {
    subscription.downloadStatus = null;
  }, ["subscription.downloadStatus", "http://example.com/"], "Resetting subscription.downloadStatus");

  checkNotifications(() =>
  {
    subscription.errors++;
  }, ["subscription.errors", "http://example.com/"], "Increasing subscription.errors");
  checkNotifications(() =>
  {
    subscription.errors = 0;
  }, ["subscription.errors", "http://example.com/"], "Resetting subscription.erros");

  subscription.delete();
  test.done();
};
