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
let sandboxedRequire = null;

let filterStorage = null;
let Subscription = null;
let Filter = null;
let defaultMatcher = null;
let SpecialSubscription = null;

exports.setUp = function(callback)
{
  sandboxedRequire = createSandbox({
    extraExports: {
      elemHide: ["knownFilters"],
      elemHideEmulation: ["filters"],
      elemHideExceptions: ["knownExceptions"],
      snippets: ["filters"]
    }
  });

  // We need to require the filterListener module so that filter changes will be
  // noticed, even though we don't directly use the module here.
  sandboxedRequire("../lib/filterListener");

  (
    {filterStorage} = sandboxedRequire("../lib/filterStorage"),
    {Subscription, SpecialSubscription} = sandboxedRequire("../lib/subscriptionClasses"),
    {Filter} = sandboxedRequire("../lib/filterClasses"),
    {defaultMatcher} = sandboxedRequire("../lib/matcher")
  );

  filterStorage.addSubscription(Subscription.fromURL("~fl~"));
  filterStorage.addSubscription(Subscription.fromURL("~wl~"));
  filterStorage.addSubscription(Subscription.fromURL("~eh~"));

  Subscription.fromURL("~fl~").defaults = ["blocking"];
  Subscription.fromURL("~wl~").defaults = ["whitelist"];
  Subscription.fromURL("~eh~").defaults = ["elemhide"];

  callback();
};

function checkKnownFilters(test, text, expected)
{
  let result = {};
  for (let type of ["blacklist", "whitelist"])
  {
    let matcher = defaultMatcher["_" + type];
    let filters = [];
    for (let [keyword, set] of matcher._filterByKeyword)
    {
      for (let filter of set)
      {
        test.equal(matcher.findKeyword(filter), keyword,
                   "Keyword of filter " + filter.text);
        filters.push(filter.text);
      }
    }
    result[type] = filters;
  }

  let elemHide = sandboxedRequire("../lib/elemHide");
  result.elemhide = [];
  for (let filter of elemHide.knownFilters)
    result.elemhide.push(filter.text);

  let elemHideExceptions = sandboxedRequire("../lib/elemHideExceptions");
  result.elemhideexception = [];
  for (let exception of elemHideExceptions.knownExceptions)
    result.elemhideexception.push(exception.text);

  let elemHideEmulation = sandboxedRequire("../lib/elemHideEmulation");
  result.elemhideemulation = [];
  for (let filterText of elemHideEmulation.filters)
    result.elemhideemulation.push(filterText);

  let snippets = sandboxedRequire("../lib/snippets");
  result.snippets = [];
  for (let filterText of snippets.filters)
    result.snippets.push(filterText);

  let types = ["blacklist", "whitelist", "elemhide", "elemhideexception",
               "elemhideemulation", "snippets"];
  for (let type of types)
  {
    if (!(type in expected))
      expected[type] = [];
    else
      expected[type].sort();
    result[type].sort();
  }

  test.deepEqual(result, expected, text);
}

