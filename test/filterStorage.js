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

const {createSandbox, silenceAssertionOutput} = require("./_common");

let Filter = null;
let FilterNotifier = null;
let FilterStorage = null;
let Subscription = null;

exports.setUp = function(callback)
{
  let sandboxedRequire = createSandbox();

  (
    {Filter} = sandboxedRequire("../lib/filterClasses"),
    {FilterNotifier} = sandboxedRequire("../lib/filterNotifier"),
    {FilterStorage} = sandboxedRequire("../lib/filterStorage"),
    {Subscription} = sandboxedRequire("../lib/subscriptionClasses")
  );

  callback();
};

function compareSubscriptionList(test, testMessage, list)
{
  let result = Array.from(FilterStorage.subscriptions, subscription => subscription.url);
  let expected = list.map(subscription => subscription.url);
  test.deepEqual(result, expected, testMessage);
}

function compareFiltersList(test, testMessage, list)
{
  let result = Array.from(FilterStorage.subscriptions, subscription =>
  {
    return Array.from(subscription.filters, filter => filter.text);
  });
  test.deepEqual(result, list, testMessage);
}

exports.testAddingRemovingSubscriptions = function(test)
{
  let subscription1 = Subscription.fromURL("http://test1/");
  let subscription2 = Subscription.fromURL("http://test2/");
  test.ok(!subscription1.listed, "First subscription not listed");
  test.ok(!subscription2.listed, "Second subscription not listed");

  let changes = [];
  function listener(action, subscription)
  {
    if (action.indexOf("subscription.") == 0)
      changes.push(action + " " + subscription.url);
  }
  FilterNotifier.addListener(listener);

  compareSubscriptionList(test, "Initial state", []);
  test.deepEqual(changes, [], "Received changes");

  changes = [];
  FilterStorage.addSubscription(subscription1);
  compareSubscriptionList(test, "Adding first subscription", [subscription1]);
  test.deepEqual(changes, ["subscription.added http://test1/"], "Received changes");
  test.ok(subscription1.listed, "First subscription listed");
  test.ok(!subscription2.listed, "Second subscription not listed");

  changes = [];
  FilterStorage.addSubscription(subscription1);
  compareSubscriptionList(test, "Adding already added subscription", [subscription1]);
  test.deepEqual(changes, [], "Received changes");
  test.ok(subscription1.listed, "First subscription listed");
  test.ok(!subscription2.listed, "Second subscription not listed");

  changes = [];
  FilterStorage.addSubscription(subscription2);
  compareSubscriptionList(test, "Adding second", [subscription1, subscription2]);
  test.deepEqual(changes, ["subscription.added http://test2/"], "Received changes");
  test.ok(subscription1.listed, "First subscription listed");
  test.ok(subscription2.listed, "Second subscription listed");

  changes = [];
  FilterStorage.removeSubscription(subscription1);
  compareSubscriptionList(test, "Remove", [subscription2]);
  test.deepEqual(changes, ["subscription.removed http://test1/"], "Received changes");
  test.ok(!subscription1.listed, "First subscription not listed");
  test.ok(subscription2.listed, "Second subscription listed");

  changes = [];
  FilterStorage.removeSubscription(subscription1);
  compareSubscriptionList(test, "Removing already removed subscription", [subscription2]);
  test.deepEqual(changes, [], "Received changes");
  test.ok(!subscription1.listed, "First subscription not listed");
  test.ok(subscription2.listed, "Second subscription listed");

  changes = [];
  FilterStorage.removeSubscription(subscription2);
  compareSubscriptionList(test, "Removing remaining subscription", []);
  test.deepEqual(changes, ["subscription.removed http://test2/"], "Received changes");
  test.ok(!subscription1.listed, "First subscription not listed");
  test.ok(!subscription2.listed, "Second subscription not listed");

  changes = [];
  FilterStorage.addSubscription(subscription2);
  compareSubscriptionList(test, "Re-adding previously removed subscription", [subscription2]);
  test.deepEqual(changes, ["subscription.added http://test2/"], "Received changes");
  test.ok(!subscription1.listed, "First subscription not listed");
  test.ok(subscription2.listed, "Second subscription listed");

  changes = [];
  FilterStorage.removeSubscription(subscription2);
  compareSubscriptionList(test, "Re-removing previously added subscription", []);
  test.deepEqual(changes, ["subscription.removed http://test2/"], "Received changes");
  test.ok(!subscription1.listed, "First subscription not listed");
  test.ok(!subscription2.listed, "Second subscription not listed");

  subscription1.delete();
  subscription2.delete();

  test.done();
};

