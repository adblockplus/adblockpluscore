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

const library = require("../../lib/content/snippets.js");
const {timeout} = require("./_utils");

// We need this stub for the injector.
window.browser = {
  runtime: {
    getURL: () => ""
  }
};

async function runSnippet(test, snippetName, ...args)
{
  let snippet = library[snippetName];

  test.ok(snippet);

  snippet(...args);

  // For snippets that run in the context of the document via a <script>
  // element (i.e. snippets that use makeInjector()), we need to wait for
  // execution to be complete.
  await timeout(100);
}

exports.testAbortOnPropertyReadSnippet = async function(test)
{
  function testProperty(property, result = true, errorName = "ReferenceError")
  {
    let path = property.split(".");

    let exceptionCaught = false;
    let value = 1;

    try
    {
      let obj = window;
      while (path.length > 1)
        obj = obj[path.shift()];
      value = obj[path.shift()];
    }
    catch (e)
    {
      test.equal(e.name, errorName);
      exceptionCaught = true;
    }

    test.equal(
      exceptionCaught,
      result,
      `The property "${property}" ${result ? "should" : "shouldn't"} trigger an exception.`
    );
    test.equal(
      value,
      result ? 1 : undefined,
      `The value for "${property}" ${result ? "shouldn't" : "should"} have been read.`
    );
  }

  window.abpTest = "fortytwo";
  await runSnippet(test, "abort-on-property-read", "abpTest");
  testProperty("abpTest");

  window.abpTest2 = {prop1: "fortytwo"};
  await runSnippet(test, "abort-on-property-read", "abpTest2.prop1");
  testProperty("abpTest2.prop1");

  // Test that we try to catch a property that doesn't exist yet.
  await runSnippet(test, "abort-on-property-read", "abpTest3.prop1");
  window.abpTest3 = {prop1: "fortytwo"};
  testProperty("abpTest3.prop1");

  // Test that other properties don't trigger.
  testProperty("abpTest3.prop2", false);

  // Test overwriting the object with another object.
  window.abpTest4 = {prop3: {}};
  await runSnippet(test, "abort-on-property-read", "abpTest4.prop3.foo");
  testProperty("abpTest4.prop3.foo");
  window.abpTest4.prop3 = {};
  testProperty("abpTest4.prop3.foo");

  // Test if we start with a non-object.
  window.abpTest5 = 42;
  await runSnippet(test, "abort-on-property-read", "abpTest5.prop4.bar");

  testProperty("abpTest5.prop4.bar", true, "TypeError");

  window.abpTest5 = {prop4: 42};
  testProperty("abpTest5.prop4.bar", false);
  window.abpTest5 = {prop4: {}};
  testProperty("abpTest5.prop4.bar");

  test.done();
};
