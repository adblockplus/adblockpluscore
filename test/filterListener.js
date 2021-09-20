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
const {LIB_FOLDER, createSandbox} = require("./_common");
let sandboxedRequire = null;

let IO = null;
let filterStorage = null;
let filterEngine = null;
let Subscription = null;
let Filter = null;
let defaultMatcher = null;
let SpecialSubscription = null;
let recommendations = null;
let filterState = null;

describe("Filter listener", function() {
  // {module:matcher.findKeyword()} will not do what you expect.
  // This function will get the keyword for a filter using the
  // internal data.
  // This is not an API to be used.
  function keywordForFilter(filter, matcher) {
    return matcher._keywordByFilter.get(filter);
  }

  function checkKnownFilters(text, expected) {
    let result = {};
    for (let type of ["blocking", "allowing"]) {
      let matcher = defaultMatcher["_" + type];
      let filters = [];
      for (let map of [matcher._simpleFiltersByKeyword,
                       matcher._complexFiltersByKeyword]) {
        for (let [keyword, set] of map) {
          for (let filter of set) {
            assert.equal(keywordForFilter(filter, matcher), keyword, "Keyword of filter " + filter.text);
            filters.push(filter.text);
          }
        }
      }
      result[type] = filters;
    }

    let {elemHide} = sandboxedRequire(LIB_FOLDER + "/elemHide");
    result.elemhide = [];
    for (let filter of elemHide._filters)
      result.elemhide.push(filter.text);

    let {elemHideExceptions} = sandboxedRequire(LIB_FOLDER + "/elemHideExceptions");
    result.elemhideexception = [];
    for (let exception of elemHideExceptions._exceptions)
      result.elemhideexception.push(exception.text);

    let {elemHideEmulation} = sandboxedRequire(LIB_FOLDER + "/elemHideEmulation");
    result.elemhideemulation = [];
    for (let filter of elemHideEmulation)
      result.elemhideemulation.push(filter.text);

    let {snippets} = sandboxedRequire(LIB_FOLDER + "/snippets");
    result.snippets = [];
    for (let filter of snippets._filters)
      result.snippets.push(filter.text);

    let types = ["blocking", "allowing", "elemhide", "elemhideexception",
                 "elemhideemulation", "snippets"];
    for (let type of types) {
      if (!(type in expected))
        expected[type] = [];
      else
        expected[type].sort();
      result[type].sort();
    }

    assert.deepEqual(result, expected, text);
  }

  beforeEach(function() {
    sandboxedRequire = createSandbox();

    (
      {IO} = sandboxedRequire("./stub-modules/io"),
      {filterStorage} = sandboxedRequire(LIB_FOLDER + "/filterStorage"),
      {filterEngine} = sandboxedRequire(LIB_FOLDER + "/filterEngine"),
      {defaultMatcher} = sandboxedRequire(LIB_FOLDER + "/matcher")
    );
  });

  it("Initialization", async function() {
    IO._setFileContents(filterStorage.sourceFile, `
      version=5

      [Subscription]
      url=~user~12345

      [Subscription filters]
      ^foo^
      ||example.com^

      [Subscription]
      url=https://example.com/list.txt
      title=Example List
      homepage=https://example.com/

      [Subscription filters]
      ^foo^
      ^bar^
      ##.foo
      example.com##.bar
      example.com#?#.foo:-abp-contains(Ad)
      example.com#@#.foo
      @@$domain=example.com
      example.com#$#foo Ad
    `
    .split(/\s*\n\s*/));

    let promise = filterEngine.initialize();
    checkKnownFilters("No filters ready", {});
    await promise;

    checkKnownFilters("All filters ready", {
      blocking: ["^foo^", "||example.com^", "^bar^"],
      allowing: ["@@$domain=example.com"],
      elemhide: ["##.foo", "example.com##.bar"],
      elemhideexception: ["example.com#@#.foo"],
      elemhideemulation: ["example.com#?#.foo:-abp-contains(Ad)"],

      // Note: By design, only snippet filters from a subscription of type
      // "circumvention" are taken into account (#6781).
      snippets: []
    });
  });

  describe("Synchronization", function() {
    beforeEach(async function() {
      await filterEngine.initialize();

      (
        {Subscription, SpecialSubscription} = sandboxedRequire(LIB_FOLDER + "/subscriptionClasses"),
        {Filter} = sandboxedRequire(LIB_FOLDER + "/filterClasses"),
        recommendations = sandboxedRequire("../data/subscriptions.json"),
        {filterState} = sandboxedRequire(LIB_FOLDER + "/filterState")
      );

      filterStorage.addSubscription(Subscription.fromURL("~user~fl"));
      filterStorage.addSubscription(Subscription.fromURL("~user~wl"));
      filterStorage.addSubscription(Subscription.fromURL("~user~eh"));

      Subscription.fromURL("~user~fl").defaults = ["blocking"];
      Subscription.fromURL("~user~wl").defaults = ["allowing"];
      Subscription.fromURL("~user~eh").defaults = ["elemhide"];
    });

    it("Adding/removing filters", function() {
      let filter1 = Filter.fromText("filter1");
      let filter2 = Filter.fromText("@@filter2");
      let filter3 = Filter.fromText("##filter3");
      let filter4 = Filter.fromText("!filter4");
      let filter5 = Filter.fromText("#@#filter5");
      let filter6 = Filter.fromText("example.com#?#:-abp-properties(filter6')");
      let filter7 = Filter.fromText("example.com#@#[-abp-properties='filter7']");
      let filter8 = Filter.fromText("||example.com/ad.js");

      filterStorage.addFilter(filter1);
      checkKnownFilters("add filter1", {blocking: [filter1.text]});
      filterStorage.addFilter(filter2);
      checkKnownFilters("add @@filter2", {blocking: [filter1.text], allowing: [filter2.text]});
      filterStorage.addFilter(filter3);
      checkKnownFilters("add ##filter3", {blocking: [filter1.text], allowing: [filter2.text], elemhide: [filter3.text]});
      filterStorage.addFilter(filter4);
      checkKnownFilters("add !filter4", {blocking: [filter1.text], allowing: [filter2.text], elemhide: [filter3.text]});
      filterStorage.addFilter(filter5);
      checkKnownFilters("add #@#filter5", {blocking: [filter1.text], allowing: [filter2.text], elemhide: [filter3.text], elemhideexception: [filter5.text]});
      filterStorage.addFilter(filter6);
      checkKnownFilters("add example.com##:-abp-properties(filter6)", {blocking: [filter1.text], allowing: [filter2.text], elemhide: [filter3.text], elemhideexception: [filter5.text], elemhideemulation: [filter6.text]});
      filterStorage.addFilter(filter7);
      checkKnownFilters("add example.com#@#[-abp-properties='filter7']", {blocking: [filter1.text], allowing: [filter2.text], elemhide: [filter3.text], elemhideexception: [filter5.text, filter7.text], elemhideemulation: [filter6.text]});
      filterStorage.addFilter(filter8);
      checkKnownFilters("add ||example.com/ad.js", {blocking: [filter1.text, filter8.text], allowing: [filter2.text], elemhide: [filter3.text], elemhideexception: [filter5.text, filter7.text], elemhideemulation: [filter6.text]});

      filterStorage.removeFilter(filter8);
      checkKnownFilters("remove filter8", {blocking: [filter1.text], allowing: [filter2.text], elemhide: [filter3.text], elemhideexception: [filter5.text, filter7.text], elemhideemulation: [filter6.text]});

      filterStorage.removeFilter(filter1);
      checkKnownFilters("remove filter1", {allowing: [filter2.text], elemhide: [filter3.text], elemhideexception: [filter5.text, filter7.text], elemhideemulation: [filter6.text]});
      filter2.disabled = true;
      checkKnownFilters("disable filter2", {elemhide: [filter3.text], elemhideexception: [filter5.text, filter7.text], elemhideemulation: [filter6.text]});
      filterStorage.removeFilter(filter2);
      checkKnownFilters("remove filter2", {elemhide: [filter3.text], elemhideexception: [filter5.text, filter7.text], elemhideemulation: [filter6.text]});
      filterStorage.removeFilter(filter4);
      checkKnownFilters("remove filter4", {elemhide: [filter3.text], elemhideexception: [filter5.text, filter7.text], elemhideemulation: [filter6.text]});
    });

    it("Disabling/enabling filters not in the list", function() {
      let filter1 = Filter.fromText("filter1");
      let filter2 = Filter.fromText("@@filter2");
      let filter3 = Filter.fromText("##filter3");
      let filter4 = Filter.fromText("#@#filter4");
      let filter5 = Filter.fromText("example.com#?#:-abp-properties(filter5)");
      let filter6 = Filter.fromText("example.com#@#[-abp-properties='filter6']");

      filter1.disabled = true;
      checkKnownFilters("disable filter1 while not in list", {});
      filter1.disabled = false;
      checkKnownFilters("enable filter1 while not in list", {});
      filter1.setDisabledForSubscription("~user", true);
      checkKnownFilters("disable filter1 per subscription while not in list", {});
      filter1.setDisabledForSubscription("~user", false);
      checkKnownFilters("enable filter1 per subscription while not in list", {});

      filter2.disabled = true;
      checkKnownFilters("disable @@filter2 while not in list", {});
      filter2.disabled = false;
      checkKnownFilters("enable @@filter2 while not in list", {});

      filter3.disabled = true;
      checkKnownFilters("disable ##filter3 while not in list", {});
      filter3.disabled = false;
      checkKnownFilters("enable ##filter3 while not in list", {});

      filter4.disabled = true;
      checkKnownFilters("disable #@#filter4 while not in list", {});
      filter4.disabled = false;
      checkKnownFilters("enable #@#filter4 while not in list", {});

      filter5.disabled = true;
      checkKnownFilters("disable example.com#?#:-abp-properties(filter5) while not in list", {});
      filter5.disabled = false;
      checkKnownFilters("enable example.com#?#:-abp-properties(filter5) while not in list", {});

      filter6.disabled = true;
      checkKnownFilters("disable example.com#@#[-abp-properties='filter6'] while not in list", {});
      filter6.disabled = false;
      checkKnownFilters("enable example.com#@#[-abp-properties='filter6'] while not in list", {});
    });

    it("Filter subscription operations", function() {
      let filter1 = Filter.fromText("filter1");
      let filter2 = Filter.fromText("@@filter2");
      filter2.disabled = true;
      let filter3 = Filter.fromText("##filter3");
      let filter4 = Filter.fromText("!filter4");
      let filter5 = Filter.fromText("#@#filter5");
      let filter6 = Filter.fromText("example.com#?#:-abp-properties(filter6)");
      let filter7 = Filter.fromText("example.com#@#[-abp-properties='filter7']");

      let subscription = Subscription.fromURL("https://test1/");
      subscription.addFilter(filter1);
      subscription.addFilter(filter2);
      subscription.addFilter(filter3);
      subscription.addFilter(filter4);
      subscription.addFilter(filter5);
      subscription.addFilter(filter6);
      subscription.addFilter(filter7);

      filterStorage.addSubscription(subscription);
      checkKnownFilters("add subscription with filter1, @@filter2, ##filter3, !filter4, #@#filter5, example.com#?#:-abp-properties(filter6), example.com#@#[-abp-properties='filter7']", {blocking: [filter1.text], elemhide: [filter3.text], elemhideexception: [filter5.text, filter7.text], elemhideemulation: [filter6.text]});

      filter2.disabled = false;
      checkKnownFilters("enable @@filter2", {blocking: [filter1.text], allowing: [filter2.text], elemhide: [filter3.text], elemhideexception: [filter5.text, filter7.text], elemhideemulation: [filter6.text]});

      filterStorage.addFilter(filter1);
      checkKnownFilters("add filter1", {blocking: [filter1.text], allowing: [filter2.text], elemhide: [filter3.text], elemhideexception: [filter5.text, filter7.text], elemhideemulation: [filter6.text]});

      filterStorage.updateSubscriptionFilters(subscription, [filter4.text]);
      checkKnownFilters("change subscription filters to filter4", {blocking: [filter1.text]});

      filterStorage.removeFilter(filter1);
      checkKnownFilters("remove filter1", {});

      filterStorage.updateSubscriptionFilters(subscription, [filter1.text, filter2.text]);
      checkKnownFilters("change subscription filters to filter1, filter2", {blocking: [filter1.text], allowing: [filter2.text]});

      filter1.disabled = true;
      checkKnownFilters("disable filter1", {allowing: [filter2.text]});
      filter2.disabled = true;
      checkKnownFilters("disable filter2", {});
      filter1.disabled = false;
      filter2.disabled = false;
      checkKnownFilters("enable filter1, filter2", {blocking: [filter1.text], allowing: [filter2.text]});

      filterState.setEnabled(filter1.text, false);
      checkKnownFilters("disable filter1", {allowing: [filter2.text]});
      filterState.reset(filter1.text);
      checkKnownFilters("enabled filter1 with filterState.reset", {blocking: [filter1.text], allowing: [filter2.text]});

      filterStorage.addFilter(filter1);
      checkKnownFilters("add filter1", {blocking: [filter1.text], allowing: [filter2.text]});

      subscription.disabled = true;
      checkKnownFilters("disable subscription", {blocking: [filter1.text]});

      filterStorage.removeSubscription(subscription);
      checkKnownFilters("remove subscription", {blocking: [filter1.text]});

      filterStorage.addSubscription(subscription);
      checkKnownFilters("add subscription", {blocking: [filter1.text]});

      subscription.disabled = false;
      checkKnownFilters("enable subscription", {blocking: [filter1.text], allowing: [filter2.text]});

      subscription.disabled = true;
      checkKnownFilters("disable subscription", {blocking: [filter1.text]});

      filterStorage.addFilter(filter2);
      checkKnownFilters("add filter2", {blocking: [filter1.text], allowing: [filter2.text]});

      filterStorage.removeFilter(filter2);
      checkKnownFilters("remove filter2", {blocking: [filter1.text]});

      subscription.disabled = false;
      checkKnownFilters("enable subscription", {blocking: [filter1.text], allowing: [filter2.text]});

      filterStorage.removeSubscription(subscription);
      checkKnownFilters("remove subscription", {blocking: [filter1.text]});
    });

    it("Filter subscription operations with multiple subscriptions", function() {
      let filter1 = Filter.fromText("filter1");
      let filter2 = Filter.fromText("@@filter2");
      let filter3 = Filter.fromText("##filter3");

      let subscription1 = Subscription.fromURL("https://test1/");
      let subscription2 = Subscription.fromURL("https://test2/");
      subscription1.addFilter(filter1);
      subscription2.addFilter(filter2);
      subscription1.addFilter(filter3);
      subscription2.addFilter(filter3);

      filterStorage.addSubscription(subscription1);
      filterStorage.addSubscription(subscription2);
      checkKnownFilters("add subscription with filter1, @@filter2, ##filter3", {blocking: [filter1.text], allowing: [filter2.text], elemhide: [filter3.text]});

      filter1.setDisabledForSubscription("https://test1/", true);
      checkKnownFilters("disable filter1 for https://test1/", {blocking: [], allowing: [filter2.text], elemhide: [filter3.text]});
      filter1.setDisabledForSubscription("https://test2/", true);
      checkKnownFilters("disable filter1 for https://test2/", {blocking: [], allowing: [filter2.text], elemhide: [filter3.text]});
      filter1.setDisabledForSubscription("https://test1/", false);
      checkKnownFilters("enable filter1 for https://test1/", {blocking: [filter1.text], allowing: [filter2.text], elemhide: [filter3.text]});
      filter1.setDisabledForSubscription("https://test2/", false);
      checkKnownFilters("enable filter1 for https://test2/", {blocking: [filter1.text], allowing: [filter2.text], elemhide: [filter3.text]});

      filter2.setDisabledForSubscription("https://test1/", true);
      checkKnownFilters("disable @@filter2 for https://test1/", {blocking: [filter1.text], allowing: [filter2.text], elemhide: [filter3.text]});
      filter2.setDisabledForSubscription("https://test2/", true);
      checkKnownFilters("disable @@filter2 for https://test2/", {blocking: [filter1.text], allowing: [], elemhide: [filter3.text]});
      filter2.setDisabledForSubscription("https://test1/", false);
      checkKnownFilters("enable @@filter2 for https://test1/", {blocking: [filter1.text], allowing: [], elemhide: [filter3.text]});
      filter2.setDisabledForSubscription("https://test2/", false);
      checkKnownFilters("enable @@filter2 for https://test2/", {blocking: [filter1.text], allowing: [filter2.text], elemhide: [filter3.text]});

      filter3.setDisabledForSubscription("https://test1/", true);
      checkKnownFilters("disable ##filter3 for https://test1/", {blocking: [filter1.text], allowing: [filter2.text], elemhide: [filter3.text]});
      filter3.setDisabledForSubscription("https://test2/", true);
      checkKnownFilters("disable ##filter3 for https://test2/", {blocking: [filter1.text], allowing: [filter2.text], elemhide: []});
      filter3.setDisabledForSubscription("https://test1/", false);
      checkKnownFilters("enable ##filter3 for https://test1/", {blocking: [filter1.text], allowing: [filter2.text], elemhide: [filter3.text]});
      filter3.setDisabledForSubscription("https://test2/", false);
      checkKnownFilters("enable ##filter3 for https://test2/", {blocking: [filter1.text], allowing: [filter2.text], elemhide: [filter3.text]});
    });

    it("Filter group operations", function() {
      let filter1 = Filter.fromText("filter1");
      let filter2 = Filter.fromText("@@filter2");
      let filter3 = Filter.fromText("filter3");
      let filter4 = Filter.fromText("@@filter4");
      let filter5 = Filter.fromText("!filter5");

      let subscription = Subscription.fromURL("https://test1/");
      subscription.addFilter(filter1);
      subscription.addFilter(filter2);

      filterStorage.addSubscription(subscription);
      filterStorage.addFilter(filter1);
      checkKnownFilters("initial setup", {blocking: [filter1.text], allowing: [filter2.text]});

      let subscription2 = Subscription.fromURL("~user~fl");
      subscription2.disabled = true;
      checkKnownFilters("disable blocking filters", {blocking: [filter1.text], allowing: [filter2.text]});

      filterStorage.removeSubscription(subscription);
      checkKnownFilters("remove subscription", {});

      subscription2.disabled = false;
      checkKnownFilters("enable blocking filters", {blocking: [filter1.text]});

      let subscription3 = Subscription.fromURL("~user~wl");
      subscription3.disabled = true;
      checkKnownFilters("disable exception rules", {blocking: [filter1.text]});

      filterStorage.addFilter(filter2);
      checkKnownFilters("add @@filter2", {blocking: [filter1.text], allowing: [filter2.text]});
      assert.equal([...filterStorage.subscriptions(filter2.text)].length, 1, "@@filter2 subscription count");
      assert.ok([...filterStorage.subscriptions(filter2.text)][0] instanceof SpecialSubscription, "@@filter2 added to a new filter group");
      assert.ok([...filterStorage.subscriptions(filter2.text)][0] != subscription3, "@@filter2 filter group is not the disabled exceptions group");

      subscription3.disabled = false;
      checkKnownFilters("enable exception rules", {blocking: [filter1.text], allowing: [filter2.text]});

      filterStorage.removeFilter(filter2);
      filterStorage.addFilter(filter2);
      checkKnownFilters("re-add @@filter2", {blocking: [filter1.text], allowing: [filter2.text]});
      assert.equal([...filterStorage.subscriptions(filter2.text)].length, 1, "@@filter2 subscription count");
      assert.ok([...filterStorage.subscriptions(filter2.text)][0] == subscription3, "@@filter2 added to the default exceptions group");

      let subscription4 = Subscription.fromURL("https://test/");
      filterStorage.updateSubscriptionFilters(subscription4, [filter3.text, filter4.text, filter5.text]);
      checkKnownFilters("update subscription not in the list yet", {blocking: [filter1.text], allowing: [filter2.text]});

      filterStorage.addSubscription(subscription4);
      checkKnownFilters("add subscription to the list", {blocking: [filter1.text, filter3.text], allowing: [filter2.text, filter4.text]});

      filterStorage.updateSubscriptionFilters(subscription4, [filter3.text, filter2.text, filter5.text]);
      checkKnownFilters("update subscription while in the list", {blocking: [filter1.text, filter3.text], allowing: [filter2.text]});

      subscription3.disabled = true;
      checkKnownFilters("disable exception rules", {blocking: [filter1.text, filter3.text], allowing: [filter2.text]});

      filterStorage.removeSubscription(subscription4);
      checkKnownFilters("remove subscription from the list", {blocking: [filter1.text]});

      subscription3.disabled = false;
      checkKnownFilters("enable exception rules", {blocking: [filter1.text], allowing: [filter2.text]});
    });

    it("Snippet filters", function() {
      let filter1 = Filter.fromText("example.com#$#filter1");
      let filter2 = Filter.fromText("example.com#$#filter2");

      let subscription1 = Subscription.fromURL("https://test1/");
      assert.equal(subscription1.type, null);
      assert.equal(subscription1.privileged, false);

      subscription1.addFilter(filter1);
      subscription1.addFilter(filter2);

      filterStorage.addSubscription(subscription1);
      checkKnownFilters("add subscription with filter1 and filter2", {});

      let {url: circumventionURL} = recommendations.find(
        ({type}) => type == "circumvention"
      );

      let subscription2 = Subscription.fromURL(circumventionURL);
      assert.equal(subscription2.type, "circumvention");
      assert.equal(subscription2.privileged, true);

      subscription2.addFilter(filter1);

      filterStorage.addSubscription(subscription2);
      checkKnownFilters("add subscription of type circumvention with filter1", {snippets: [filter1.text]});

      let subscription3 = Subscription.fromURL("~user~foo");
      assert.equal(subscription3.type, null);
      assert.equal(subscription3.privileged, true);

      subscription3.addFilter(filter2);

      filterStorage.addSubscription(subscription3);
      checkKnownFilters("add special subscription with filter2", {snippets: [filter1.text, filter2.text]});
    });

    it("Filter subscription operations with snippet filters", function() {
      let filter1 = Filter.fromText("example.com#$#filter1");

      let subscription1 = Subscription.fromURL("https://test1/");
      subscription1.addFilter(filter1);
      filterStorage.addSubscription(subscription1);

      let {url: circumventionURL} = recommendations.find(
        ({type}) => type == "circumvention"
      );
      let subscription2 = Subscription.fromURL(circumventionURL);
      subscription2.addFilter(filter1);
      filterStorage.addSubscription(subscription2);

      let subscription3 = Subscription.fromURL("~user~foo");
      subscription3.addFilter(filter1);
      filterStorage.addSubscription(subscription3);

      checkKnownFilters("snippet from multiple subscriptions is present", {snippets: [filter1.text]});

      filter1.setDisabledForSubscription(subscription3.url, true);
      checkKnownFilters("snippet still present after disabled on one privileged subscription", {snippets: [filter1.text]});

      filter1.setDisabledForSubscription(subscription2.url, true);
      checkKnownFilters("snippet no longer enabled when disabled on all privileged subscriptions", {snippets: []});

      filter1.setDisabledForSubscription(subscription3.url, false);
      checkKnownFilters("snippet can be reenabled from any subscription", {snippets: [filter1.text]});
    });

    it("HTTP header filters", function() {
      let filter1 = Filter.fromText("||example.com/ad.js$header=content-type=image/png");
      let filter2 = Filter.fromText("||example.com/content.js$header=content-type=image/png");

      let subscription1 = Subscription.fromURL("https://test1/");
      assert.equal(subscription1.type, null);

      subscription1.addFilter(filter1);
      subscription1.addFilter(filter2);

      filterStorage.addSubscription(subscription1);
      checkKnownFilters("add subscription with filter1 and filter2", {});

      let {url: circumventionURL} = recommendations.find(
        ({type}) => type == "circumvention"
      );

      let subscription2 = Subscription.fromURL(circumventionURL);
      assert.equal(subscription2.type, "circumvention");

      subscription2.addFilter(filter1);

      filterStorage.addSubscription(subscription2);
      checkKnownFilters("add subscription of type circumvention with filter1", {blocking: [filter1.text]});

      let subscription3 = Subscription.fromURL("~user~foo");
      assert.equal(subscription3.type, null);

      subscription3.addFilter(filter2);

      filterStorage.addSubscription(subscription3);
      checkKnownFilters("add special subscription with filter2", {blocking: [filter1.text, filter2.text]});
    });
  });
});
