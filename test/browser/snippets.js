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

function expectHidden(element, id)
{
  let withId = "";
  if (typeof id != "undefined")
    withId = ` with ID '${id}'`;

  assert.equal(
    window.getComputedStyle(element).display, "none",
    `The element${withId}'s display property should be set to 'none'`);
}

function expectVisible(element, id)
{
  let withId = "";
  if (typeof id != "undefined")
    withId = ` with ID '${id}'`;

  assert.notEqual(
    window.getComputedStyle(element).display, "none",
    `The element${withId}'s display property should not be set to 'none'`);
}

async function runSnippet(test, snippetName, ...args)
{
  let snippet = library[snippetName];

  assert.ok(snippet);

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
      assert.equal(e.name, errorName);
      exceptionCaught = true;
    }

    assert.equal(
      exceptionCaught,
      result,
      `The property "${property}" ${result ? "should" : "shouldn't"} trigger an exception.`
    );
    assert.equal(
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
  assert.ok(element, "Element 'result1' was not found");

  let msg = document.getElementById("message1");
  assert.ok(msg, "Element 'message1' was not found");

  if (element && msg)
  {
    assert.equal(element.textContent, "", "Result element should be empty");
    assert.equal(msg.textContent, "ReferenceError",
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
  assert.ok(element, "Element 'result2' was not found");

  msg = document.getElementById("message2");
  assert.ok(msg, "Element 'message2' was not found");

  if (element && msg)
  {
    assert.equal(element.textContent, "", "Result element should be empty");
    assert.equal(msg.textContent, "ReferenceError",
                 "There should have been an error");
  }

  test.done();
};

exports.testHideIfContainsVisibleText = async function(test)
{
  document.body.innerHTML = `
    <style type="text/css">
      body {
        margin: 0;
        padding: 0;
      }
      .transparent {
        opacity: 0;
        position: absolute;
        display: block;
      }
      .zerosize {
        font-size: 0;
      }
      div {
        display: block;
      }
      .a {
        display: inline-block;
        white-space: pre-wrap;
      }
      .disp_none {
        display: none;
      }
      .vis_hid {
        visibility: hidden;
      }
      .vis_collapse {
        visibility: collapse;
      }
      .same_colour {
        color: rgb(255,255,255);
        background-color: rgb(255,255,255);
      }
      .transparent {
        color: transparent;
      }
      #label {
        overflow-wrap: break-word;
      }
    </style>
    <div id="parent">
      <div id="middle">
        <div id="middle1"><div id="inside" class="inside"></div></div>
      </div>
      <div id="sibling">
        <div id="tohide">to hide \ud83d\ude42!</div>
      </div>
      <div id="sibling2">
        <div id="sibling21"><div id="sibling211" class="inside">Ad*</div></div>
      </div>
      <div id="label">
        <div id="content"><div class="a transparent">Sp</div><div class="a">Sp</div><div class="a zerosize">S</div><div class="a transparent">on</div><div class="a">on</div><div class="a zerosize">S</div></div>
      </div>
      <div id="label2">
        <div class="a vis_hid">Visibility: hidden</div><div class="a">S</div><div class="a vis_collapse">Visibility: collapse</div><div class="a">p</div><div class="a disp_none">Display: none</div><div class="a">o</div><div class="a same_colour">Same colour</div><div class="a transparent">Transparent</div><div class="a">n</div>
      </div>
      <article id="article">
        <div style="display: none"><a href="foo"><div>Spon</div></a>Visit us</div>
      </article>
      <article id="article2">
        <div><a href="foo"><div>Spon</div></a>By this</div>
      </article>
      <article id="article3">
        <div><a href="foo"><div>by Writer</div></a> about the Sponsorship.</div>
      </article>
    </div>`;

  await runSnippet(
    test, "hide-if-contains-visible-text", "Spon", "#parent > div"
  );

  let element = document.getElementById("label");
  expectHidden(element, "label");
  element = document.getElementById("label2");
  expectHidden(element, "label2");

  element = document.getElementById("article");
  expectVisible(element, "article");
  element = document.getElementById("article2");
  expectVisible(element, "article2");

  await runSnippet(
    test, "hide-if-contains-visible-text", "Spon", "#parent > article", "#parent > article a"
  );

  element = document.getElementById("article");
  expectVisible(element, "article");
  element = document.getElementById("article2");
  expectHidden(element, "article2");
  element = document.getElementById("article3");
  expectVisible(element, "article3");

  test.done();
};
