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

const {createSandbox} = require("./_common");

let Filter = null;
let FilterNotifier = null;
let FilterStorage = null;
let Subscription = null;

exports.setUp = function(callback)
{
  let sandboxedRequire = createSandbox();

  sandboxedRequire("../lib/filterListener");
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
  let result = FilterStorage.subscriptions.map(subscription => subscription.url);
  let expected = list.map(subscription => subscription.url);
  test.deepEqual(result, expected, testMessage);
}

function compareFiltersList(test, testMessage, list)
{
  let result = FilterStorage.subscriptions.map(
    subscription => subscription.filters.map(
      filter => filter.text));
  test.deepEqual(result, list, testMessage);
}

function compareFilterSubscriptions(test, testMessage, filter, list)
{
  let result = filter.subscriptions.map(subscription => subscription.url);
  let expected = list.map(subscription => subscription.url);
  test.deepEqual(result, expected, testMessage);
}

exports.testAddingSubscriptions = function(test)
{
  let subscription1 = Subscription.fromURL("http://test1/");
  let subscription2 = Subscription.fromURL("http://test2/");

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
  compareSubscriptionList(test, "Regular add", [subscription1]);
  test.deepEqual(changes, ["subscription.added http://test1/"], "Received changes");

  changes = [];
  FilterStorage.addSubscription(subscription1);
  compareSubscriptionList(test, "Adding already added subscription", [subscription1]);
  test.deepEqual(changes, [], "Received changes");

  changes = [];
  FilterStorage.addSubscription(subscription2, true);
  compareSubscriptionList(test, "Silent add", [subscription1, subscription2]);
  test.deepEqual(changes, [], "Received changes");

  FilterStorage.removeSubscription(subscription1);
  compareSubscriptionList(test, "Remove", [subscription2]);

  changes = [];
  FilterStorage.addSubscription(subscription1);
  compareSubscriptionList(test, "Re-adding previously removed subscription", [subscription2, subscription1]);
  test.deepEqual(changes, ["subscription.added http://test1/"], "Received changes");

  test.done();
};

exports.testRemovingSubscriptions = function(test)
{
  let subscription1 = Subscription.fromURL("http://test1/");
  let subscription2 = Subscription.fromURL("http://test2/");
  FilterStorage.addSubscription(subscription1);
  FilterStorage.addSubscription(subscription2);

  let changes = [];
  function listener(action, subscription)
  {
    if (action.indexOf("subscription.") == 0)
      changes.push(action + " " + subscription.url);
  }
  FilterNotifier.addListener(listener);

  compareSubscriptionList(test, "Initial state", [subscription1, subscription2]);
  test.deepEqual(changes, [], "Received changes");

  changes = [];
  FilterStorage.removeSubscription(subscription1);
  compareSubscriptionList(test, "Regular remove", [subscription2]);
  test.deepEqual(changes, ["subscription.removed http://test1/"], "Received changes");

  changes = [];
  FilterStorage.removeSubscription(subscription1);
  compareSubscriptionList(test, "Removing already removed subscription", [subscription2]);
  test.deepEqual(changes, [], "Received changes");

  changes = [];
  FilterStorage.removeSubscription(subscription2, true);
  compareSubscriptionList(test, "Silent remove", []);
  test.deepEqual(changes, [], "Received changes");

  FilterStorage.addSubscription(subscription1);
  compareSubscriptionList(test, "Add", [subscription1]);

  changes = [];
  FilterStorage.removeSubscription(subscription1);
  compareSubscriptionList(test, "Re-removing previously added subscription", []);
  test.deepEqual(changes, ["subscription.removed http://test1/"], "Received changes");

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
  FilterStorage.moveSubscription(subscription1);
  compareSubscriptionList(test, "Move without explicit position", [subscription2, subscription3, subscription1]);
  test.deepEqual(changes, ["subscription.moved http://test1/"], "Received changes");

  changes = [];
  FilterStorage.moveSubscription(subscription1);
  compareSubscriptionList(test, "Move without explicit position (subscription already last)", [subscription2, subscription3, subscription1]);
  test.deepEqual(changes, [], "Received changes");

  changes = [];
  FilterStorage.moveSubscription(subscription2, subscription1);
  compareSubscriptionList(test, "Move with explicit position", [subscription3, subscription2, subscription1]);
  test.deepEqual(changes, ["subscription.moved http://test2/"], "Received changes");

  changes = [];
  FilterStorage.moveSubscription(subscription3, subscription2);
  compareSubscriptionList(test, "Move without explicit position (subscription already at position)", [subscription3, subscription2, subscription1]);
  test.deepEqual(changes, [], "Received changes");

  FilterStorage.removeSubscription(subscription2);
  compareSubscriptionList(test, "Remove", [subscription3, subscription1]);

  changes = [];
  FilterStorage.moveSubscription(subscription3, subscription2);
  compareSubscriptionList(test, "Move before removed subscription", [subscription1, subscription3]);
  test.deepEqual(changes, ["subscription.moved http://test3/"], "Received changes");

  changes = [];
  FilterStorage.moveSubscription(subscription2);
  compareSubscriptionList(test, "Move of removed subscription", [subscription1, subscription3]);
  test.deepEqual(changes, [], "Received changes");

  test.done();
};

