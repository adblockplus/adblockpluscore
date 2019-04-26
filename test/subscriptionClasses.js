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

const {createSandbox} = require("./_common");

let f$ = null;

let Subscription = null;
let SpecialSubscription = null;
let DownloadableSubscription = null;
let RegularSubscription = null;
let ExternalSubscription = null;
let Filter = null;

exports.setUp = function(callback)
{
  let sandboxedRequire = createSandbox();
  (
    {Subscription, SpecialSubscription,
     DownloadableSubscription, RegularSubscription,
     ExternalSubscription} = sandboxedRequire("../lib/subscriptionClasses"),
    {Filter} = sandboxedRequire("../lib/filterClasses")
  );

  f$ = Filter.fromText;

  callback();
};

function compareSubscription(test, url, expected, postInit)
{
  expected.push("[Subscription]");
  let subscription = Subscription.fromURL(url);
  if (postInit)
    postInit(subscription);
  let result = [...subscription.serialize()];
  test.equal(result.sort().join("\n"), expected.sort().join("\n"), url);

  let map = Object.create(null);
  for (let line of result.slice(1))
  {
    if (/(.*?)=(.*)/.test(line))
      map[RegExp.$1] = RegExp.$2;
  }
  let subscription2 = Subscription.fromObject(map);
  test.equal(subscription.toString(), subscription2.toString(), url + " deserialization");
}

function compareSubscriptionFilters(test, subscription, expected)
{
  test.deepEqual([...subscription.filterText()], expected);

  test.equal(subscription.filterCount, expected.length);

  for (let i = 0; i < subscription.filterCount; i++)
    test.equal(subscription.filterTextAt(i), expected[i]);

  test.ok(!subscription.filterTextAt(subscription.filterCount));
  test.ok(!subscription.filterTextAt(-1));
}

exports.testSubscriptionClassDefinitions = function(test)
{
  test.equal(typeof Subscription, "function", "typeof Subscription");
  test.equal(typeof SpecialSubscription, "function", "typeof SpecialSubscription");
  test.equal(typeof RegularSubscription, "function", "typeof RegularSubscription");
  test.equal(typeof ExternalSubscription, "function", "typeof ExternalSubscription");
  test.equal(typeof DownloadableSubscription, "function", "typeof DownloadableSubscription");

  test.done();
};

exports.testSubscriptionsWithState = function(test)
{
  compareSubscription(test, "~fl~", ["url=~fl~"]);
  compareSubscription(test, "http://test/default", ["url=http://test/default", "title=http://test/default"]);
  compareSubscription(
    test, "http://test/default_titled", ["url=http://test/default_titled", "title=test"],
    subscription =>
    {
      subscription.title = "test";
    }
  );
  compareSubscription(
    test, "http://test/non_default",
    [
      "url=http://test/non_default", "type=ads", "title=test", "disabled=true",
      "lastSuccess=8", "lastDownload=12", "lastCheck=16", "softExpiration=18",
      "expires=20", "downloadStatus=foo", "errors=3", "version=24",
      "requiredVersion=0.6"
    ],
    subscription =>
    {
      subscription.type = "ads";
      subscription.title = "test";
      subscription.disabled = true;
      subscription.lastSuccess = 8;
      subscription.lastDownload = 12;
      subscription.lastCheck = 16;
      subscription.softExpiration = 18;
      subscription.expires = 20;
      subscription.downloadStatus = "foo";
      subscription.errors = 3;
      subscription.version = 24;
      subscription.requiredVersion = "0.6";
    }
  );
  compareSubscription(
    test, "~wl~", ["url=~wl~", "disabled=true", "title=Test group"],
    subscription =>
    {
      subscription.title = "Test group";
      subscription.disabled = true;
    }
  );

  test.done();
};

