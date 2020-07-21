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
/* global chai */
/* eslint no-new-func: "off" */

"use strict";

const libraryText = require("raw-loader!../../lib/content/snippets.js");
const {compileScript} = require("../../lib/snippets.js");
const {timeout} = require("./_utils");

const {assert} = chai;

describe("Snippets", function()
{
  before(function()
  {
    // We need this stub for the injector.
    window.browser = {
      runtime: {
        getURL: () => ""
      }
    };
  });

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

  async function runSnippetScript(script)
  {
    new Function(compileScript(script, [libraryText]))();

    // For snippets that run in the context of the document via a <script>
    // element (i.e. snippets that use makeInjector()), we need to wait for
    // execution to be complete.
    await timeout(100);
  }

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

  it("abort-property-read", async function()
  {
    window.abpTest = "fortytwo";
    await runSnippetScript("abort-on-property-read abpTest");
    testProperty("abpTest");

    window.abpTest2 = {prop1: "fortytwo"};
    await runSnippetScript("abort-on-property-read abpTest2.prop1");
    testProperty("abpTest2.prop1");

    // Test that we try to catch a property that doesn't exist yet.
    await runSnippetScript("abort-on-property-read abpTest3.prop1");
    window.abpTest3 = {prop1: "fortytwo"};
    testProperty("abpTest3.prop1");

    // Test that other properties don't trigger.
    testProperty("abpTest3.prop2", false);

    // Test overwriting the object with another object.
    window.abpTest4 = {prop3: {}};
    await runSnippetScript("abort-on-property-read abpTest4.prop3.foo");
    testProperty("abpTest4.prop3.foo");
    window.abpTest4.prop3 = {};
    testProperty("abpTest4.prop3.foo");

    // Test if we start with a non-object.
    window.abpTest5 = 42;
    await runSnippetScript("abort-on-property-read abpTest5.prop4.bar");

    testProperty("abpTest5.prop4.bar", true, "TypeError");

    window.abpTest5 = {prop4: 42};
    testProperty("abpTest5.prop4.bar", false);
    window.abpTest5 = {prop4: {}};
    testProperty("abpTest5.prop4.bar");

    // Check that it works on properties that are functions.
    // https://issues.adblockplus.org/ticket/7419

    // Existing function (from the API).
    await runSnippetScript("abort-on-property-read Object.keys");
    testProperty("Object.keys");

    // Function properties.
    window.abpTest6 = function() {};
    window.abpTest6.prop1 = function() {};
    await runSnippetScript("abort-on-property-read abpTest6.prop1");
    testProperty("abpTest6.prop1");

    // Function properties, with sub-property set afterwards.
    window.abpTest7 = function() {};
    await runSnippetScript("abort-on-property-read abpTest7.prop1");
    window.abpTest7.prop1 = function() {};
    testProperty("abpTest7.prop1");

    // Function properties, with base property as function set afterwards.
    await runSnippetScript("abort-on-property-read abpTest8.prop1");
    window.abpTest8 = function() {};
    window.abpTest8.prop1 = function() {};
    testProperty("abpTest8.prop1");

    // Arrow function properties.
    window.abpTest9 = () => {};
    await runSnippetScript("abort-on-property-read abpTest9");
    testProperty("abpTest9");

    // Class function properties.
    window.abpTest10 = class {};
    await runSnippetScript("abort-on-property-read abpTest10");
    testProperty("abpTest10");

    // Class function properties with prototype function properties.
    window.abpTest11 = class {};
    window.abpTest11.prototype.prop1 = function() {};
    await runSnippetScript("abort-on-property-read abpTest11.prototype.prop1");
    testProperty("abpTest11.prototype.prop1");

    // Class function properties with prototype function properties, with
    // prototype property set afterwards.
    window.abpTest12 = class {};
    await runSnippetScript("abort-on-property-read abpTest12.prototype.prop1");
    window.abpTest12.prototype.prop1 = function() {};
    testProperty("abpTest12.prototype.prop1");
  });

  it("abort-on-propery-write", async function()
  {
    try
    {
      await runSnippetScript("abort-on-property-write document.createElement");

      let element = document.createElement("script");
      assert.ok(!!element);
    }
    catch (error)
    {
      assert.fail(error);
    }
  });

  it("abort-curent-inline-script", async function()
  {
    function injectInlineScript(doc, script)
    {
      let scriptElement = doc.createElement("script");
      scriptElement.type = "application/javascript";
      scriptElement.async = false;
      scriptElement.textContent = script;
      doc.body.appendChild(scriptElement);
    }

    await runSnippetScript(
      "abort-current-inline-script document.write atob"
    );
    await runSnippetScript(
      "abort-current-inline-script document.write btoa"
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
  });

  it("json-prune", async function()
  {
    // ensure the JSON object is the window one, not one
    // the testing environment is providing
    let {JSON} = window;
    await runSnippetScript("json-prune toBeDeleted");
    let testProp = {
      toBeDeleted: "delete me",
      a: "a"
    };
    let result = JSON.parse(JSON.stringify(testProp));
    delete testProp.toBeDeleted;
    assert.equal(JSON.stringify(testProp), JSON.stringify(result));

    await runSnippetScript("json-prune toBeDeleted2 a");
    let testProp2 = {
      toBeDeleted2: "delete me",
      a: "a"
    };
    let testProp3 = {
      toBeDeleted2: "don't delete me",
      b: "b"
    };
    let result2 = JSON.parse(JSON.stringify(testProp2));
    let result3 = JSON.parse(JSON.stringify(testProp3));
    delete testProp2.toBeDeleted2;
    assert.equal(JSON.stringify(testProp2), JSON.stringify(result2));
    assert.equal(JSON.stringify(testProp3), JSON.stringify(result3));
  });

  it("hide-if-contains-visible-text", async function()
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
        #pseudo .static::before {
          content: "sp";
        }
        #pseudo .static::after {
          content: "ky";
        }
        #pseudo .attr::before {
          content: attr(data-before);
        }
        #pseudo .attr::after {
          content: attr(data-after) "ky";
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
      </div>
      <div id="pseudo">
        <div class="static">oo</div>
        <div>ok</div>
        <div class="attr" data-before="sp">oo</div>
      </div>`;

    await runSnippetScript(
      "hide-if-contains-visible-text Spon '#parent > div'"
    );

    let element = document.getElementById("label");
    expectHidden(element, "label");
    element = document.getElementById("label2");
    expectHidden(element, "label2");

    element = document.getElementById("article");
    expectVisible(element, "article");
    element = document.getElementById("article2");
    expectVisible(element, "article2");

    await runSnippetScript(
      "hide-if-contains-visible-text Spon '#parent > article' '#parent > article a'"
    );

    element = document.getElementById("article");
    expectVisible(element, "article");
    element = document.getElementById("article2");
    expectHidden(element, "article2");
    element = document.getElementById("article3");
    expectVisible(element, "article3");

    await runSnippetScript(
      "hide-if-contains-visible-text spooky '#pseudo > div'"
    );

    element = document.getElementById("pseudo");
    expectHidden(element.querySelector(".static"), "#pseudo .static");
    expectHidden(element.querySelector(".attr"), "#pseudo .attr");
    expectVisible(element.children[1], "#pseudo div");
  });

  it("hide-if-contains-image-hash", async function()
  {
    document.body.innerHTML = "<img id=\"img-1\" src=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAABhGlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV9ba0WqDnZQcchQnSyIijhqFYpQIdQKrTqYXPoFTRqSFBdHwbXg4Mdi1cHFWVcHV0EQ/ABxcXVSdJES/5cUWsR4cNyPd/ced+8Af73MVLNjHFA1y0gl4kImuyqEXhFEJ0IYRK/ETH1OFJPwHF/38PH1LsazvM/9OXqUnMkAn0A8y3TDIt4gnt60dM77xBFWlBTic+Ixgy5I/Mh12eU3zgWH/TwzYqRT88QRYqHQxnIbs6KhEk8RRxVVo3x/xmWF8xZntVxlzXvyF4Zz2soy12kOI4FFLEGEABlVlFCGhRitGikmUrQf9/APOX6RXDK5SmDkWEAFKiTHD/4Hv7s185MTblI4DgRfbPtjBAjtAo2abX8f23bjBAg8A1day1+pAzOfpNdaWvQI6NsGLq5bmrwHXO4AA0+6ZEiOFKDpz+eB9zP6pizQfwt0r7m9Nfdx+gCkqavkDXBwCIwWKHvd491d7b39e6bZ3w/1+HJ1S9l56wAAAAlwSFlzAAAuIwAALiMBeKU/dgAAAAd0SU1FB+MFBgcZNA50WAgAAAAMSURBVAjXY/j//z8ABf4C/tzMWecAAAAASUVORK5CYII=\" /><img id=\"img-2\" src=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAABhGlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV9bS0tpdbCDiEOG6mRBVMRRq1CECqFWaNXB5NIvaGJIUlwcBdeCgx+LVQcXZ10dXAVB8APExdVJ0UVK/F9SaBHjwXE/3t173L0D/M0aU82eMUDVLCObTgn5wooQekUQYcQQQa/ETH1WFDPwHF/38PH1LsmzvM/9OWJK0WSATyCeYbphEa8TT21aOud94jirSArxOfGoQRckfuS67PIb57LDfp4ZN3LZOeI4sVDuYrmLWcVQiSeJE4qqUb4/77LCeYuzWquz9j35C6NFbXmJ6zSHkMYCFiFCgIw6qqjBQpJWjRQTWdpPefgHHb9ILplcVTByzGMDKiTHD/4Hv7s1SxPjblI0BQRfbPtjGAjtAq2GbX8f23brBAg8A1dax7/RBKY/SW90tMQR0LcNXFx3NHkPuNwBBp50yZAcKUDTXyoB72f0TQWg/xaIrLq9tfdx+gDkqKvMDXBwCIyUKXvN493h7t7+PdPu7wfkk3Juqb5bhwAAAAlwSFlzAAAuIwAALiMBeKU/dgAAAAd0SU1FB+MFCA0KNmzdilMAAAAZdEVYdENvbW1lbnQAQ3JlYXRlZCB3aXRoIEdJTVBXgQ4XAAAADElEQVQI12NgYGAAAAAEAAEnNCcKAAAAAElFTkSuQmCC\" />";

    await runSnippetScript("hide-if-contains-image-hash 8000000000000000");

    // Since the images are blocked via an async event handler (onload) we need
    // to give the snippet an opportunity to execute
    await timeout(100);

    expectHidden(document.getElementById("img-1"), "img-1");
    expectVisible(document.getElementById("img-2"), "img-2");

    document.body.innerHTML = "<div id=\"div-1\"><img id=\"img-1\" src=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAABhGlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV9ba0WqDnZQcchQnSyIijhqFYpQIdQKrTqYXPoFTRqSFBdHwbXg4Mdi1cHFWVcHV0EQ/ABxcXVSdJES/5cUWsR4cNyPd/ced+8Af73MVLNjHFA1y0gl4kImuyqEXhFEJ0IYRK/ETH1OFJPwHF/38PH1LsazvM/9OXqUnMkAn0A8y3TDIt4gnt60dM77xBFWlBTic+Ixgy5I/Mh12eU3zgWH/TwzYqRT88QRYqHQxnIbs6KhEk8RRxVVo3x/xmWF8xZntVxlzXvyF4Zz2soy12kOI4FFLEGEABlVlFCGhRitGikmUrQf9/APOX6RXDK5SmDkWEAFKiTHD/4Hv7s185MTblI4DgRfbPtjBAjtAo2abX8f23bjBAg8A1day1+pAzOfpNdaWvQI6NsGLq5bmrwHXO4AA0+6ZEiOFKDpz+eB9zP6pizQfwt0r7m9Nfdx+gCkqavkDXBwCIwWKHvd491d7b39e6bZ3w/1+HJ1S9l56wAAAAlwSFlzAAAuIwAALiMBeKU/dgAAAAd0SU1FB+MFBgcZNA50WAgAAAAMSURBVAjXY/j//z8ABf4C/tzMWecAAAAASUVORK5CYII=\" /></div>";

    await runSnippetScript("hide-if-contains-image-hash 8000000000000000 #div-1");

    await timeout(100);

    expectHidden(document.getElementById("div-1"), "div-1");
    expectVisible(document.getElementById("img-1"), "img-1");

    document.body.innerHTML = "<img id=\"img-1\" src=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAABhGlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV9ba0WqDnZQcchQnSyIijhqFYpQIdQKrTqYXPoFTRqSFBdHwbXg4Mdi1cHFWVcHV0EQ/ABxcXVSdJES/5cUWsR4cNyPd/ced+8Af73MVLNjHFA1y0gl4kImuyqEXhFEJ0IYRK/ETH1OFJPwHF/38PH1LsazvM/9OXqUnMkAn0A8y3TDIt4gnt60dM77xBFWlBTic+Ixgy5I/Mh12eU3zgWH/TwzYqRT88QRYqHQxnIbs6KhEk8RRxVVo3x/xmWF8xZntVxlzXvyF4Zz2soy12kOI4FFLEGEABlVlFCGhRitGikmUrQf9/APOX6RXDK5SmDkWEAFKiTHD/4Hv7s185MTblI4DgRfbPtjBAjtAo2abX8f23bjBAg8A1day1+pAzOfpNdaWvQI6NsGLq5bmrwHXO4AA0+6ZEiOFKDpz+eB9zP6pizQfwt0r7m9Nfdx+gCkqavkDXBwCIwWKHvd491d7b39e6bZ3w/1+HJ1S9l56wAAAAlwSFlzAAAuIwAALiMBeKU/dgAAAAd0SU1FB+MFBgcZNA50WAgAAAAMSURBVAjXY/j//z8ABf4C/tzMWecAAAAASUVORK5CYII=\" /><img id=\"img-2\" src=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAABhGlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV9bS0tpdbCDiEOG6mRBVMRRq1CECqFWaNXB5NIvaGJIUlwcBdeCgx+LVQcXZ10dXAVB8APExdVJ0UVK/F9SaBHjwXE/3t173L0D/M0aU82eMUDVLCObTgn5wooQekUQYcQQQa/ETH1WFDPwHF/38PH1LsmzvM/9OWJK0WSATyCeYbphEa8TT21aOud94jirSArxOfGoQRckfuS67PIb57LDfp4ZN3LZOeI4sVDuYrmLWcVQiSeJE4qqUb4/77LCeYuzWquz9j35C6NFbXmJ6zSHkMYCFiFCgIw6qqjBQpJWjRQTWdpPefgHHb9ILplcVTByzGMDKiTHD/4Hv7s1SxPjblI0BQRfbPtjGAjtAq2GbX8f23brBAg8A1dax7/RBKY/SW90tMQR0LcNXFx3NHkPuNwBBp50yZAcKUDTXyoB72f0TQWg/xaIrLq9tfdx+gDkqKvMDXBwCIyUKXvN493h7t7+PdPu7wfkk3Juqb5bhwAAAAlwSFlzAAAuIwAALiMBeKU/dgAAAAd0SU1FB+MFCA0KNmzdilMAAAAZdEVYdENvbW1lbnQAQ3JlYXRlZCB3aXRoIEdJTVBXgQ4XAAAADElEQVQI12NgYGAAAAAEAAEnNCcKAAAAAElFTkSuQmCC\" />";

    await runSnippetScript("hide-if-contains-image-hash 0800000000000000 '' 1");

    await timeout(100);

    expectVisible(document.getElementById("img-1"), "img-1");
    expectHidden(document.getElementById("img-2"), "img-2");

    document.body.innerHTML = "<img id=\"img-1\" src=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAABhGlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV9ba0WqDnZQcchQnSyIijhqFYpQIdQKrTqYXPoFTRqSFBdHwbXg4Mdi1cHFWVcHV0EQ/ABxcXVSdJES/5cUWsR4cNyPd/ced+8Af73MVLNjHFA1y0gl4kImuyqEXhFEJ0IYRK/ETH1OFJPwHF/38PH1LsazvM/9OXqUnMkAn0A8y3TDIt4gnt60dM77xBFWlBTic+Ixgy5I/Mh12eU3zgWH/TwzYqRT88QRYqHQxnIbs6KhEk8RRxVVo3x/xmWF8xZntVxlzXvyF4Zz2soy12kOI4FFLEGEABlVlFCGhRitGikmUrQf9/APOX6RXDK5SmDkWEAFKiTHD/4Hv7s185MTblI4DgRfbPtjBAjtAo2abX8f23bjBAg8A1day1+pAzOfpNdaWvQI6NsGLq5bmrwHXO4AA0+6ZEiOFKDpz+eB9zP6pizQfwt0r7m9Nfdx+gCkqavkDXBwCIwWKHvd491d7b39e6bZ3w/1+HJ1S9l56wAAAAlwSFlzAAAuIwAALiMBeKU/dgAAAAd0SU1FB+MFBgcZNA50WAgAAAAMSURBVAjXY/j//z8ABf4C/tzMWecAAAAASUVORK5CYII=\" />";

    await runSnippetScript(
      "hide-if-contains-image-hash 8000000000000000000000000000000000000000000000000000000000000000 '' 0 16");

    await timeout(100);

    expectHidden(document.getElementById("img-1"), "img-1");

    document.body.innerHTML = "<img id=\"img-1\" src=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAABhGlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV9bS0tpdbCDiEOG6mRBVMRRq1CECqFWaNXB5NIvaGJIUlwcBdeCgx+LVQcXZ10dXAVB8APExdVJ0UVK/F9SaBHjwXE/3t173L0D/M0aU82eMUDVLCObTgn5wooQekUQYcQQQa/ETH1WFDPwHF/38PH1LsmzvM/9OWJK0WSATyCeYbphEa8TT21aOud94jirSArxOfGoQRckfuS67PIb57LDfp4ZN3LZOeI4sVDuYrmLWcVQiSeJE4qqUb4/77LCeYuzWquz9j35C6NFbXmJ6zSHkMYCFiFCgIw6qqjBQpJWjRQTWdpPefgHHb9ILplcVTByzGMDKiTHD/4Hv7s1SxPjblI0BQRfbPtjGAjtAq2GbX8f23brBAg8A1dax7/RBKY/SW90tMQR0LcNXFx3NHkPuNwBBp50yZAcKUDTXyoB72f0TQWg/xaIrLq9tfdx+gDkqKvMDXBwCIyUKXvN493h7t7+PdPu7wfkk3Juqb5bhwAAAAlwSFlzAAAuIwAALiMBeKU/dgAAAAd0SU1FB+MFCQkxNu/aqtIAAAAZdEVYdENvbW1lbnQAQ3JlYXRlZCB3aXRoIEdJTVBXgQ4XAAAAD0lEQVQI12P4//8/AwMDAA74Av7BVpVFAAAAAElFTkSuQmCC\" />";

    await runSnippetScript("hide-if-contains-image-hash 8000000000000000 '' 0 8 0x0x1x1");

    await timeout(100);

    expectHidden(document.getElementById("img-1"), "img-1");

    document.body.innerHTML = "<img id=\"img-1\" src=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAABhGlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV9bS0tpdbCDiEOG6mRBVMRRq1CECqFWaNXB5NIvaGJIUlwcBdeCgx+LVQcXZ10dXAVB8APExdVJ0UVK/F9SaBHjwXE/3t173L0D/M0aU82eMUDVLCObTgn5wooQekUQYcQQQa/ETH1WFDPwHF/38PH1LsmzvM/9OWJK0WSATyCeYbphEa8TT21aOud94jirSArxOfGoQRckfuS67PIb57LDfp4ZN3LZOeI4sVDuYrmLWcVQiSeJE4qqUb4/77LCeYuzWquz9j35C6NFbXmJ6zSHkMYCFiFCgIw6qqjBQpJWjRQTWdpPefgHHb9ILplcVTByzGMDKiTHD/4Hv7s1SxPjblI0BQRfbPtjGAjtAq2GbX8f23brBAg8A1dax7/RBKY/SW90tMQR0LcNXFx3NHkPuNwBBp50yZAcKUDTXyoB72f0TQWg/xaIrLq9tfdx+gDkqKvMDXBwCIyUKXvN493h7t7+PdPu7wfkk3Juqb5bhwAAAAlwSFlzAAAuIwAALiMBeKU/dgAAAAd0SU1FB+MFCQkxNu/aqtIAAAAZdEVYdENvbW1lbnQAQ3JlYXRlZCB3aXRoIEdJTVBXgQ4XAAAAD0lEQVQI12P4//8/AwMDAA74Av7BVpVFAAAAAElFTkSuQmCC\" />";

    await runSnippetScript(
      "hide-if-contains-image-hash 0000000000000000 '' 0 8 1x0x1x1");

    await timeout(100);

    expectHidden(document.getElementById("img-1"), "img-1");

    document.body.innerHTML = "<img id=\"img-1\" src=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAABhGlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV9bS0tpdbCDiEOG6mRBVMRRq1CECqFWaNXB5NIvaGJIUlwcBdeCgx+LVQcXZ10dXAVB8APExdVJ0UVK/F9SaBHjwXE/3t173L0D/M0aU82eMUDVLCObTgn5wooQekUQYcQQQa/ETH1WFDPwHF/38PH1LsmzvM/9OWJK0WSATyCeYbphEa8TT21aOud94jirSArxOfGoQRckfuS67PIb57LDfp4ZN3LZOeI4sVDuYrmLWcVQiSeJE4qqUb4/77LCeYuzWquz9j35C6NFbXmJ6zSHkMYCFiFCgIw6qqjBQpJWjRQTWdpPefgHHb9ILplcVTByzGMDKiTHD/4Hv7s1SxPjblI0BQRfbPtjGAjtAq2GbX8f23brBAg8A1dax7/RBKY/SW90tMQR0LcNXFx3NHkPuNwBBp50yZAcKUDTXyoB72f0TQWg/xaIrLq9tfdx+gDkqKvMDXBwCIyUKXvN493h7t7+PdPu7wfkk3Juqb5bhwAAAAlwSFlzAAAuIwAALiMBeKU/dgAAAAd0SU1FB+MFCQkxNu/aqtIAAAAZdEVYdENvbW1lbnQAQ3JlYXRlZCB3aXRoIEdJTVBXgQ4XAAAAD0lEQVQI12P4//8/AwMDAA74Av7BVpVFAAAAAElFTkSuQmCC\" />";

    await runSnippetScript(
      "hide-if-contains-image-hash 0000000000000000 '' 0 8 1x0x1x1");

    await timeout(100);

    expectHidden(document.getElementById("img-1"), "img-1");

    document.body.innerHTML = "<img id=\"img-1\" src=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAABhGlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV9bS0tpdbCDiEOG6mRBVMRRq1CECqFWaNXB5NIvaGJIUlwcBdeCgx+LVQcXZ10dXAVB8APExdVJ0UVK/F9SaBHjwXE/3t173L0D/M0aU82eMUDVLCObTgn5wooQekUQYcQQQa/ETH1WFDPwHF/38PH1LsmzvM/9OWJK0WSATyCeYbphEa8TT21aOud94jirSArxOfGoQRckfuS67PIb57LDfp4ZN3LZOeI4sVDuYrmLWcVQiSeJE4qqUb4/77LCeYuzWquz9j35C6NFbXmJ6zSHkMYCFiFCgIw6qqjBQpJWjRQTWdpPefgHHb9ILplcVTByzGMDKiTHD/4Hv7s1SxPjblI0BQRfbPtjGAjtAq2GbX8f23brBAg8A1dax7/RBKY/SW90tMQR0LcNXFx3NHkPuNwBBp50yZAcKUDTXyoB72f0TQWg/xaIrLq9tfdx+gDkqKvMDXBwCIyUKXvN493h7t7+PdPu7wfkk3Juqb5bhwAAAAlwSFlzAAAuIwAALiMBeKU/dgAAAAd0SU1FB+MFCQkxNu/aqtIAAAAZdEVYdENvbW1lbnQAQ3JlYXRlZCB3aXRoIEdJTVBXgQ4XAAAAD0lEQVQI12P4//8/AwMDAA74Av7BVpVFAAAAAElFTkSuQmCC\" />";

    await runSnippetScript(
      "hide-if-contains-image-hash 8000000000000000 '' 0 8 1x1x-1x-1");

    await timeout(100);

    expectHidden(document.getElementById("img-1"), "img-1");
  });

  it("does not leak snippets to the global scope", async function()
  {
    assert.ok(typeof window.log === "undefined", "The window has no log function");
    await runSnippetScript("trace OK");
    assert.ok(typeof window.log === "undefined", "The window was not polluted");
  });

  it("debug flag", async function()
  {
    function injectInlineScript(doc, script)
    {
      let scriptElement = doc.createElement("script");
      scriptElement.type = "application/javascript";
      scriptElement.async = false;
      scriptElement.textContent = script;
      doc.body.appendChild(scriptElement);
    }

    let logArgs = [];

    // Type 1 test: no debug
    let {log} = console;
    console.log = (...args) =>
    {
      console.log = log;
      logArgs = args.join(",");
    };
    runSnippetScript("log 1 2");
    assert.strictEqual(logArgs, "1,2", "type 1 debug flag should be false");

    // Type 2 test: no debug
    injectInlineScript(document, `(() =>
    {
      let {log} = console;
      console.log = (...args) =>
      {
        console.log = log;
        document.log = args.join(",");
      }
    })();`);
    await runSnippetScript("trace 1 2");
    assert.strictEqual(document.log, "1,2",
                       "type 2 debug flag should be false");


    // Type 1 test: debug flag enabled
    console.log = (...args) =>
    {
      console.log = log;
      logArgs = args.join(",");
    };
    await runSnippetScript("debug; log 1 2");
    assert.strictEqual(logArgs, "%c DEBUG,font-weight: bold,1,2",
                       "type 1 debug flag should be true");

    // Type 2 test: debug flag enabled
    injectInlineScript(document, `(() =>
    {
      let {log} = console;
      console.log = (...args) =>
      {
        console.log = log;
        document.log = args.join(",");
      }
    })();`);
    await runSnippetScript("debug; trace 1 2");
    assert.strictEqual(document.log, "%c DEBUG,font-weight: bold,1,2",
                       "type 2 debug flag should be true");

    delete document.log;
  });

  it("hide-if-matches-xpath", async function()
  {
    document.body.innerHTML = '<div id="xpath-target"></div>';
    let target = document.getElementById("xpath-target");
    expectVisible(target);
    await runSnippetScript("hide-if-matches-xpath //*[@id=\"xpath-target\"]");
    expectHidden(target);
  });

  it("hide-if-matches-xpath lazily", async function()
  {
    await runSnippetScript("hide-if-matches-xpath //*[@id=\"xpath-lazily\"]");
    document.body.innerHTML = '<div id="xpath-lazily"></div>';
    let target = document.getElementById("xpath-lazily");
    expectVisible(target);
    await timeout(100);
    expectHidden(target);
  });

  it("hide-if-labelled-by", async function()
  {
    document.body.innerHTML = `
      <div id="hilb-label">Sponsored</div>
      <div id="hilb-target">
        <div aria-labelledby="hilb-label">Content</div>
      </div>
    `;
    let target = document.getElementById("hilb-target");
    expectVisible(target);
    await runSnippetScript("hide-if-labelled-by 'Sponsored' '#hilb-target [aria-labelledby]' '#hilb-target'");
    expectHidden(target);
  });

  it("hide-if-labelled-by lazily", async function()
  {
    await runSnippetScript("hide-if-labelled-by 'Sponsored' '#hilb-target-lazy [aria-labelledby]' '#hilb-target-lazy'");
    document.body.innerHTML = `
      <div id="hilb-label-lazy">Sponsored</div>
      <div id="hilb-target">
        <div aria-labelledby="hilb-label-lazy">Content</div>
      </div>
    `;
    let target = document.getElementById("hilb-target");
    expectVisible(target);
    await timeout(100);
    expectHidden(target);
  });

  it("hide-if-labelled-by inline", async function()
  {
    document.body.innerHTML = `
      <div id="hilb-target-inline">
        <div aria-labelledby="hilb-label-nope" aria-label="Sponsored">Content</div>
      </div>
    `;
    let target = document.getElementById("hilb-target-inline");
    expectVisible(target);
    await runSnippetScript("hide-if-labelled-by 'Sponsored' '#hilb-target-inline [aria-labelledby]' '#hilb-target-inline'");
    expectHidden(target);
  });
});