exports.testAddingFilters = function(test)
{
  let subscription1 = Subscription.fromURL("~blocking");
  subscription1.defaults = ["blocking"];

  let subscription2 = Subscription.fromURL("~exceptions");
  subscription2.defaults = ["whitelist", "elemhide"];

  let subscription3 = Subscription.fromURL("~other");

  FilterStorage.addSubscription(subscription1);
  FilterStorage.addSubscription(subscription2);
  FilterStorage.addSubscription(subscription3);

  let changes = [];
  function listener(action, filter)
  {
    if (action.indexOf("filter.") == 0)
      changes.push(action + " " + filter.text);
  }
  FilterNotifier.addListener(listener);

  compareFiltersList(test, "Initial state", [[], [], []]);
  test.deepEqual(changes, [], "Received changes");

  changes = [];
  FilterStorage.addFilter(Filter.fromText("foo"));
  compareFiltersList(test, "Adding blocking filter", [["foo"], [], []]);
  test.deepEqual(changes, ["filter.added foo"], "Received changes");

  changes = [];
  FilterStorage.addFilter(Filter.fromText("@@bar"));
  compareFiltersList(test, "Adding exception rule", [["foo"], ["@@bar"], []]);
  test.deepEqual(changes, ["filter.added @@bar"], "Received changes");

  changes = [];
  FilterStorage.addFilter(Filter.fromText("foo#bar"));
  compareFiltersList(test, "Adding hiding rule", [["foo"], ["@@bar", "foo#bar"], []]);
  test.deepEqual(changes, ["filter.added foo#bar"], "Received changes");

  changes = [];
  FilterStorage.addFilter(Filter.fromText("foo#@#bar"));
  compareFiltersList(test, "Adding hiding exception", [["foo"], ["@@bar", "foo#bar", "foo#@#bar"], []]);
  test.deepEqual(changes, ["filter.added foo#@#bar"], "Received changes");

  changes = [];
  FilterStorage.addFilter(Filter.fromText("!foobar"), undefined, undefined, true);
  compareFiltersList(test, "Adding comment silent", [["foo"], ["@@bar", "foo#bar", "foo#@#bar"], ["!foobar"]]);
  test.deepEqual(changes, [], "Received changes");

  changes = [];
  FilterStorage.addFilter(Filter.fromText("foo"));
  compareFiltersList(test, "Adding already added filter", [["foo"], ["@@bar", "foo#bar", "foo#@#bar"], ["!foobar"]]);
  test.deepEqual(changes, [], "Received changes");

  subscription1.disabled = true;

  changes = [];
  FilterStorage.addFilter(Filter.fromText("foo"));
  compareFiltersList(test, "Adding filter already in a disabled subscription", [["foo"], ["@@bar", "foo#bar", "foo#@#bar"], ["!foobar", "foo"]]);
  test.deepEqual(changes, ["filter.added foo"], "Received changes");

  changes = [];
  FilterStorage.addFilter(Filter.fromText("foo"), subscription1);
  compareFiltersList(test, "Adding filter to an explicit subscription", [["foo", "foo"], ["@@bar", "foo#bar", "foo#@#bar"], ["!foobar", "foo"]]);
  test.deepEqual(changes, ["filter.added foo"], "Received changes");

  changes = [];
  FilterStorage.addFilter(Filter.fromText("!foobar"), subscription2, 0);
  compareFiltersList(test, "Adding filter to an explicit subscription with position", [["foo", "foo"], ["!foobar", "@@bar", "foo#bar", "foo#@#bar"], ["!foobar", "foo"]]);
  test.deepEqual(changes, ["filter.added !foobar"], "Received changes");

  test.done();
};

