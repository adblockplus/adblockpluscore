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

let ElemHide = null;
let createStyleSheet = null;
let rulesFromStyleSheet = null;
let ElemHideExceptions = null;
let Filter = null;
let filtersByDomain = null;
let selectorGroupSize = null;

exports.setUp = function(callback)
{
  let sandboxedRequire = createSandbox({
    extraExports: {
      elemHide: ["filtersByDomain", "selectorGroupSize"]
    }
  });
  (
    {ElemHide, createStyleSheet, rulesFromStyleSheet,
     filtersByDomain, selectorGroupSize} = sandboxedRequire("../lib/elemHide"),
    {ElemHideExceptions} = sandboxedRequire("../lib/elemHideExceptions"),
    {Filter} = sandboxedRequire("../lib/filterClasses")
  );

  callback();
};

function normalizeSelectors(selectors)
{
  // generateStyleSheetForDomain is currently allowed to return duplicate
  // selectors for performance reasons, so we need to remove duplicates here.
  return selectors.slice().sort().filter((selector, index, sortedSelectors) =>
  {
    return index == 0 || selector != sortedSelectors[index - 1];
  });
}

function testResult(domain, expectedSelectors,
                    {specificOnly = false, expectedExceptions = []} = {})
{
  let normalizedExpectedSelectors = normalizeSelectors(expectedSelectors);

  let {code, selectors, exceptions} =
    ElemHide.generateStyleSheetForDomain(domain, specificOnly, true, true);

  assert.deepEqual(normalizeSelectors(selectors), normalizedExpectedSelectors);

  // Test for consistency in exception free case.
  assert.deepEqual(ElemHide.generateStyleSheetForDomain(
    domain, specificOnly, true, false), {
      code,
      selectors,
      exceptions: null
    });

  assert.deepEqual(exceptions.map(({text}) => text), expectedExceptions);

  // Make sure each expected selector is in the actual CSS code.
  for (let selector of normalizedExpectedSelectors)
  {
    assert.ok(code.includes(selector + ", ") ||
              code.includes(selector + " {display: none !important;}\n"));
  }
}

exports.testGenerateStyleSheetForDomain = function(test)
{
  let addFilter = filterText => ElemHide.add(Filter.fromText(filterText));
  let removeFilter = filterText => ElemHide.remove(Filter.fromText(filterText));
  let addException =
    filterText => ElemHideExceptions.add(Filter.fromText(filterText));
  let removeException =
    filterText => ElemHideExceptions.remove(Filter.fromText(filterText));

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

  addException("example.com#@#foo");
  testResult("foo.example.com", ["turnip"]);
  testResult("example.com", [], {
    expectedExceptions: ["example.com#@#foo"]
  });
  testResult("com", []);
  testResult("", []);

  addFilter("com##bar");
  testResult("foo.example.com", ["turnip", "bar"]);
  testResult("example.com", ["bar"], {
    expectedExceptions: ["example.com#@#foo"]
  });
  testResult("com", ["bar"]);
  testResult("", []);

  addException("example.com#@#bar");
  testResult("foo.example.com", ["turnip"], {
    expectedExceptions: ["example.com#@#bar"]
  });
  testResult("example.com", [], {
    expectedExceptions: ["example.com#@#foo", "example.com#@#bar"]
  });
  testResult("com", ["bar"]);
  testResult("", []);

  removeException("example.com#@#foo");
  testResult("foo.example.com", ["turnip"], {
    expectedExceptions: ["example.com#@#bar"]
  });
  testResult("example.com", ["foo"], {
    expectedExceptions: ["example.com#@#bar"]
  });
  testResult("com", ["bar"]);
  testResult("", []);

  removeException("example.com#@#bar");
  testResult("foo.example.com", ["turnip", "bar"]);
  testResult("example.com", ["foo", "bar"]);
  testResult("com", ["bar"]);
  testResult("", []);

  addFilter("##generic");
  testResult("foo.example.com", ["turnip", "bar", "generic"]);
  testResult("example.com", ["foo", "bar", "generic"]);
  testResult("com", ["bar", "generic"]);
  testResult("", ["generic"]);
  testResult("foo.example.com", ["turnip", "bar"], {specificOnly: true});
  testResult("example.com", ["foo", "bar"], {specificOnly: true});
  testResult("com", ["bar"], {specificOnly: true});
  testResult("", [], {specificOnly: true});
  removeFilter("##generic");

  addFilter("~adblockplus.org##example");
  testResult("adblockplus.org", []);
  testResult("", ["example"]);
  testResult("foo.example.com", ["turnip", "bar", "example"]);
  testResult("foo.example.com", ["turnip", "bar"], {specificOnly: true});
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
  testResult("foo.com", ["specific"], {specificOnly: true});
  testResult("foo.com", ["hello", "specific", "world"]);
  testResult("example.com", [], {specificOnly: true});
  removeFilter("foo.com##specific");
  removeFilter("~example.com##world");
  removeFilter("##hello");
  testResult("foo.com", []);

  addFilter("##hello");
  testResult("foo.com", [], {specificOnly: true});
  testResult("foo.com", ["hello"]);
  testResult("bar.com", [], {specificOnly: true});
  testResult("bar.com", ["hello"]);
  addException("foo.com#@#hello");
  testResult("foo.com", [], {specificOnly: true});
  testResult("foo.com", [], {expectedExceptions: ["foo.com#@#hello"]});
  testResult("bar.com", [], {specificOnly: true});
  testResult("bar.com", ["hello"]);
  removeException("foo.com#@#hello");
  testResult("foo.com", [], {specificOnly: true});
  // Note: We don't take care to track conditional selectors which became
  //       unconditional when a filter was removed. This was too expensive.
  testResult("foo.com", ["hello"]);
  testResult("bar.com", [], {specificOnly: true});
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

  test.done();
};