exports.testMovingSubscriptions = function(test)
{
  let subscription1 = Subscription.fromURL("http://test1/");
  let subscription2 = Subscription.fromURL("http://test2/");
  let subscription3 = Subscription.fromURL("http://test3/");

  FilterStorage.addSubscription(subscription1);
  FilterStorage.addSubscription(subscription2);
  FilterStorage.addSubscription(subscription3);

  let changes = [];
  function listener(action, subscription)
  {
    if (action.indexOf("subscription.") == 0)
      changes.push(action + " " + subscription.url);
  }
  FilterNotifier.addListener(listener);

  compareSubscriptionList(test, "Initial state", [subscription1, subscription2, subscription3]);
  test.deepEqual(changes, [], "Received changes");

  changes = [];
  test.ok(FilterStorage.moveSubscription(subscription1), "Move without explicit position succeeded");
  compareSubscriptionList(test, "Move without explicit position", [subscription2, subscription3, subscription1]);
  test.deepEqual(changes, ["subscription.moved http://test1/"], "Received changes");

  changes = [];
  test.ok(!FilterStorage.moveSubscription(subscription1), "Move without explicit position failed (subscription already last)");
  compareSubscriptionList(test, "Move without explicit position (subscription already last)", [subscription2, subscription3, subscription1]);
  test.deepEqual(changes, [], "Received changes");

  changes = [];
  test.ok(FilterStorage.moveSubscription(subscription2, subscription1), "Move with explicit position succeeded");
  compareSubscriptionList(test, "Move with explicit position", [subscription3, subscription2, subscription1]);
  test.deepEqual(changes, ["subscription.moved http://test2/"], "Received changes");

  changes = [];
  test.ok(!FilterStorage.moveSubscription(subscription3, subscription2), "Move without explicit position failed (subscription already at position)");
  compareSubscriptionList(test, "Move without explicit position (subscription already at position)", [subscription3, subscription2, subscription1]);
  test.deepEqual(changes, [], "Received changes");

  FilterStorage.removeSubscription(subscription2);
  compareSubscriptionList(test, "Remove", [subscription3, subscription1]);

  changes = [];
  test.ok(FilterStorage.moveSubscription(subscription3, subscription2), "Move before removed subscription succeeded");
  compareSubscriptionList(test, "Move before removed subscription", [subscription1, subscription3]);
  test.deepEqual(changes, ["subscription.moved http://test3/"], "Received changes");

  changes = [];
  test.ok(!silenceAssertionOutput(
    () => FilterStorage.moveSubscription(subscription2),
    "Attempt to move a subscription that is not in the list"
  ), "Move of removed subscription failed");
  compareSubscriptionList(test, "Move of removed subscription", [subscription1, subscription3]);
  test.deepEqual(changes, [], "Received changes");

  subscription1.delete();
  subscription2.delete();
  subscription3.delete();

  test.done();
};

exports.testAddingRemovingFilters = function(test)
{
  function addFilter(text)
  {
    let filter = Filter.fromText(text);
    FilterStorage.addFilter(filter);
    filter.delete();
  }

  function removeFilter(text)
  {
    let filter = Filter.fromText(text);
    FilterStorage.removeFilter(filter);
    filter.delete();
  }


  let changes = [];
  function listener(action, filter, subscription, position)
  {
    if (action.indexOf("filter.") == 0)
    {
      changes.push([
        action, filter.text, FilterStorage.indexOfSubscription(subscription),
        position
      ].join(" "));
    }
  }
  FilterNotifier.addListener(listener);

  compareFiltersList(test, "Initial state", []);
  test.deepEqual(changes, [], "Received changes");

  changes = [];
  addFilter("foo");
  compareFiltersList(test, "Adding blocking filter", [["foo"]]);
  test.deepEqual(changes, ["filter.added foo 0 0"], "Received changes");

  changes = [];
  addFilter("@@bar");
  compareFiltersList(test, "Adding exception rule", [["foo"], ["@@bar"]]);
  test.deepEqual(changes, ["filter.added @@bar 1 0"], "Received changes");

  {
    let subscription = FilterStorage.subscriptionAt(1);
    let filter = Filter.fromText("##elemhide");
    subscription.makeDefaultFor(filter);
    filter.delete();
    subscription.delete();
  }

  {
    let subscription = Subscription.fromURL("~other");
    FilterStorage.addSubscription(subscription);
    subscription.delete();
  }

  test.deepEqual(Array.from(FilterStorage.subscriptions, s => s.isGeneric()),
      [false, false, true], "SpecialSubscription.isGeneric() result");

  changes = [];
  addFilter("foo##bar");
  compareFiltersList(test, "Adding hiding rule", [["foo"], ["@@bar", "foo##bar"], []]);
  test.deepEqual(changes, ["filter.added foo##bar 1 1"], "Received changes");

  changes = [];
  addFilter("foo#@#bar");
  compareFiltersList(test, "Adding hiding exception", [["foo"], ["@@bar", "foo##bar", "foo#@#bar"], []]);
  test.deepEqual(changes, ["filter.added foo#@#bar 1 2"], "Received changes");

  changes = [];
  addFilter("!foobar");
  compareFiltersList(test, "Adding comment", [["foo"], ["@@bar", "foo##bar", "foo#@#bar"], ["!foobar"]]);
  test.deepEqual(changes, ["filter.added !foobar 2 0"], "Received changes");

  changes = [];
  addFilter("foo");
  compareFiltersList(test, "Adding already added filter", [["foo"], ["@@bar", "foo##bar", "foo#@#bar"], ["!foobar"]]);
  test.deepEqual(changes, [], "Received changes");

  {
    let subscription = FilterStorage.subscriptionAt(0);
    subscription.disabled = true;
    subscription.delete();
  }

  changes = [];
  addFilter("foo");
  compareFiltersList(test, "Adding filter already in a disabled subscription", [["foo"], ["@@bar", "foo##bar", "foo#@#bar"], ["!foobar", "foo"]]);
  test.deepEqual(changes, ["filter.added foo 2 1"], "Received changes");

  changes = [];
  removeFilter("foo");
  compareFiltersList(test, "Removing filter", [[], ["@@bar", "foo##bar", "foo#@#bar"], ["!foobar"]]);
  test.deepEqual(changes, [
    "filter.removed foo 0 0",
    "filter.removed foo 2 1"
  ], "Received changes");

  changes = [];
  removeFilter("foo");
  compareFiltersList(test, "Removing unknown filter", [[], ["@@bar", "foo##bar", "foo#@#bar"], ["!foobar"]]);
  test.deepEqual(changes, [], "Received changes");

  test.done();
};