exports.testRemovingFilters = function(test)
{
  let subscription1 = Subscription.fromURL("~foo");
  subscription1.filters = [Filter.fromText("foo"), Filter.fromText("foo"), Filter.fromText("bar")];

  let subscription2 = Subscription.fromURL("~bar");
  subscription2.filters = [Filter.fromText("foo"), Filter.fromText("bar"), Filter.fromText("foo")];

  let subscription3 = Subscription.fromURL("http://test/");
  subscription3.filters = [Filter.fromText("foo"), Filter.fromText("bar")];

  FilterStorage.addSubscription(subscription1);
  FilterStorage.addSubscription(subscription2);
  FilterStorage.addSubscription(subscription3);

  let changes = [];
  function listener(action, filter)
  {
    if (action.indexOf("filter.") == 0)
      changes.push(action + " " + filter.text);
  }
  FilterNotifier.addListener(listener);

  compareFiltersList(test, "Initial state", [["foo", "foo", "bar"], ["foo", "bar", "foo"], ["foo", "bar"]]);
  test.deepEqual(changes, [], "Received changes");

  changes = [];
  FilterStorage.removeFilter(Filter.fromText("foo"), subscription2, 0);
  compareFiltersList(test, "Remove with explicit subscription and position", [["foo", "foo", "bar"], ["bar", "foo"], ["foo", "bar"]]);
  test.deepEqual(changes, ["filter.removed foo"], "Received changes");

  changes = [];
  FilterStorage.removeFilter(Filter.fromText("foo"), subscription2, 0);
  compareFiltersList(test, "Remove with explicit subscription and wrong position", [["foo", "foo", "bar"], ["bar", "foo"], ["foo", "bar"]]);
  test.deepEqual(changes, [], "Received changes");

  changes = [];
  FilterStorage.removeFilter(Filter.fromText("foo"), subscription1);
  compareFiltersList(test, "Remove with explicit subscription", [["bar"], ["bar", "foo"], ["foo", "bar"]]);
  test.deepEqual(changes, ["filter.removed foo", "filter.removed foo"], "Received changes");

  changes = [];
  FilterStorage.removeFilter(Filter.fromText("foo"), subscription1);
  compareFiltersList(test, "Remove from subscription not having the filter", [["bar"], ["bar", "foo"], ["foo", "bar"]]);
  test.deepEqual(changes, [], "Received changes");

  changes = [];
  FilterStorage.removeFilter(Filter.fromText("bar"));
  compareFiltersList(test, "Remove everywhere", [[], ["foo"], ["foo", "bar"]]);
  test.deepEqual(changes, ["filter.removed bar", "filter.removed bar"], "Received changes");

  changes = [];
  FilterStorage.removeFilter(Filter.fromText("bar"));
  compareFiltersList(test, "Remove of unknown filter", [[], ["foo"], ["foo", "bar"]]);
  test.deepEqual(changes, [], "Received changes");

  test.done();
};