exports.testAddingAndRemovingFilters = function(test)
{
  let filter1 = Filter.fromText("filter1");
  let filter2 = Filter.fromText("@@filter2");
  let filter3 = Filter.fromText("##filter3");
  let filter4 = Filter.fromText("!filter4");
  let filter5 = Filter.fromText("#@#filter5");
  let filter6 = Filter.fromText("example.com#?#:-abp-properties(filter6')");
  let filter7 = Filter.fromText("example.com#@#[-abp-properties='filter7']");

  filterStorage.addFilter(filter1);
  checkKnownFilters(test, "add filter1", {blacklist: [filter1.text]});
  filterStorage.addFilter(filter2);
  checkKnownFilters(test, "add @@filter2", {blacklist: [filter1.text], whitelist: [filter2.text]});
  filterStorage.addFilter(filter3);
  checkKnownFilters(test, "add ##filter3", {blacklist: [filter1.text], whitelist: [filter2.text], elemhide: [filter3.text]});
  filterStorage.addFilter(filter4);
  checkKnownFilters(test, "add !filter4", {blacklist: [filter1.text], whitelist: [filter2.text], elemhide: [filter3.text]});
  filterStorage.addFilter(filter5);
  checkKnownFilters(test, "add #@#filter5", {blacklist: [filter1.text], whitelist: [filter2.text], elemhide: [filter3.text], elemhideexception: [filter5.text]});
  filterStorage.addFilter(filter6);
  checkKnownFilters(test, "add example.com##:-abp-properties(filter6)", {blacklist: [filter1.text], whitelist: [filter2.text], elemhide: [filter3.text], elemhideexception: [filter5.text], elemhideemulation: [filter6.text]});
  filterStorage.addFilter(filter7);
  checkKnownFilters(test, "add example.com#@#[-abp-properties='filter7']", {blacklist: [filter1.text], whitelist: [filter2.text], elemhide: [filter3.text], elemhideexception: [filter5.text, filter7.text], elemhideemulation: [filter6.text]});

  filterStorage.removeFilter(filter1);
  checkKnownFilters(test, "remove filter1", {whitelist: [filter2.text], elemhide: [filter3.text], elemhideexception: [filter5.text, filter7.text], elemhideemulation: [filter6.text]});
  filter2.disabled = true;
  checkKnownFilters(test, "disable filter2", {elemhide: [filter3.text], elemhideexception: [filter5.text, filter7.text], elemhideemulation: [filter6.text]});
  filterStorage.removeFilter(filter2);
  checkKnownFilters(test, "remove filter2", {elemhide: [filter3.text], elemhideexception: [filter5.text, filter7.text], elemhideemulation: [filter6.text]});
  filterStorage.removeFilter(filter4);
  checkKnownFilters(test, "remove filter4", {elemhide: [filter3.text], elemhideexception: [filter5.text, filter7.text], elemhideemulation: [filter6.text]});

  test.done();
};

exports.testDisablingEnablingFiltersNotInTheList = function(test)
{
  let filter1 = Filter.fromText("filter1");
  let filter2 = Filter.fromText("@@filter2");
  let filter3 = Filter.fromText("##filter3");
  let filter4 = Filter.fromText("#@#filter4");
  let filter5 = Filter.fromText("example.com#?#:-abp-properties(filter5)");
  let filter6 = Filter.fromText("example.com#@#[-abp-properties='filter6']");

  filter1.disabled = true;
  checkKnownFilters(test, "disable filter1 while not in list", {});
  filter1.disabled = false;
  checkKnownFilters(test, "enable filter1 while not in list", {});

  filter2.disabled = true;
  checkKnownFilters(test, "disable @@filter2 while not in list", {});
  filter2.disabled = false;
  checkKnownFilters(test, "enable @@filter2 while not in list", {});

  filter3.disabled = true;
  checkKnownFilters(test, "disable ##filter3 while not in list", {});
  filter3.disabled = false;
  checkKnownFilters(test, "enable ##filter3 while not in list", {});

  filter4.disabled = true;
  checkKnownFilters(test, "disable #@#filter4 while not in list", {});
  filter4.disabled = false;
  checkKnownFilters(test, "enable #@#filter4 while not in list", {});

  filter5.disabled = true;
  checkKnownFilters(test, "disable example.com#?#:-abp-properties(filter5) while not in list", {});
  filter5.disabled = false;
  checkKnownFilters(test, "enable example.com#?#:-abp-properties(filter5) while not in list", {});

  filter6.disabled = true;
  checkKnownFilters(test, "disable example.com#@#[-abp-properties='filter6'] while not in list", {});
  filter6.disabled = false;
  checkKnownFilters(test, "enable example.com#@#[-abp-properties='filter6'] while not in list", {});

  test.done();
};

