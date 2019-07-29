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
const {createSandbox} = require("./_common");

let f$ = null;

let Subscription = null;
let SpecialSubscription = null;
let DownloadableSubscription = null;
let RegularSubscription = null;
let ExternalSubscription = null;
let Filter = null;

describe("Subscription classes", function()
{
  beforeEach(function()
  {
    let sandboxedRequire = createSandbox();
    (
      {Subscription, SpecialSubscription,
       DownloadableSubscription, RegularSubscription,
       ExternalSubscription} = sandboxedRequire("../lib/subscriptionClasses"),
      {Filter} = sandboxedRequire("../lib/filterClasses")
    );

    f$ = Filter.fromText;
  });

  function compareSubscription(url, expected, postInit)
  {
    expected.push("[Subscription]");
    let subscription = Subscription.fromURL(url);
    if (postInit)
      postInit(subscription);
    let result = [...subscription.serialize()];
    assert.equal(result.sort().join("\n"), expected.sort().join("\n"), url);

    let map = Object.create(null);
    for (let line of result.slice(1))
    {
      if (/(.*?)=(.*)/.test(line))
        map[RegExp.$1] = RegExp.$2;
    }
    let subscription2 = Subscription.fromObject(map);
    assert.equal(subscription.toString(), subscription2.toString(), url + " deserialization");
  }

  function compareSubscriptionFilters(subscription, expected)
  {
    assert.deepEqual([...subscription.filterText()], expected);

    assert.equal(subscription.filterCount, expected.length);

    for (let i = 0; i < subscription.filterCount; i++)
      assert.equal(subscription.filterTextAt(i), expected[i]);

    assert.ok(!subscription.filterTextAt(subscription.filterCount));
    assert.ok(!subscription.filterTextAt(-1));
  }

  it("Definitions", function()
  {
    assert.equal(typeof Subscription, "function", "typeof Subscription");
    assert.equal(typeof SpecialSubscription, "function", "typeof SpecialSubscription");
    assert.equal(typeof RegularSubscription, "function", "typeof RegularSubscription");
    assert.equal(typeof ExternalSubscription, "function", "typeof ExternalSubscription");
    assert.equal(typeof DownloadableSubscription, "function", "typeof DownloadableSubscription");
  });

  it("Subscriptions with state", function()
  {
    compareSubscription("~fl~", ["url=~fl~"]);
    compareSubscription("http://test/default", ["url=http://test/default", "title=http://test/default"]);
    compareSubscription(
      "http://test/default_titled", ["url=http://test/default_titled", "title=test"],
      subscription =>
      {
        subscription.title = "test";
      }
    );
    compareSubscription(
      "http://test/non_default",
      [
        "url=http://test/non_default", "title=test", "disabled=true",
        "lastSuccess=8", "lastDownload=12", "lastCheck=16", "softExpiration=18",
        "expires=20", "downloadStatus=foo", "errors=3", "version=24",
        "requiredVersion=0.6"
      ],
      subscription =>
      {
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
      "~wl~", ["url=~wl~", "disabled=true", "title=Test group"],
      subscription =>
      {
        subscription.title = "Test group";
        subscription.disabled = true;
      }
    );
  });

  it("Filter management", function()
  {
    let subscription = Subscription.fromURL("https://example.com/");

    compareSubscriptionFilters(subscription, []);

    subscription.addFilter(f$("##.foo"));
    compareSubscriptionFilters(subscription, ["##.foo"]);
    assert.equal(subscription.findFilterIndex(f$("##.foo")), 0);

    subscription.addFilter(f$("##.bar"));
    compareSubscriptionFilters(subscription, ["##.foo", "##.bar"]);
    assert.equal(subscription.findFilterIndex(f$("##.bar")), 1);

    // Repeat filter.
    subscription.addFilter(f$("##.bar"));
    compareSubscriptionFilters(subscription, ["##.foo", "##.bar",
                                              "##.bar"]);

    // The first occurrence is found.
    assert.equal(subscription.findFilterIndex(f$("##.bar")), 1);

    subscription.deleteFilterAt(0);
    compareSubscriptionFilters(subscription, ["##.bar", "##.bar"]);
    assert.equal(subscription.findFilterIndex(f$("##.bar")), 0);

    subscription.insertFilterAt(f$("##.foo"), 0);
    compareSubscriptionFilters(subscription, ["##.foo", "##.bar",
                                              "##.bar"]);
    assert.equal(subscription.findFilterIndex(f$("##.bar")), 1);

    subscription.deleteFilterAt(1);
    compareSubscriptionFilters(subscription, ["##.foo", "##.bar"]);
    assert.equal(subscription.findFilterIndex(f$("##.bar")), 1);

    subscription.deleteFilterAt(1);
    compareSubscriptionFilters(subscription, ["##.foo"]);
    assert.equal(subscription.findFilterIndex(f$("##.bar")), -1);

    subscription.addFilter(f$("##.bar"));
    compareSubscriptionFilters(subscription, ["##.foo", "##.bar"]);
    assert.equal(subscription.findFilterIndex(f$("##.bar")), 1);

    subscription.clearFilters();
    compareSubscriptionFilters(subscription, []);
    assert.equal(subscription.findFilterIndex(f$("##.foo")), -1);
    assert.equal(subscription.findFilterIndex(f$("##.bar")), -1);

    subscription.addFilter(f$("##.bar"));
    compareSubscriptionFilters(subscription, ["##.bar"]);

    subscription.addFilter(f$("##.foo"));
    compareSubscriptionFilters(subscription, ["##.bar", "##.foo"]);
    assert.equal(subscription.findFilterIndex(f$("##.bar")), 0);
    assert.equal(subscription.findFilterIndex(f$("##.foo")), 1);

    // Insert outside of bounds.
    subscription.insertFilterAt(f$("##.lambda"), 1000);
    compareSubscriptionFilters(subscription, ["##.bar", "##.foo",
                                              "##.lambda"]);
    assert.equal(subscription.findFilterIndex(f$("##.lambda")), 2);

    // Delete outside of bounds.
    subscription.deleteFilterAt(1000);
    compareSubscriptionFilters(subscription, ["##.bar", "##.foo",
                                              "##.lambda"]);
    assert.equal(subscription.findFilterIndex(f$("##.lambda")), 2);

    // Insert outside of bounds (negative).
    subscription.insertFilterAt(f$("##.lambda"), -1000);
    compareSubscriptionFilters(subscription, ["##.lambda", "##.bar",
                                              "##.foo", "##.lambda"]);
    assert.equal(subscription.findFilterIndex(f$("##.lambda")), 0);

    // Delete outside of bounds (negative).
    subscription.deleteFilterAt(-1000);
    compareSubscriptionFilters(subscription, ["##.lambda", "##.bar",
                                              "##.foo", "##.lambda"]);
    assert.equal(subscription.findFilterIndex(f$("##.lambda")), 0);
  });

  it("Subscrition delta", function()
  {
    let subscription = Subscription.fromURL("https://example.com/");

    subscription.addFilterText("##.foo");
    subscription.addFilterText("##.bar");

    compareSubscriptionFilters(subscription, ["##.foo", "##.bar"]);

    let delta = subscription.updateFilterText(["##.lambda", "##.foo"]);

    // The filters should be in the same order in which they were in the
    // argument to updateFilterText()
    compareSubscriptionFilters(subscription, ["##.lambda", "##.foo"]);

    assert.deepEqual(delta, {added: ["##.lambda"], removed: ["##.bar"]});

    // Add ##.lambda a second time.
    subscription.addFilterText("##.lambda");
    compareSubscriptionFilters(subscription, ["##.lambda", "##.foo",
                                              "##.lambda"]);

    delta = subscription.updateFilterText(["##.bar", "##.bar"]);

    // Duplicate filters should be allowed.
    compareSubscriptionFilters(subscription, ["##.bar", "##.bar"]);

    // If there are duplicates in the text, there should be duplicates in the
    // delta.
    assert.deepEqual(delta, {
      added: ["##.bar", "##.bar"],
      removed: ["##.lambda", "##.foo", "##.lambda"]
    });
  });
});