exports.testMovingFilters = function(test)
{
  let subscription1 = Subscription.fromURL("~foo");
  subscription1.filters = [Filter.fromText("foo"), Filter.fromText("bar"), Filter.fromText("bas"), Filter.fromText("foo")];

  let subscription2 = Subscription.fromURL("http://test/");
  subscription2.filters = [Filter.fromText("foo"), Filter.fromText("bar")];

  FilterStorage.addSubscription(subscription1);
  FilterStorage.addSubscription(subscription2);

  let changes = [];
  function listener(action, filter)
  {
    if (action.indexOf("filter.") == 0)
      changes.push(action + " " + filter.text);
  }
  FilterNotifier.addListener(listener);

  compareFiltersList(test, "Initial state", [["foo", "bar", "bas", "foo"], ["foo", "bar"]]);
  test.deepEqual(changes, [], "Received changes");

  changes = [];
  FilterStorage.moveFilter(Filter.fromText("foo"), subscription1, 0, 1);
  compareFiltersList(test, "Regular move", [["bar", "foo", "bas", "foo"], ["foo", "bar"]]);
  test.deepEqual(changes, ["filter.moved foo"], "Received changes");

  changes = [];
  FilterStorage.moveFilter(Filter.fromText("foo"), subscription1, 0, 3);
  compareFiltersList(test, "Invalid move", [["bar", "foo", "bas", "foo"], ["foo", "bar"]]);
  test.deepEqual(changes, [], "Received changes");

  changes = [];
  FilterStorage.moveFilter(Filter.fromText("foo"), subscription2, 0, 1);
  compareFiltersList(test, "Invalid subscription", [["bar", "foo", "bas", "foo"], ["foo", "bar"]]);
  test.deepEqual(changes, [], "Received changes");

  changes = [];
  FilterStorage.moveFilter(Filter.fromText("foo"), subscription1, 1, 1);
  compareFiltersList(test, "Move to current position", [["bar", "foo", "bas", "foo"], ["foo", "bar"]]);
  test.deepEqual(changes, [], "Received changes");

  changes = [];
  FilterStorage.moveFilter(Filter.fromText("bar"), subscription1, 0, 1);
  compareFiltersList(test, "Regular move", [["foo", "bar", "bas", "foo"], ["foo", "bar"]]);
  test.deepEqual(changes, ["filter.moved bar"], "Received changes");

  test.done();
};

exports.testHitCounts = function(test)
{
  let changes = [];
  function listener(action, filter)
  {
    if (action.indexOf("filter.") == 0)
      changes.push(action + " " + filter.text);
  }
  FilterNotifier.addListener(listener);

  let filter1 = Filter.fromText("filter1");
  let filter2 = Filter.fromText("filter2");

  FilterStorage.addFilter(filter1);

  test.equal(filter1.hitCount, 0, "filter1 initial hit count");
  test.equal(filter2.hitCount, 0, "filter2 initial hit count");
  test.equal(filter1.lastHit, 0, "filter1 initial last hit");
  test.equal(filter2.lastHit, 0, "filter2 initial last hit");

  changes = [];
  FilterStorage.increaseHitCount(filter1);
  test.equal(filter1.hitCount, 1, "Hit count after increase (filter in list)");
  test.ok(filter1.lastHit > 0, "Last hit changed after increase");
  test.deepEqual(changes, ["filter.hitCount filter1", "filter.lastHit filter1"], "Received changes");

  changes = [];
  FilterStorage.increaseHitCount(filter2);
  test.equal(filter2.hitCount, 1, "Hit count after increase (filter not in list)");
  test.ok(filter2.lastHit > 0, "Last hit changed after increase");
  test.deepEqual(changes, ["filter.hitCount filter2", "filter.lastHit filter2"], "Received changes");

  changes = [];
  FilterStorage.resetHitCounts([filter1]);
  test.equal(filter1.hitCount, 0, "Hit count after reset");
  test.equal(filter1.lastHit, 0, "Last hit after reset");
  test.deepEqual(changes, ["filter.hitCount filter1", "filter.lastHit filter1"], "Received changes");

  changes = [];
  FilterStorage.resetHitCounts(null);
  test.equal(filter2.hitCount, 0, "Hit count after complete reset");
  test.equal(filter2.lastHit, 0, "Last hit after complete reset");
  test.deepEqual(changes, ["filter.hitCount filter2", "filter.lastHit filter2"], "Received changes");

  test.done();
};