exports.testFilterSubscriptionOperations = function(test)
{
  let filter1 = Filter.fromText("filter1");
  let filter2 = Filter.fromText("@@filter2");
  filter2.disabled = true;
  let filter3 = Filter.fromText("##filter3");
  let filter4 = Filter.fromText("!filter4");
  let filter5 = Filter.fromText("#@#filter5");
  let filter6 = Filter.fromText("example.com#?#:-abp-properties(filter6)");
  let filter7 = Filter.fromText("example.com#@#[-abp-properties='filter7']");

  let subscription = Subscription.fromURL("http://test1/");
  subscription.filters = [filter1, filter2, filter3, filter4, filter5, filter6, filter7];

  filterStorage.addSubscription(subscription);
  checkKnownFilters(test, "add subscription with filter1, @@filter2, ##filter3, !filter4, #@#filter5, example.com#?#:-abp-properties(filter6), example.com#@#[-abp-properties='filter7']", {blacklist: [filter1.text], elemhide: [filter3.text], elemhideexception: [filter5.text, filter7.text], elemhideemulation: [filter6.text]});

  filter2.disabled = false;
  checkKnownFilters(test, "enable @@filter2", {blacklist: [filter1.text], whitelist: [filter2.text], elemhide: [filter3.text], elemhideexception: [filter5.text, filter7.text], elemhideemulation: [filter6.text]});

  filterStorage.addFilter(filter1);
  checkKnownFilters(test, "add filter1", {blacklist: [filter1.text], whitelist: [filter2.text], elemhide: [filter3.text], elemhideexception: [filter5.text, filter7.text], elemhideemulation: [filter6.text]});

  filterStorage.updateSubscriptionFilters(subscription, [filter4]);
  checkKnownFilters(test, "change subscription filters to filter4", {blacklist: [filter1.text]});

  filterStorage.removeFilter(filter1);
  checkKnownFilters(test, "remove filter1", {});

  filterStorage.updateSubscriptionFilters(subscription, [filter1, filter2]);
  checkKnownFilters(test, "change subscription filters to filter1, filter2", {blacklist: [filter1.text], whitelist: [filter2.text]});

  filter1.disabled = true;
  checkKnownFilters(test, "disable filter1", {whitelist: [filter2.text]});
  filter2.disabled = true;
  checkKnownFilters(test, "disable filter2", {});
  filter1.disabled = false;
  filter2.disabled = false;
  checkKnownFilters(test, "enable filter1, filter2", {blacklist: [filter1.text], whitelist: [filter2.text]});

  filterStorage.addFilter(filter1);
  checkKnownFilters(test, "add filter1", {blacklist: [filter1.text], whitelist: [filter2.text]});

  subscription.disabled = true;
  checkKnownFilters(test, "disable subscription", {blacklist: [filter1.text]});

  filterStorage.removeSubscription(subscription);
  checkKnownFilters(test, "remove subscription", {blacklist: [filter1.text]});

  filterStorage.addSubscription(subscription);
  checkKnownFilters(test, "add subscription", {blacklist: [filter1.text]});

  subscription.disabled = false;
  checkKnownFilters(test, "enable subscription", {blacklist: [filter1.text], whitelist: [filter2.text]});

  subscription.disabled = true;
  checkKnownFilters(test, "disable subscription", {blacklist: [filter1.text]});

  filterStorage.addFilter(filter2);
  checkKnownFilters(test, "add filter2", {blacklist: [filter1.text], whitelist: [filter2.text]});

  filterStorage.removeFilter(filter2);
  checkKnownFilters(test, "remove filter2", {blacklist: [filter1.text]});

  subscription.disabled = false;
  checkKnownFilters(test, "enable subscription", {blacklist: [filter1.text], whitelist: [filter2.text]});

  filterStorage.removeSubscription(subscription);
  checkKnownFilters(test, "remove subscription", {blacklist: [filter1.text]});

  test.done();
};

