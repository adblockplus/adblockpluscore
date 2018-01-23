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
const {withNAD} = require("./_test-utils");

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

function normalizeSelectors(selectorList)
{
  let selectors;

  if (Array.isArray(selectorList))
    selectors = selectorList;
  else
  {
    selectors = [];
    for (let i = 0; i < selectorList.selectorCount; i++)
      selectors.push(selectorList.selectorAt(i));
  }

  // getSelectorsForDomain is currently allowed to return duplicate selectors
  // for performance reasons, so we need to remove duplicates here.
  return selectors.sort().filter((selector, index, sortedSelectors) =>
  {
    return index == 0 || selector != sortedSelectors[index - 1];
  });
}

function testResult(test, elemHide, domain, expectedSelectors, criteria)
{
  let normalizedExpectedSelectors = normalizeSelectors(expectedSelectors);

  test.deepEqual(
    normalizeSelectors(elemHide.getSelectorsForDomain(domain, criteria)),
    normalizedExpectedSelectors
  );
}

exports.testGetSelectorsForDomain = function(test)
{
  withNAD(0, elemHide =>
  {
    let addFilter = filterText => withNAD(
      0, filter => elemHide.add(filter))(Filter.fromText(filterText));
    let removeFilter = filterText => withNAD(
      0, filter => elemHide.remove(filter))(Filter.fromText(filterText));

    testResult(test, elemHide, "", []);

    addFilter("~foo.example.com,example.com##foo");
    testResult(test, elemHide, "barfoo.example.com", ["foo"]);
    testResult(test, elemHide, "bar.foo.example.com", []);
    testResult(test, elemHide, "foo.example.com", []);
    testResult(test, elemHide, "example.com", ["foo"]);
    testResult(test, elemHide, "com", []);
    testResult(test, elemHide, "", []);

    addFilter("foo.example.com##turnip");
    testResult(test, elemHide, "foo.example.com", ["turnip"]);
    testResult(test, elemHide, "example.com", ["foo"]);
    testResult(test, elemHide, "com", []);
    testResult(test, elemHide, "", []);

    addFilter("example.com#@#foo");
    testResult(test, elemHide, "foo.example.com", ["turnip"]);
    testResult(test, elemHide, "example.com", []);
    testResult(test, elemHide, "com", []);
    testResult(test, elemHide, "", []);

    addFilter("com##bar");
    testResult(test, elemHide, "foo.example.com", ["turnip", "bar"]);
    testResult(test, elemHide, "example.com", ["bar"]);
    testResult(test, elemHide, "com", ["bar"]);
    testResult(test, elemHide, "", []);

    addFilter("example.com#@#bar");
    testResult(test, elemHide, "foo.example.com", ["turnip"]);
    testResult(test, elemHide, "example.com", []);
    testResult(test, elemHide, "com", ["bar"]);
    testResult(test, elemHide, "", []);

    removeFilter("example.com#@#foo");
    testResult(test, elemHide, "foo.example.com", ["turnip"]);
    testResult(test, elemHide, "example.com", ["foo"]);
    testResult(test, elemHide, "com", ["bar"]);
    testResult(test, elemHide, "", []);

    removeFilter("example.com#@#bar");
    testResult(test, elemHide, "foo.example.com", ["turnip", "bar"]);
    testResult(test, elemHide, "example.com", ["foo", "bar"]);
    testResult(test, elemHide, "com", ["bar"]);
    testResult(test, elemHide, "", []);

    addFilter("##generic");
    testResult(test, elemHide, "foo.example.com", ["turnip", "bar", "generic"]);
    testResult(test, elemHide, "example.com", ["foo", "bar", "generic"]);
    testResult(test, elemHide, "com", ["bar", "generic"]);
    testResult(test, elemHide, "", ["generic"]);
    testResult(test, elemHide, "foo.example.com", ["turnip", "bar"], ElemHide.SPECIFIC_ONLY);
    testResult(test, elemHide, "example.com", ["foo", "bar"], ElemHide.SPECIFIC_ONLY);
    testResult(test, elemHide, "com", ["bar"], ElemHide.SPECIFIC_ONLY);
    testResult(test, elemHide, "", [], ElemHide.SPECIFIC_ONLY);
    removeFilter("##generic");

    addFilter("~adblockplus.org##example");
    testResult(test, elemHide, "adblockplus.org", []);
    testResult(test, elemHide, "", ["example"]);
    testResult(test, elemHide, "foo.example.com", ["turnip", "bar", "example"]);
    testResult(test, elemHide, "foo.example.com", ["turnip", "bar"], ElemHide.SPECIFIC_ONLY);
    removeFilter("~adblockplus.org##example");

    removeFilter("~foo.example.com,example.com##foo");
    testResult(test, elemHide, "foo.example.com", ["turnip", "bar"]);
    testResult(test, elemHide, "example.com", ["bar"]);
    testResult(test, elemHide, "com", ["bar"]);
    testResult(test, elemHide, "", []);

    removeFilter("com##bar");
    testResult(test, elemHide, "foo.example.com", ["turnip"]);
    testResult(test, elemHide, "example.com", []);
    testResult(test, elemHide, "com", []);
    testResult(test, elemHide, "", []);

    removeFilter("foo.example.com##turnip");
    testResult(test, elemHide, "foo.example.com", []);
    testResult(test, elemHide, "example.com", []);
    testResult(test, elemHide, "com", []);
    testResult(test, elemHide, "", []);

    addFilter("example.com##dupe");
    addFilter("example.com##dupe");
    testResult(test, elemHide, "example.com", ["dupe"]);
    removeFilter("example.com##dupe");
    testResult(test, elemHide, "example.com", []);
    removeFilter("example.com##dupe");

    addFilter("~foo.example.com,example.com##foo");

    addFilter("##foo");
    testResult(test, elemHide, "foo.example.com", ["foo"]);
    testResult(test, elemHide, "example.com", ["foo"]);
    testResult(test, elemHide, "com", ["foo"]);
    testResult(test, elemHide, "", ["foo"]);
    removeFilter("##foo");

    addFilter("example.org##foo");
    testResult(test, elemHide, "foo.example.com", []);
    testResult(test, elemHide, "example.com", ["foo"]);
    testResult(test, elemHide, "com", []);
    testResult(test, elemHide, "", []);
    removeFilter("example.org##foo");

    addFilter("~example.com##foo");
    testResult(test, elemHide, "foo.example.com", []);
    testResult(test, elemHide, "example.com", ["foo"]);
    testResult(test, elemHide, "com", ["foo"]);
    testResult(test, elemHide, "", ["foo"]);
    removeFilter("~example.com##foo");

    removeFilter("~foo.example.com,example.com##foo");

    // Test criteria
    addFilter("##hello");
    addFilter("~example.com##world");
    addFilter("foo.com##specific");
    testResult(test, elemHide, "foo.com", ["specific"], ElemHide.SPECIFIC_ONLY);
    testResult(test, elemHide, "foo.com", ["specific", "world"], ElemHide.NO_UNCONDITIONAL);
    testResult(test, elemHide, "foo.com", ["hello", "specific", "world"], ElemHide.ALL_MATCHING);
    testResult(test, elemHide, "foo.com", ["hello", "specific", "world"]);
    removeFilter("foo.com##specific");
    removeFilter("~example.com##world");
    removeFilter("##hello");
    testResult(test, elemHide, "foo.com", []);

    addFilter("##hello");
    testResult(test, elemHide, "foo.com", [], ElemHide.SPECIFIC_ONLY);
    testResult(test, elemHide, "foo.com", [], ElemHide.NO_UNCONDITIONAL);
    testResult(test, elemHide, "foo.com", ["hello"], ElemHide.ALL_MATCHING);
    testResult(test, elemHide, "foo.com", ["hello"]);
    testResult(test, elemHide, "bar.com", [], ElemHide.SPECIFIC_ONLY);
    testResult(test, elemHide, "bar.com", [], ElemHide.NO_UNCONDITIONAL);
    testResult(test, elemHide, "bar.com", ["hello"], ElemHide.ALL_MATCHING);
    testResult(test, elemHide, "bar.com", ["hello"]);
    addFilter("foo.com#@#hello");
    testResult(test, elemHide, "foo.com", [], ElemHide.SPECIFIC_ONLY);
    testResult(test, elemHide, "foo.com", [], ElemHide.NO_UNCONDITIONAL);
    testResult(test, elemHide, "foo.com", [], ElemHide.ALL_MATCHING);
    testResult(test, elemHide, "foo.com", []);
    testResult(test, elemHide, "bar.com", [], ElemHide.SPECIFIC_ONLY);
    testResult(test, elemHide, "bar.com", ["hello"], ElemHide.NO_UNCONDITIONAL);
    testResult(test, elemHide, "bar.com", ["hello"], ElemHide.ALL_MATCHING);
    testResult(test, elemHide, "bar.com", ["hello"]);
    removeFilter("foo.com#@#hello");
    testResult(test, elemHide, "foo.com", [], ElemHide.SPECIFIC_ONLY);
    // Note: We don't take care to track conditional selectors which became
    //       unconditional when a filter was removed. This was too expensive.
    // testResult(test, elemHide, "foo.com", [], ElemHide.NO_UNCONDITIONAL);
    testResult(test, elemHide, "foo.com", ["hello"], ElemHide.ALL_MATCHING);
    testResult(test, elemHide, "foo.com", ["hello"]);
    testResult(test, elemHide, "bar.com", [], ElemHide.SPECIFIC_ONLY);
    testResult(test, elemHide, "bar.com", ["hello"], ElemHide.NO_UNCONDITIONAL);
    testResult(test, elemHide, "bar.com", ["hello"], ElemHide.ALL_MATCHING);
    testResult(test, elemHide, "bar.com", ["hello"]);
    removeFilter("##hello");
    testResult(test, elemHide, "foo.com", []);
    testResult(test, elemHide, "bar.com", []);

    addFilter("##hello");
    addFilter("foo.com##hello");
    testResult(test, elemHide, "foo.com", ["hello"]);
    removeFilter("foo.com##hello");
    testResult(test, elemHide, "foo.com", ["hello"]);
    removeFilter("##hello");
    testResult(test, elemHide, "foo.com", []);

    addFilter("##hello");
    addFilter("foo.com##hello");
    testResult(test, elemHide, "foo.com", ["hello"]);
    removeFilter("##hello");
    testResult(test, elemHide, "foo.com", ["hello"]);
    removeFilter("foo.com##hello");
    testResult(test, elemHide, "foo.com", []);
  })(ElemHide.create());

  test.done();
};

exports.testFilterException = function(test)
{
  withNAD([0, 1, 2], (elemHide, filter, exception) =>
  {
    elemHide.add(filter);
    elemHide.add(exception);
    testResult(test, elemHide, "foo.com", []);
    testResult(test, elemHide, "bar.com", ["test"]);
  })(ElemHide.create(), Filter.fromText("##test"), Filter.fromText("foo.com#@#test"));

  test.done();
};
