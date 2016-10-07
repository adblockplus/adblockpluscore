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

let {createSandbox} = require("./_common");

let ElemHide = null;
let Filter = null;

exports.setUp = function(callback)
{
  let sandboxedRequire = createSandbox();
  (
    {ElemHide} = sandboxedRequire("../lib/elemHide"),
    {Filter} = sandboxedRequire("../lib/filterClasses")
  );

  callback();
};

function normalizeSelectors(selectors)
{
  // getSelectorsForDomain is currently allowed to return duplicate selectors
  // for performance reasons, so we need to remove duplicates here.
  return selectors.sort().filter((selector, index, selectors) =>
  {
    return index == 0 || selector != selectors[index -  1];
  });
}

function testResult(test, domain, expectedSelectors, criteria)
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

exports.testGetSelectorsForDomain = function(test)
{
  let addFilter = filterText => ElemHide.add(Filter.fromText(filterText));
  let removeFilter = filterText => ElemHide.remove(Filter.fromText(filterText));

  testResult(test, "", []);

  addFilter("~foo.example.com,example.com##foo");
  testResult(test, "barfoo.example.com", ["foo"]);
  testResult(test, "bar.foo.example.com", []);
  testResult(test, "foo.example.com", []);
  testResult(test, "example.com", ["foo"]);
  testResult(test, "com", []);
  testResult(test, "", []);

  addFilter("foo.example.com##turnip");
  testResult(test, "foo.example.com", ["turnip"]);
  testResult(test, "example.com", ["foo"]);
  testResult(test, "com", []);
  testResult(test, "", []);

  addFilter("example.com#@#foo");
  testResult(test, "foo.example.com", ["turnip"]);
  testResult(test, "example.com", []);
  testResult(test, "com", []);
  testResult(test, "", []);

  addFilter("com##bar");
  testResult(test, "foo.example.com", ["turnip", "bar"]);
  testResult(test, "example.com", ["bar"]);
  testResult(test, "com", ["bar"]);
  testResult(test, "", []);

  addFilter("example.com#@#bar");
  testResult(test, "foo.example.com", ["turnip"]);
  testResult(test, "example.com", []);
  testResult(test, "com", ["bar"]);
  testResult(test, "", []);

  removeFilter("example.com#@#foo");
  testResult(test, "foo.example.com", ["turnip"]);
  testResult(test, "example.com", ["foo"]);
  testResult(test, "com", ["bar"]);
  testResult(test, "", []);

  removeFilter("example.com#@#bar");
  testResult(test, "foo.example.com", ["turnip", "bar"]);
  testResult(test, "example.com", ["foo", "bar"]);
  testResult(test, "com", ["bar"]);
  testResult(test, "", []);

  addFilter("##generic");
  testResult(test, "foo.example.com", ["turnip", "bar", "generic"]);
  testResult(test, "example.com", ["foo", "bar", "generic"]);
  testResult(test, "com", ["bar", "generic"]);
  testResult(test, "", ["generic"]);
  testResult(test, "foo.example.com", ["turnip", "bar"], ElemHide.SPECIFIC_ONLY);
  testResult(test, "example.com", ["foo", "bar"], ElemHide.SPECIFIC_ONLY);
  testResult(test, "com", ["bar"], ElemHide.SPECIFIC_ONLY);
  testResult(test, "", [], ElemHide.SPECIFIC_ONLY);
  removeFilter("##generic");

  addFilter("~adblockplus.org##example");
  testResult(test, "adblockplus.org", []);
  testResult(test, "", ["example"]);
  testResult(test, "foo.example.com", ["turnip", "bar", "example"]);
  testResult(test, "foo.example.com", ["turnip", "bar"], ElemHide.SPECIFIC_ONLY);
  removeFilter("~adblockplus.org##example");

  removeFilter("~foo.example.com,example.com##foo");
  testResult(test, "foo.example.com", ["turnip", "bar"]);
  testResult(test, "example.com", ["bar"]);
  testResult(test, "com", ["bar"]);
  testResult(test, "", []);

  removeFilter("com##bar");
  testResult(test, "foo.example.com", ["turnip"]);
  testResult(test, "example.com", []);
  testResult(test, "com", []);
  testResult(test, "", []);

  removeFilter("foo.example.com##turnip");
  testResult(test, "foo.example.com", []);
  testResult(test, "example.com", []);
  testResult(test, "com", []);
  testResult(test, "", []);

  addFilter("example.com##dupe");
  addFilter("example.com##dupe");
  testResult(test, "example.com", ["dupe"]);
  removeFilter("example.com##dupe");
  testResult(test, "example.com", []);
  removeFilter("example.com##dupe");

  addFilter("~foo.example.com,example.com##foo");

  addFilter("##foo");
  testResult(test, "foo.example.com", ["foo"]);
  testResult(test, "example.com", ["foo"]);
  testResult(test, "com", ["foo"]);
  testResult(test, "", ["foo"]);
  removeFilter("##foo");

  addFilter("example.org##foo");
  testResult(test, "foo.example.com", []);
  testResult(test, "example.com", ["foo"]);
  testResult(test, "com", []);
  testResult(test, "", []);
  removeFilter("example.org##foo");

  addFilter("~example.com##foo");
  testResult(test, "foo.example.com", []);
  testResult(test, "example.com", ["foo"]);
  testResult(test, "com", ["foo"]);
  testResult(test, "", ["foo"]);
  removeFilter("~example.com##foo");

  removeFilter("~foo.example.com,example.com##foo");

  // Test criteria
  addFilter("##hello");
  addFilter("~example.com##world");
  addFilter("foo.com##specific");
  testResult(test, "foo.com", ["specific"], ElemHide.SPECIFIC_ONLY);
  testResult(test, "foo.com", ["specific", "world"], ElemHide.NO_UNCONDITIONAL);
  testResult(test, "foo.com", ["hello", "specific", "world"], ElemHide.ALL_MATCHING);
  testResult(test, "foo.com", ["hello", "specific", "world"]);
  removeFilter("foo.com##specific");
  removeFilter("~example.com##world");
  removeFilter("##hello");
  testResult(test, "foo.com", []);

  addFilter("##hello");
  testResult(test, "foo.com", [], ElemHide.SPECIFIC_ONLY);
  testResult(test, "foo.com", [], ElemHide.NO_UNCONDITIONAL);
  testResult(test, "foo.com", ["hello"], ElemHide.ALL_MATCHING);
  testResult(test, "foo.com", ["hello"]);
  testResult(test, "bar.com", [], ElemHide.SPECIFIC_ONLY);
  testResult(test, "bar.com", [], ElemHide.NO_UNCONDITIONAL);
  testResult(test, "bar.com", ["hello"], ElemHide.ALL_MATCHING);
  testResult(test, "bar.com", ["hello"]);
  addFilter("foo.com#@#hello");
  testResult(test, "foo.com", [], ElemHide.SPECIFIC_ONLY);
  testResult(test, "foo.com", [], ElemHide.NO_UNCONDITIONAL);
  testResult(test, "foo.com", [], ElemHide.ALL_MATCHING);
  testResult(test, "foo.com", []);
  testResult(test, "bar.com", [], ElemHide.SPECIFIC_ONLY);
  testResult(test, "bar.com", ["hello"], ElemHide.NO_UNCONDITIONAL);
  testResult(test, "bar.com", ["hello"], ElemHide.ALL_MATCHING);
  testResult(test, "bar.com", ["hello"]);
  removeFilter("foo.com#@#hello");
  testResult(test, "foo.com", [], ElemHide.SPECIFIC_ONLY);
  // Note: We don't take care to track conditional selectors which became
  //       unconditional when a filter was removed. This was too expensive.
  //testResult(test, "foo.com", [], ElemHide.NO_UNCONDITIONAL);
  testResult(test, "foo.com", ["hello"], ElemHide.ALL_MATCHING);
  testResult(test, "foo.com", ["hello"]);
  testResult(test, "bar.com", [], ElemHide.SPECIFIC_ONLY);
  testResult(test, "bar.com", ["hello"], ElemHide.NO_UNCONDITIONAL);
  testResult(test, "bar.com", ["hello"], ElemHide.ALL_MATCHING);
  testResult(test, "bar.com", ["hello"]);
  removeFilter("##hello");
  testResult(test, "foo.com", []);
  testResult(test, "bar.com", []);

  addFilter("##hello");
  addFilter("foo.com##hello");
  testResult(test, "foo.com", ["hello"]);
  removeFilter("foo.com##hello");
  testResult(test, "foo.com", ["hello"]);
  removeFilter("##hello");
  testResult(test, "foo.com", []);

  addFilter("##hello");
  addFilter("foo.com##hello");
  testResult(test, "foo.com", ["hello"]);
  removeFilter("##hello");
  testResult(test, "foo.com", ["hello"]);
  removeFilter("foo.com##hello");
  testResult(test, "foo.com", []);

  test.done();
};

exports.testZeroFilterKey = function(test)
{
  ElemHide.add(Filter.fromText("##test"));
  ElemHide.add(Filter.fromText("foo.com#@#test"));
  testResult(test, "foo.com", []);
  testResult(test, "bar.com", ["test"]);
  test.done();
};