exports.testFilterGroupOperations = function(test)
{
  let filter1 = Filter.fromText("filter1");
  let filter2 = Filter.fromText("@@filter2");
  let filter3 = Filter.fromText("filter3");
  let filter4 = Filter.fromText("@@filter4");
  let filter5 = Filter.fromText("!filter5");

  let subscription = Subscription.fromURL("http://test1/");
  subscription.filters = [filter1, filter2];

  filterStorage.addSubscription(subscription);
  filterStorage.addFilter(filter1);
  checkKnownFilters(test, "initial setup", {blacklist: [filter1.text], whitelist: [filter2.text]});

  let subscription2 = Subscription.fromURL("~fl~");
  subscription2.disabled = true;
  checkKnownFilters(test, "disable blocking filters", {blacklist: [filter1.text], whitelist: [filter2.text]});

  filterStorage.removeSubscription(subscription);
  checkKnownFilters(test, "remove subscription", {});

  subscription2.disabled = false;
  checkKnownFilters(test, "enable blocking filters", {blacklist: [filter1.text]});

  let subscription3 = Subscription.fromURL("~wl~");
  subscription3.disabled = true;
  checkKnownFilters(test, "disable exception rules", {blacklist: [filter1.text]});

  filterStorage.addFilter(filter2);
  checkKnownFilters(test, "add @@filter2", {blacklist: [filter1.text], whitelist: [filter2.text]});
  test.equal(filter2.subscriptionCount, 1, "@@filter2.subscriptionCount");
  test.ok([...filter2.subscriptions()][0] instanceof SpecialSubscription, "@@filter2 added to a new filter group");
  test.ok([...filter2.subscriptions()][0] != subscription3, "@@filter2 filter group is not the disabled exceptions group");

  subscription3.disabled = false;
  checkKnownFilters(test, "enable exception rules", {blacklist: [filter1.text], whitelist: [filter2.text]});

  filterStorage.removeFilter(filter2);
  filterStorage.addFilter(filter2);
  checkKnownFilters(test, "re-add @@filter2", {blacklist: [filter1.text], whitelist: [filter2.text]});
  test.equal(filter2.subscriptionCount, 1, "@@filter2.subscriptionCount");
  test.ok([...filter2.subscriptions()][0] == subscription3, "@@filter2 added to the default exceptions group");

  let subscription4 = Subscription.fromURL("http://test/");
  filterStorage.updateSubscriptionFilters(subscription4, [filter3, filter4, filter5]);
  checkKnownFilters(test, "update subscription not in the list yet", {blacklist: [filter1.text], whitelist: [filter2.text]});

  filterStorage.addSubscription(subscription4);
  checkKnownFilters(test, "add subscription to the list", {blacklist: [filter1.text, filter3.text], whitelist: [filter2.text, filter4.text]});

  filterStorage.updateSubscriptionFilters(subscription4, [filter3, filter2, filter5]);
  checkKnownFilters(test, "update subscription while in the list", {blacklist: [filter1.text, filter3.text], whitelist: [filter2.text]});

  subscription3.disabled = true;
  checkKnownFilters(test, "disable exception rules", {blacklist: [filter1.text, filter3.text], whitelist: [filter2.text]});

  filterStorage.removeSubscription(subscription4);
  checkKnownFilters(test, "remove subscription from the list", {blacklist: [filter1.text]});

  subscription3.disabled = false;
  checkKnownFilters(test, "enable exception rules", {blacklist: [filter1.text], whitelist: [filter2.text]});

  test.done();
};

exports.testSnippetFilters = function(test)
{
  let filter1 = Filter.fromText("example.com#$#filter1");
  let filter2 = Filter.fromText("example.com#$#filter2");
  let filter3 = Filter.fromText("example.com#$#filter3");

  let subscription1 = Subscription.fromURL("http://test1/");
  subscription1.filters = [filter1, filter2];

  filterStorage.addSubscription(subscription1);
  checkKnownFilters(test, "add subscription with filter1 and filter2", {});

  let subscription2 = Subscription.fromURL("http://test2/");
  subscription2.type = "circumvention";
  subscription2.filters = [filter1];

  filterStorage.addSubscription(subscription2);
  checkKnownFilters(test, "add subscription of type circumvention with filter1", {snippets: [filter1.text]});

  let subscription3 = Subscription.fromURL("~foo");
  subscription3.filters = [filter2];

  filterStorage.addSubscription(subscription3);
  checkKnownFilters(test, "add special subscription with filter2", {snippets: [filter1.text, filter2.text]});

  let subscription4 = Subscription.fromURL("https://easylist-downloads.adblockplus.org/abp-filters-anti-cv.txt");
  subscription4.filters = [filter3];

  filterStorage.addSubscription(subscription4);
  checkKnownFilters(test, "add ABP anti-circumvention subscription with filter3", {snippets: [filter1.text, filter2.text, filter3.text]});

  test.done();
};
