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
let sandboxedRequire = null;

let FilterStorage = null;
let Subscription = null;
let Filter = null;
let defaultMatcher = null;
let SpecialSubscription = null;

exports.setUp = function(callback)
{
  sandboxedRequire = createSandbox({
    extraExports: {
      elemHide: ["filterByKey", "exceptions"],
      elemHideEmulation: ["filters"]
    }
  });

  // We need to require the filterListener module so that filter changes will be
  // noticed, even though we don't directly use the module here.
  sandboxedRequire("../lib/filterListener");

  (
    {FilterStorage} = sandboxedRequire("../lib/filterStorage"),
    {Subscription, SpecialSubscription} = sandboxedRequire("../lib/subscriptionClasses"),
    {Filter} = sandboxedRequire("../lib/filterClasses"),
    {defaultMatcher} = sandboxedRequire("../lib/matcher")
  );

  FilterStorage.addSubscription(Subscription.fromURL("~fl~"));
  FilterStorage.addSubscription(Subscription.fromURL("~wl~"));
  FilterStorage.addSubscription(Subscription.fromURL("~eh~"));

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
    let matcher = defaultMatcher[type];
    let filters = [];
    for (let keyword in matcher.filterByKeyword)
    {
      let list = matcher.filterByKeyword[keyword];
      for (let i = 0; i < list.length; i++)
      {
        let filter = list[i];
        test.equal(matcher.getKeywordForFilter(filter), keyword,
                   "Keyword of filter " + filter.text);
        filters.push(filter.text);
      }
    }
    result[type] = filters;
  }

  let elemHide = sandboxedRequire("../lib/elemHide");
  result.elemhide = [];
  for (let key in elemHide.filterByKey)
    result.elemhide.push(elemHide.filterByKey[key].text);

  result.elemhideexception = [];
  for (let selector in elemHide.exceptions)
  {
    let list = elemHide.exceptions[selector];
    for (let exception of list)
      result.elemhideexception.push(exception.text);
  }

  let elemHideEmulation = sandboxedRequire("../lib/elemHideEmulation");
  result.elemhideemulation = [];
  for (let filterText in elemHideEmulation.filters)
    result.elemhideemulation.push(filterText);

  let types = ["blacklist", "whitelist", "elemhide", "elemhideexception",
               "elemhideemulation"];
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

  FilterStorage.addFilter(filter1);
  checkKnownFilters(test, "add filter1", {blacklist: [filter1.text]});
  FilterStorage.addFilter(filter2);
  checkKnownFilters(test, "add @@filter2", {blacklist: [filter1.text], whitelist: [filter2.text]});
  FilterStorage.addFilter(filter3);
  checkKnownFilters(test, "add ##filter3", {blacklist: [filter1.text], whitelist: [filter2.text], elemhide: [filter3.text]});
  FilterStorage.addFilter(filter4);
  checkKnownFilters(test, "add !filter4", {blacklist: [filter1.text], whitelist: [filter2.text], elemhide: [filter3.text]});
  FilterStorage.addFilter(filter5);
  checkKnownFilters(test, "add #@#filter5", {blacklist: [filter1.text], whitelist: [filter2.text], elemhide: [filter3.text], elemhideexception: [filter5.text]});
  FilterStorage.addFilter(filter6);
  checkKnownFilters(test, "add example.com##:-abp-properties(filter6)", {blacklist: [filter1.text], whitelist: [filter2.text], elemhide: [filter3.text], elemhideexception: [filter5.text], elemhideemulation: [filter6.text]});
  FilterStorage.addFilter(filter7);
  checkKnownFilters(test, "add example.com#@#[-abp-properties='filter7']", {blacklist: [filter1.text], whitelist: [filter2.text], elemhide: [filter3.text], elemhideexception: [filter5.text, filter7.text], elemhideemulation: [filter6.text]});

  FilterStorage.removeFilter(filter1);
  checkKnownFilters(test, "remove filter1", {whitelist: [filter2.text], elemhide: [filter3.text], elemhideexception: [filter5.text, filter7.text], elemhideemulation: [filter6.text]});
  filter2.disabled = true;
  checkKnownFilters(test, "disable filter2", {elemhide: [filter3.text], elemhideexception: [filter5.text, filter7.text], elemhideemulation: [filter6.text]});
  FilterStorage.removeFilter(filter2);
  checkKnownFilters(test, "remove filter2", {elemhide: [filter3.text], elemhideexception: [filter5.text, filter7.text], elemhideemulation: [filter6.text]});
  FilterStorage.removeFilter(filter4);
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

  FilterStorage.addSubscription(subscription);
  checkKnownFilters(test, "add subscription with filter1, @@filter2, ##filter3, !filter4, #@#filter5, example.com#?#:-abp-properties(filter6), example.com#@#[-abp-properties='filter7']", {blacklist: [filter1.text], elemhide: [filter3.text], elemhideexception: [filter5.text, filter7.text], elemhideemulation: [filter6.text]});

  filter2.disabled = false;
  checkKnownFilters(test, "enable @@filter2", {blacklist: [filter1.text], whitelist: [filter2.text], elemhide: [filter3.text], elemhideexception: [filter5.text, filter7.text], elemhideemulation: [filter6.text]});

  FilterStorage.addFilter(filter1);
  checkKnownFilters(test, "add filter1", {blacklist: [filter1.text], whitelist: [filter2.text], elemhide: [filter3.text], elemhideexception: [filter5.text, filter7.text], elemhideemulation: [filter6.text]});

  FilterStorage.updateSubscriptionFilters(subscription, [filter4]);
  checkKnownFilters(test, "change subscription filters to filter4", {blacklist: [filter1.text]});

  FilterStorage.removeFilter(filter1);
  checkKnownFilters(test, "remove filter1", {});

  FilterStorage.updateSubscriptionFilters(subscription, [filter1, filter2]);
  checkKnownFilters(test, "change subscription filters to filter1, filter2", {blacklist: [filter1.text], whitelist: [filter2.text]});

  filter1.disabled = true;
  checkKnownFilters(test, "disable filter1", {whitelist: [filter2.text]});
  filter2.disabled = true;
  checkKnownFilters(test, "disable filter2", {});
  filter1.disabled = false;
  filter2.disabled = false;
  checkKnownFilters(test, "enable filter1, filter2", {blacklist: [filter1.text], whitelist: [filter2.text]});

  FilterStorage.addFilter(filter1);
  checkKnownFilters(test, "add filter1", {blacklist: [filter1.text], whitelist: [filter2.text]});

  subscription.disabled = true;
  checkKnownFilters(test, "disable subscription", {blacklist: [filter1.text]});

  FilterStorage.removeSubscription(subscription);
  checkKnownFilters(test, "remove subscription", {blacklist: [filter1.text]});

  FilterStorage.addSubscription(subscription);
  checkKnownFilters(test, "add subscription", {blacklist: [filter1.text]});

  subscription.disabled = false;
  checkKnownFilters(test, "enable subscription", {blacklist: [filter1.text], whitelist: [filter2.text]});

  subscription.disabled = true;
  checkKnownFilters(test, "disable subscription", {blacklist: [filter1.text]});

  FilterStorage.addFilter(filter2);
  checkKnownFilters(test, "add filter2", {blacklist: [filter1.text], whitelist: [filter2.text]});

  FilterStorage.removeFilter(filter2);
  checkKnownFilters(test, "remove filter2", {blacklist: [filter1.text]});

  subscription.disabled = false;
  checkKnownFilters(test, "enable subscription", {blacklist: [filter1.text], whitelist: [filter2.text]});

  FilterStorage.removeSubscription(subscription);
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

  FilterStorage.addSubscription(subscription);
  FilterStorage.addFilter(filter1);
  checkKnownFilters(test, "initial setup", {blacklist: [filter1.text], whitelist: [filter2.text]});

  let subscription2 = Subscription.fromURL("~fl~");
  subscription2.disabled = true;
  checkKnownFilters(test, "disable blocking filters", {blacklist: [filter1.text], whitelist: [filter2.text]});

  FilterStorage.removeSubscription(subscription);
  checkKnownFilters(test, "remove subscription", {});

  subscription2.disabled = false;
  checkKnownFilters(test, "enable blocking filters", {blacklist: [filter1.text]});

  let subscription3 = Subscription.fromURL("~wl~");
  subscription3.disabled = true;
  checkKnownFilters(test, "disable exception rules", {blacklist: [filter1.text]});

  FilterStorage.addFilter(filter2);
  checkKnownFilters(test, "add @@filter2", {blacklist: [filter1.text], whitelist: [filter2.text]});
  test.equal(filter2.subscriptions.length, 1, "@@filter2.subscription.length");
  test.ok(filter2.subscriptions[0] instanceof SpecialSubscription, "@@filter2 added to a new filter group");
  test.ok(filter2.subscriptions[0] != subscription3, "@@filter2 filter group is not the disabled exceptions group");

  subscription3.disabled = false;
  checkKnownFilters(test, "enable exception rules", {blacklist: [filter1.text], whitelist: [filter2.text]});

  FilterStorage.removeFilter(filter2);
  FilterStorage.addFilter(filter2);
  checkKnownFilters(test, "re-add @@filter2", {blacklist: [filter1.text], whitelist: [filter2.text]});
  test.equal(filter2.subscriptions.length, 1, "@@filter2.subscription.length");
  test.ok(filter2.subscriptions[0] == subscription3, "@@filter2 added to the default exceptions group");

  let subscription4 = Subscription.fromURL("http://test/");
  FilterStorage.updateSubscriptionFilters(subscription4, [filter3, filter4, filter5]);
  checkKnownFilters(test, "update subscription not in the list yet", {blacklist: [filter1.text], whitelist: [filter2.text]});

  FilterStorage.addSubscription(subscription4);
  checkKnownFilters(test, "add subscription to the list", {blacklist: [filter1.text, filter3.text], whitelist: [filter2.text, filter4.text]});

  FilterStorage.updateSubscriptionFilters(subscription4, [filter3, filter2, filter5]);
  checkKnownFilters(test, "update subscription while in the list", {blacklist: [filter1.text, filter3.text], whitelist: [filter2.text]});

  subscription3.disabled = true;
  checkKnownFilters(test, "disable exception rules", {blacklist: [filter1.text, filter3.text], whitelist: [filter2.text]});

  FilterStorage.removeSubscription(subscription4);
  checkKnownFilters(test, "remove subscription from the list", {blacklist: [filter1.text]});

  subscription3.disabled = false;
  checkKnownFilters(test, "enable exception rules", {blacklist: [filter1.text], whitelist: [filter2.text]});

  test.done();
};
