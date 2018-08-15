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

let ElemHide = null;
let ElemHideExceptions = null;
let Filter = null;

exports.setUp = function(callback)
{
  let sandboxedRequire = createSandbox();
  (
    {ElemHide} = sandboxedRequire("../lib/elemHide"),
    {ElemHideExceptions} = sandboxedRequire("../lib/elemHideExceptions"),
    {Filter} = sandboxedRequire("../lib/filterClasses")
  );

  callback();
};

function normalizeSelectors(selectors)
{
  // getSelectorsForDomain is currently allowed to return duplicate selectors
  // for performance reasons, so we need to remove duplicates here.
  return selectors.sort().filter((selector, index, sortedSelectors) =>
  {
    return index == 0 || selector != sortedSelectors[index - 1];
  });
}

function testResult(test, domain, expectedSelectors, specificOnly)
{
  let normalizedExpectedSelectors = normalizeSelectors(expectedSelectors);

  test.deepEqual(
    normalizeSelectors(ElemHide.getSelectorsForDomain(domain, specificOnly)),
    normalizedExpectedSelectors
  );
}

exports.testGetSelectorsForDomain = function(test)
{
  let addFilter = filterText => ElemHide.add(Filter.fromText(filterText));
  let removeFilter = filterText => ElemHide.remove(Filter.fromText(filterText));
  let addException =
    filterText => ElemHideExceptions.add(Filter.fromText(filterText));
  let removeException =
    filterText => ElemHideExceptions.remove(Filter.fromText(filterText));

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

  addException("example.com#@#foo");
  testResult(test, "foo.example.com", ["turnip"]);
  testResult(test, "example.com", []);
  testResult(test, "com", []);
  testResult(test, "", []);

  addFilter("com##bar");
  testResult(test, "foo.example.com", ["turnip", "bar"]);
  testResult(test, "example.com", ["bar"]);
  testResult(test, "com", ["bar"]);
  testResult(test, "", []);

  addException("example.com#@#bar");
  testResult(test, "foo.example.com", ["turnip"]);
  testResult(test, "example.com", []);
  testResult(test, "com", ["bar"]);
  testResult(test, "", []);

  removeException("example.com#@#foo");
  testResult(test, "foo.example.com", ["turnip"]);
  testResult(test, "example.com", ["foo"]);
  testResult(test, "com", ["bar"]);
  testResult(test, "", []);

  removeException("example.com#@#bar");
  testResult(test, "foo.example.com", ["turnip", "bar"]);
  testResult(test, "example.com", ["foo", "bar"]);
  testResult(test, "com", ["bar"]);
  testResult(test, "", []);

  addFilter("##generic");
  testResult(test, "foo.example.com", ["turnip", "bar", "generic"]);
  testResult(test, "example.com", ["foo", "bar", "generic"]);
  testResult(test, "com", ["bar", "generic"]);
  testResult(test, "", ["generic"]);
  testResult(test, "foo.example.com", ["turnip", "bar"], true);
  testResult(test, "example.com", ["foo", "bar"], true);
  testResult(test, "com", ["bar"], true);
  testResult(test, "", [], true);
  removeFilter("##generic");

  addFilter("~adblockplus.org##example");
  testResult(test, "adblockplus.org", []);
  testResult(test, "", ["example"]);
  testResult(test, "foo.example.com", ["turnip", "bar", "example"]);
  testResult(test, "foo.example.com", ["turnip", "bar"], true);
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
  testResult(test, "foo.com", ["specific"], true);
  testResult(test, "foo.com", ["hello", "specific", "world"], false);
  testResult(test, "foo.com", ["hello", "specific", "world"]);
  testResult(test, "foo.com.", ["hello", "specific", "world"]);
  testResult(test, "example.com", [], true);
  removeFilter("foo.com##specific");
  removeFilter("~example.com##world");
  removeFilter("##hello");
  testResult(test, "foo.com", []);

  addFilter("##hello");
  testResult(test, "foo.com", [], true);
  testResult(test, "foo.com", ["hello"], false);
  testResult(test, "foo.com", ["hello"]);
  testResult(test, "bar.com", [], true);
  testResult(test, "bar.com", ["hello"], false);
  testResult(test, "bar.com", ["hello"]);
  addException("foo.com#@#hello");
  testResult(test, "foo.com", [], true);
  testResult(test, "foo.com", [], false);
  testResult(test, "foo.com", []);
  testResult(test, "bar.com", [], true);
  testResult(test, "bar.com", ["hello"], false);
  testResult(test, "bar.com", ["hello"]);
  removeException("foo.com#@#hello");
  testResult(test, "foo.com", [], true);
  // Note: We don't take care to track conditional selectors which became
  //       unconditional when a filter was removed. This was too expensive.
  testResult(test, "foo.com", ["hello"], false);
  testResult(test, "foo.com", ["hello"]);
  testResult(test, "bar.com", [], true);
  testResult(test, "bar.com", ["hello"], false);
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
  ElemHideExceptions.add(Filter.fromText("foo.com#@#test"));
  testResult(test, "foo.com", []);
  testResult(test, "bar.com", ["test"]);
  test.done();
};