exports.testFilterSubscriptionRelationship = function(test)
{
  let filter1 = Filter.fromText("filter1");
  let filter2 = Filter.fromText("filter2");
  let filter3 = Filter.fromText("filter3");

  let subscription1 = Subscription.fromURL("http://test1/");
  subscription1.filters = [filter1, filter2];

  let subscription2 = Subscription.fromURL("http://test2/");
  subscription2.filters = [filter2, filter3];

  let subscription3 = Subscription.fromURL("http://test3/");
  subscription3.filters = [filter1, filter2, filter3];

  compareFilterSubscriptions(test, "Initial filter1 subscriptions", filter1, []);
  compareFilterSubscriptions(test, "Initial filter2 subscriptions", filter2, []);
  compareFilterSubscriptions(test, "Initial filter3 subscriptions", filter3, []);

  FilterStorage.addSubscription(subscription1);

  compareFilterSubscriptions(test, "filter1 subscriptions after adding http://test1/", filter1, [subscription1]);
  compareFilterSubscriptions(test, "filter2 subscriptions after adding http://test1/", filter2, [subscription1]);
  compareFilterSubscriptions(test, "filter3 subscriptions after adding http://test1/", filter3, []);

  FilterStorage.addSubscription(subscription2);

  compareFilterSubscriptions(test, "filter1 subscriptions after adding http://test2/", filter1, [subscription1]);
  compareFilterSubscriptions(test, "filter2 subscriptions after adding http://test2/", filter2, [subscription1, subscription2]);
  compareFilterSubscriptions(test, "filter3 subscriptions after adding http://test2/", filter3, [subscription2]);

  FilterStorage.removeSubscription(subscription1);

  compareFilterSubscriptions(test, "filter1 subscriptions after removing http://test1/", filter1, []);
  compareFilterSubscriptions(test, "filter2 subscriptions after removing http://test1/", filter2, [subscription2]);
  compareFilterSubscriptions(test, "filter3 subscriptions after removing http://test1/", filter3, [subscription2]);

  FilterStorage.updateSubscriptionFilters(subscription3, [filter3]);

  compareFilterSubscriptions(test, "filter1 subscriptions after updating http://test3/ filters", filter1, []);
  compareFilterSubscriptions(test, "filter2 subscriptions after updating http://test3/ filters", filter2, [subscription2]);
  compareFilterSubscriptions(test, "filter3 subscriptions after updating http://test3/ filters", filter3, [subscription2]);

  FilterStorage.addSubscription(subscription3);

  compareFilterSubscriptions(test, "filter1 subscriptions after adding http://test3/", filter1, []);
  compareFilterSubscriptions(test, "filter2 subscriptions after adding http://test3/", filter2, [subscription2]);
  compareFilterSubscriptions(test, "filter3 subscriptions after adding http://test3/", filter3, [subscription2, subscription3]);

  FilterStorage.updateSubscriptionFilters(subscription3, [filter1, filter2]);

  compareFilterSubscriptions(test, "filter1 subscriptions after updating http://test3/ filters", filter1, [subscription3]);
  compareFilterSubscriptions(test, "filter2 subscriptions after updating http://test3/ filters", filter2, [subscription2, subscription3]);
  compareFilterSubscriptions(test, "filter3 subscriptions after updating http://test3/ filters", filter3, [subscription2]);

  FilterStorage.removeSubscription(subscription3);

  compareFilterSubscriptions(test, "filter1 subscriptions after removing http://test3/", filter1, []);
  compareFilterSubscriptions(test, "filter2 subscriptions after removing http://test3/", filter2, [subscription2]);
  compareFilterSubscriptions(test, "filter3 subscriptions after removing http://test3/", filter3, [subscription2]);

  test.done();
};
