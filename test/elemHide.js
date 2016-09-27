/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-2016 Eyeo GmbH
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

GLOBAL.Ci = {};
GLOBAL.Cu = {
  import: function()
  {
  }
};

let {ElemHide} = require("elemHide");
let {Filter} = require("filterClasses");

exports.testGetSelectorsForDomain = function(test)
{
  let addFilter = filterText => ElemHide.add(Filter.fromText(filterText));
  let removeFilter = filterText => ElemHide.remove(Filter.fromText(filterText));

  function normalizeSelectors(selectors)
  {
    // getSelectorsForDomain is currently allowed to return duplicate selectors
    // for performance reasons, so we need to remove duplicates here.
    return selectors.sort().filter((selector, index, selectors) =>
    {
      return index == 0 || selector != selectors[index -  1];
    });
  }
  function testResult(domain, expectedSelectors, criteria)
  {
    let normalizedExpectedSelectors = normalizeSelectors(expectedSelectors);

    // Test without filter keys
    test.deepEqual(
      normalizeSelectors(ElemHide.getSelectorsForDomain(domain, criteria)),
      normalizedExpectedSelectors
    );

    // With filter keys
    let [selectors, filterKeys] = ElemHide.getSelectorsForDomain(domain, criteria,
                                                                 true);
    test.deepEqual(filterKeys.map(k => ElemHide.getFilterByKey(k).selector),
                   selectors);
    test.deepEqual(normalizeSelectors(selectors), normalizedExpectedSelectors);
  }

  testResult("", []);

  addFilter("~foo.example.com,example.com##foo");
  testResult("barfoo.example.com", ["foo"]);
  testResult("bar.foo.example.com", []);
  testResult("foo.example.com", []);
  testResult("example.com", ["foo"]);
  testResult("com", []);
  testResult("", []);

  addFilter("foo.example.com##turnip");
  testResult("foo.example.com", ["turnip"]);
  testResult("example.com", ["foo"]);
  testResult("com", []);
  testResult("", []);

  addFilter("example.com#@#foo");
  testResult("foo.example.com", ["turnip"]);
  testResult("example.com", []);
  testResult("com", []);
  testResult("", []);

  addFilter("com##bar");
  testResult("foo.example.com", ["turnip", "bar"]);
  testResult("example.com", ["bar"]);
  testResult("com", ["bar"]);
  testResult("", []);

  addFilter("example.com#@#bar");
  testResult("foo.example.com", ["turnip"]);
  testResult("example.com", []);
  testResult("com", ["bar"]);
  testResult("", []);

  removeFilter("example.com#@#foo");
  testResult("foo.example.com", ["turnip"]);
  testResult("example.com", ["foo"]);
  testResult("com", ["bar"]);
  testResult("", []);

  removeFilter("example.com#@#bar");
  testResult("foo.example.com", ["turnip", "bar"]);
  testResult("example.com", ["foo", "bar"]);
  testResult("com", ["bar"]);
  testResult("", []);

  addFilter("##generic");
  testResult("foo.example.com", ["turnip", "bar", "generic"]);
  testResult("example.com", ["foo", "bar", "generic"]);
  testResult("com", ["bar", "generic"]);
  testResult("", ["generic"]);
  testResult("foo.example.com", ["turnip", "bar"], ElemHide.SPECIFIC_ONLY);
  testResult("example.com", ["foo", "bar"], ElemHide.SPECIFIC_ONLY);
  testResult("com", ["bar"], ElemHide.SPECIFIC_ONLY);
  testResult("", [], ElemHide.SPECIFIC_ONLY);
  removeFilter("##generic");

  addFilter("~adblockplus.org##example");
  testResult("adblockplus.org", []);
  testResult("", ["example"]);
  testResult("foo.example.com", ["turnip", "bar", "example"]);
  testResult("foo.example.com", ["turnip", "bar"], ElemHide.SPECIFIC_ONLY);
  removeFilter("~adblockplus.org##example");

  removeFilter("~foo.example.com,example.com##foo");
  testResult("foo.example.com", ["turnip", "bar"]);
  testResult("example.com", ["bar"]);
  testResult("com", ["bar"]);
  testResult("", []);

  removeFilter("com##bar");
  testResult("foo.example.com", ["turnip"]);
  testResult("example.com", []);
  testResult("com", []);
  testResult("", []);

  removeFilter("foo.example.com##turnip");
  testResult("foo.example.com", []);
  testResult("example.com", []);
  testResult("com", []);
  testResult("", []);

  addFilter("example.com##dupe");
  addFilter("example.com##dupe");
  testResult("example.com", ["dupe"]);
  removeFilter("example.com##dupe");
  testResult("example.com", []);
  removeFilter("example.com##dupe");

  addFilter("~foo.example.com,example.com##foo");

  addFilter("##foo");
  testResult("foo.example.com", ["foo"]);
  testResult("example.com", ["foo"]);
  testResult("com", ["foo"]);
  testResult("", ["foo"]);
  removeFilter("##foo");

  addFilter("example.org##foo");
  testResult("foo.example.com", []);
  testResult("example.com", ["foo"]);
  testResult("com", []);
  testResult("", []);
  removeFilter("example.org##foo");

  addFilter("~example.com##foo");
  testResult("foo.example.com", []);
  testResult("example.com", ["foo"]);
  testResult("com", ["foo"]);
  testResult("", ["foo"]);
  removeFilter("~example.com##foo");

  removeFilter("~foo.example.com,example.com##foo");

  // Test criteria
  addFilter("##hello");
  addFilter("~example.com##world");
  addFilter("foo.com##specific");
  testResult("foo.com", ["specific"], ElemHide.SPECIFIC_ONLY);
  testResult("foo.com", ["specific", "world"], ElemHide.NO_UNCONDITIONAL);
  testResult("foo.com", ["hello", "specific", "world"], ElemHide.ALL_MATCHING);
  testResult("foo.com", ["hello", "specific", "world"]);
  removeFilter("foo.com##specific");
  removeFilter("~example.com##world");
  removeFilter("##hello");
  testResult("foo.com", []);

  addFilter("##hello");
  testResult("foo.com", [], ElemHide.SPECIFIC_ONLY);
  testResult("foo.com", [], ElemHide.NO_UNCONDITIONAL);
  testResult("foo.com", ["hello"], ElemHide.ALL_MATCHING);
  testResult("foo.com", ["hello"]);
  testResult("bar.com", [], ElemHide.SPECIFIC_ONLY);
  testResult("bar.com", [], ElemHide.NO_UNCONDITIONAL);
  testResult("bar.com", ["hello"], ElemHide.ALL_MATCHING);
  testResult("bar.com", ["hello"]);
  addFilter("foo.com#@#hello");
  testResult("foo.com", [], ElemHide.SPECIFIC_ONLY);
  testResult("foo.com", [], ElemHide.NO_UNCONDITIONAL);
  testResult("foo.com", [], ElemHide.ALL_MATCHING);
  testResult("foo.com", []);
  testResult("bar.com", [], ElemHide.SPECIFIC_ONLY);
  testResult("bar.com", ["hello"], ElemHide.NO_UNCONDITIONAL);
  testResult("bar.com", ["hello"], ElemHide.ALL_MATCHING);
  testResult("bar.com", ["hello"]);
  removeFilter("foo.com#@#hello");
  testResult("foo.com", [], ElemHide.SPECIFIC_ONLY);
  // Note: We don't take care to track conditional selectors which became
  //       unconditional when a filter was removed. This was too expensive.
  //testResult("foo.com", [], ElemHide.NO_UNCONDITIONAL);
  testResult("foo.com", ["hello"], ElemHide.ALL_MATCHING);
  testResult("foo.com", ["hello"]);
  testResult("bar.com", [], ElemHide.SPECIFIC_ONLY);
  testResult("bar.com", ["hello"], ElemHide.NO_UNCONDITIONAL);
  testResult("bar.com", ["hello"], ElemHide.ALL_MATCHING);
  testResult("bar.com", ["hello"]);
  removeFilter("##hello");
  testResult("foo.com", []);
  testResult("bar.com", []);

  addFilter("##hello");
  addFilter("foo.com##hello");
  testResult("foo.com", ["hello"]);
  removeFilter("foo.com##hello");
  testResult("foo.com", ["hello"]);
  removeFilter("##hello");
  testResult("foo.com", []);

  addFilter("##hello");
  addFilter("foo.com##hello");
  testResult("foo.com", ["hello"]);
  removeFilter("##hello");
  testResult("foo.com", ["hello"]);
  removeFilter("foo.com##hello");
  testResult("foo.com", []);

  // Advanced filter keys test
  testResult("", []);
  addFilter("##dupe");
  addFilter(",,##dupe");
  addFilter(",,,##dupe");
  addFilter("foo.com##dupe");
  testResult("", ["dupe"]);
  removeFilter(",,,##dupe");
  testResult("", ["dupe"]);
  removeFilter("foo.com##dupe");
  testResult("", ["dupe"]);
  removeFilter(",,##dupe");
  testResult("", ["dupe"]);
  removeFilter("##dupe");
  testResult("", []);

  test.done();
};