exports.testZeroFilterKey = function(test)
{
  ElemHide.add(Filter.fromText("##test"));
  ElemHideExceptions.add(Filter.fromText("foo.com#@#test"));
  testResult("foo.com", [], {expectedExceptions: ["foo.com#@#test"]});
  testResult("bar.com", ["test"]);
  test.done();
};

exports.testFiltersByDomain = function(test)
{
  assert.equal(filtersByDomain.size, 0);

  ElemHide.add(Filter.fromText("##test"));
  assert.equal(filtersByDomain.size, 0);

  ElemHide.add(Filter.fromText("example.com##test"));
  assert.equal(filtersByDomain.size, 1);

  ElemHide.add(Filter.fromText("example.com,~www.example.com##test"));
  assert.equal(filtersByDomain.size, 2);

  ElemHide.remove(Filter.fromText("example.com##test"));
  assert.equal(filtersByDomain.size, 2);

  ElemHide.remove(Filter.fromText("example.com,~www.example.com##test"));
  assert.equal(filtersByDomain.size, 0);

  test.done();
};

exports.testCreateStyleSheet = function(test)
{
  assert.equal(
    createStyleSheet([
      "html", "#foo", ".bar", "#foo .bar", "#foo > .bar",
      "#foo[data-bar='bar']"
    ]),
    "html, #foo, .bar, #foo .bar, #foo > .bar, #foo[data-bar='bar'] " +
    "{display: none !important;}\n",
    "Style sheet creation should work"
  );

  let selectors = new Array(50000).fill().map((element, index) => ".s" + index);

  assert.equal((createStyleSheet(selectors).match(/\n/g) || []).length,
             Math.ceil(50000 / selectorGroupSize),
             "Style sheet should be split up into rules with at most " +
             selectorGroupSize + " selectors each");

  assert.equal(
    createStyleSheet([
      "html", "#foo", ".bar", "#foo .bar", "#foo > .bar",
      "#foo[data-bar='{foo: 1}']"
    ]),
    "html, #foo, .bar, #foo .bar, #foo > .bar, " +
    "#foo[data-bar='\\7B foo: 1\\7D '] {display: none !important;}\n",
    "Braces should be escaped"
  );

  test.done();
};

exports.testRulesFromStyleSheet = function(test)
{
  // Note: The rulesFromStyleSheet function assumes that each rule will be
  // terminated with a newline character, including the last rule. If this is
  // not the case, the function goes into an infinite loop. It should only be
  // used with the return value of the createStyleSheet function.

  assert.deepEqual([...rulesFromStyleSheet("")], []);
  assert.deepEqual([...rulesFromStyleSheet("#foo {}\n")], ["#foo {}"]);
  assert.deepEqual([...rulesFromStyleSheet("#foo {}\n#bar {}\n")],
                 ["#foo {}", "#bar {}"]);

  test.done();
};
