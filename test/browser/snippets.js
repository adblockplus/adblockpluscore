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

  // Check that it works on properties that are functions.
  // https://issues.adblockplus.org/ticket/7419

  // Existing function (from the API).
  await runSnippet(test, "abort-on-property-read", "Object.keys");
  testProperty("Object.keys");

  // Function properties.
  window.abpTest6 = function() {};
  window.abpTest6.prop1 = function() {};
  await runSnippet(test, "abort-on-property-read", "abpTest6.prop1");
  testProperty("abpTest6.prop1");

  // Function properties, with sub-property set afterwards.
  window.abpTest7 = function() {};
  await runSnippet(test, "abort-on-property-read", "abpTest7.prop1");
  window.abpTest7.prop1 = function() {};
  testProperty("abpTest7.prop1");

  // Function properties, with base property as function set afterwards.
  await runSnippet(test, "abort-on-property-read", "abpTest8.prop1");
  window.abpTest8 = function() {};
  window.abpTest8.prop1 = function() {};
  testProperty("abpTest8.prop1");

  // Arrow function properties.
  window.abpTest9 = () => {};
  await runSnippet(test, "abort-on-property-read", "abpTest9");
  testProperty("abpTest9");

  // Class function properties.
  window.abpTest10 = class {};
  await runSnippet(test, "abort-on-property-read", "abpTest10");
  testProperty("abpTest10");

  // Class function properties with prototype function properties.
  window.abpTest11 = class {};
  window.abpTest11.prototype.prop1 = function() {};
  await runSnippet(test, "abort-on-property-read", "abpTest11.prototype.prop1");
  testProperty("abpTest11.prototype.prop1");

  // Class function properties with prototype function properties, with
  // prototype property set afterwards.
  window.abpTest12 = class {};
  await runSnippet(test, "abort-on-property-read", "abpTest12.prototype.prop1");
  window.abpTest12.prototype.prop1 = function() {};
  testProperty("abpTest12.prototype.prop1");

  test.done();
};

exports.testAbortCurrentInlineScriptSnippet = async function(test)
{
  function injectInlineScript(doc, script)
  {
    let scriptElement = doc.createElement("script");
    scriptElement.type = "application/javascript";
    scriptElement.async = false;
    scriptElement.textContent = script;
    doc.body.appendChild(scriptElement);
  }

  await runSnippet(
    test, "abort-current-inline-script", "document.write", "atob"
  );
  await runSnippet(
    test, "abort-current-inline-script", "document.write", "btoa"
  );

  document.body.innerHTML = "<p id=\"result1\"></p><p id=\"message1\"></p><p id=\"result2\"></p><p id=\"message2\"></p>";

  let script = `
    try
    {
      let element = document.getElementById("result1");
      document.write("<p>atob: " + atob("dGhpcyBpcyBhIGJ1Zw==") + "</p>");
      element.textContent = atob("dGhpcyBpcyBhIGJ1Zw==");
    }
    catch (e)
    {
      let msg = document.getElementById("message1");
      msg.textContent = e.name;
    }`;

  injectInlineScript(document, script);

  let element = document.getElementById("result1");
  test.ok(element, "Element 'result1' was not found");

  let msg = document.getElementById("message1");
  test.ok(msg, "Element 'message1' was not found");

  if (element && msg)
  {
    test.equals(element.textContent, "", "Result element should be empty");
    test.equals(msg.textContent, "ReferenceError",
                "There should have been an error");
  }

  script = `
    try
    {
      let element = document.getElementById("result2");
      document.write("<p>btoa: " + btoa("this is a bug") + "</p>");
      element.textContent = btoa("this is a bug");
    }
    catch (e)
    {
      let msg = document.getElementById("message2");
      msg.textContent = e.name;
    }`;

  injectInlineScript(document, script);

  element = document.getElementById("result2");
  test.ok(element, "Element 'result2' was not found");

  msg = document.getElementById("message2");
  test.ok(msg, "Element 'message2' was not found");

  if (element && msg)
  {
    test.equals(element.textContent, "", "Result element should be empty");
    test.equals(msg.textContent, "ReferenceError",
                "There should have been an error");
  }

  test.done();
};