exports.testFilterManagement = function(test)
{
  let subscription = Subscription.fromURL("https://example.com/");

  compareSubscriptionFilters(test, subscription, []);

  subscription.addFilter(f$("##.foo"));
  compareSubscriptionFilters(test, subscription, ["##.foo"]);
  test.equal(subscription.findFilterIndex(f$("##.foo")), 0);

  subscription.addFilter(f$("##.bar"));
  compareSubscriptionFilters(test, subscription, ["##.foo", "##.bar"]);
  test.equal(subscription.findFilterIndex(f$("##.bar")), 1);

  // Repeat filter.
  subscription.addFilter(f$("##.bar"));
  compareSubscriptionFilters(test, subscription, ["##.foo", "##.bar",
                                                  "##.bar"]);

  // The first occurrence is found.
  test.equal(subscription.findFilterIndex(f$("##.bar")), 1);

  subscription.deleteFilterAt(0);
  compareSubscriptionFilters(test, subscription, ["##.bar", "##.bar"]);
  test.equal(subscription.findFilterIndex(f$("##.bar")), 0);

  subscription.insertFilterAt(f$("##.foo"), 0);
  compareSubscriptionFilters(test, subscription, ["##.foo", "##.bar",
                                                  "##.bar"]);
  test.equal(subscription.findFilterIndex(f$("##.bar")), 1);

  subscription.deleteFilterAt(1);
  compareSubscriptionFilters(test, subscription, ["##.foo", "##.bar"]);
  test.equal(subscription.findFilterIndex(f$("##.bar")), 1);

  subscription.deleteFilterAt(1);
  compareSubscriptionFilters(test, subscription, ["##.foo"]);
  test.equal(subscription.findFilterIndex(f$("##.bar")), -1);

  subscription.addFilter(f$("##.bar"));
  compareSubscriptionFilters(test, subscription, ["##.foo", "##.bar"]);
  test.equal(subscription.findFilterIndex(f$("##.bar")), 1);

  subscription.clearFilters();
  compareSubscriptionFilters(test, subscription, []);
  test.equal(subscription.findFilterIndex(f$("##.foo")), -1);
  test.equal(subscription.findFilterIndex(f$("##.bar")), -1);

  subscription.addFilter(f$("##.bar"));
  compareSubscriptionFilters(test, subscription, ["##.bar"]);

  subscription.addFilter(f$("##.foo"));
  compareSubscriptionFilters(test, subscription, ["##.bar", "##.foo"]);
  test.equal(subscription.findFilterIndex(f$("##.bar")), 0);
  test.equal(subscription.findFilterIndex(f$("##.foo")), 1);

  // Insert outside of bounds.
  subscription.insertFilterAt(f$("##.lambda"), 1000);
  compareSubscriptionFilters(test, subscription, ["##.bar", "##.foo",
                                                  "##.lambda"]);
  test.equal(subscription.findFilterIndex(f$("##.lambda")), 2);

  // Delete outside of bounds.
  subscription.deleteFilterAt(1000);
  compareSubscriptionFilters(test, subscription, ["##.bar", "##.foo",
                                                  "##.lambda"]);
  test.equal(subscription.findFilterIndex(f$("##.lambda")), 2);

  // Insert outside of bounds (negative).
  subscription.insertFilterAt(f$("##.lambda"), -1000);
  compareSubscriptionFilters(test, subscription, ["##.lambda", "##.bar",
                                                  "##.foo", "##.lambda"]);
  test.equal(subscription.findFilterIndex(f$("##.lambda")), 0);

  // Delete outside of bounds (negative).
  subscription.deleteFilterAt(-1000);
  compareSubscriptionFilters(test, subscription, ["##.lambda", "##.bar",
                                                  "##.foo", "##.lambda"]);
  test.equal(subscription.findFilterIndex(f$("##.lambda")), 0);

  test.done();
};

exports.testSubscriptionDelta = function(test)
{
  let subscription = Subscription.fromURL("https://example.com/");

  subscription.addFilterText("##.foo");
  subscription.addFilterText("##.bar");

  compareSubscriptionFilters(test, subscription, ["##.foo", "##.bar"]);

  let delta = subscription.updateFilterText(["##.lambda", "##.foo"]);

  // The filters should be in the same order in which they were in the argument
  // to updateFilterText()
  compareSubscriptionFilters(test, subscription, ["##.lambda", "##.foo"]);

  test.deepEqual(delta, {added: ["##.lambda"], removed: ["##.bar"]});

  // Add ##.lambda a second time.
  subscription.addFilterText("##.lambda");
  compareSubscriptionFilters(test, subscription, ["##.lambda", "##.foo",
                                                  "##.lambda"]);

  delta = subscription.updateFilterText(["##.bar", "##.bar"]);

  // Duplicate filters should be allowed.
  compareSubscriptionFilters(test, subscription, ["##.bar", "##.bar"]);

  // If there are duplicates in the text, there should be duplicates in the
  // delta.
  test.deepEqual(delta, {
    added: ["##.bar", "##.bar"],
    removed: ["##.lambda", "##.foo", "##.lambda"]
  });

  test.done();
};
