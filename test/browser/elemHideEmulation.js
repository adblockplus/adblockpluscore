/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-2017 eyeo GmbH
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

/* globals ElemHideEmulation */

let myUrl = document.currentScript.src;

exports.tearDown = function(callback)
{
  let styleElements = document.head.getElementsByTagName("style");
  while (styleElements.length)
    styleElements[0].parentNode.removeChild(styleElements[0]);

  let child;
  while (child = document.body.firstChild)
    child.parentNode.removeChild(child);

  callback();
};

function unexpectedError(error)
{
  console.error(error);
  this.ok(false, "Unexpected error: " + error);
}

function expectHidden(test, element)
{
  test.equal(window.getComputedStyle(element).display, "none",
             "The element's display property should be set to 'none'");
}

function expectVisible(test, element)
{
  test.notEqual(window.getComputedStyle(element).display, "none",
                "The element's display property should not be set to 'none'");
}

function findUniqueId()
{
  let id = "elemHideEmulationTest-" + Math.floor(Math.random() * 10000);
  if (!document.getElementById(id))
    return id;
  return findUniqueId();
}

function insertStyleRule(rule)
{
  let styleElement;
  let styleElements = document.head.getElementsByTagName("style");
  if (styleElements.length)
    styleElement = styleElements[0];
  else
  {
    styleElement = document.createElement("style");
    document.head.appendChild(styleElement);
  }
  styleElement.sheet.insertRule(rule, styleElement.sheet.cssRules.length);
}

// insert a <div> with a unique id and a CSS rule
// for the the selector matching the id.
function createElementWithStyle(styleBlock, parent)
{
  let element = document.createElement("div");
  element.id = findUniqueId();
  if (!parent)
    document.body.appendChild(element);
  else
    parent.appendChild(element);
  insertStyleRule("#" + element.id + " " + styleBlock);
  return element;
}

// Will ensure the class ElemHideEmulation is loaded.
// Pass true when it calls itself.
function loadElemHideEmulation(inside)
{
  if (typeof ElemHideEmulation == "undefined")
  {
    if (inside)
      return Promise.reject("Failed to load ElemHideEmulation.");

    return loadScript(myUrl + "/../../../lib/common.js").then(() =>
    {
      return loadScript(myUrl + "/../../../chrome/content/elemHideEmulation.js");
    }).then(() =>
    {
      return loadElemHideEmulation(true);
    });
  }

  return Promise.resolve();
}

// Create a new ElemHideEmulation instance with @selectors.
function applyElemHideEmulation(selectors)
{
  return loadElemHideEmulation().then(() =>
  {
    let elemHideEmulation = new ElemHideEmulation(
      window,
      callback =>
      {
        let patterns = [];
        selectors.forEach(selector =>
        {
          patterns.push({selector});
        });
        callback(patterns);
      },
      newSelectors =>
      {
        if (!newSelectors.length)
          return;
        let selector = newSelectors.join(", ");
        insertStyleRule(selector + "{display: none !important;}");
      },
      elems =>
      {
        for (let elem of elems)
          elem.style.display = "none";
      }
    );

    elemHideEmulation.apply();
    return Promise.resolve(elemHideEmulation);
  });
}

exports.testVerbatimPropertySelector = function(test)
{
  let toHide = createElementWithStyle("{background-color: #000}");
  applyElemHideEmulation(
    [":-abp-properties(background-color: rgb(0, 0, 0))"]
  ).then(() =>
  {
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testVerbatimPropertySelectorWithPrefix = function(test)
{
  let parent = createElementWithStyle("{background-color: #000}");
  let toHide = createElementWithStyle("{background-color: #000}", parent);
  applyElemHideEmulation(
    ["div > :-abp-properties(background-color: rgb(0, 0, 0))"]
  ).then(() =>
  {
    expectVisible(test, parent);
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testVerbatimPropertySelectorWithPrefixNoMatch = function(test)
{
  let parent = createElementWithStyle("{background-color: #000}");
  let toHide = createElementWithStyle("{background-color: #fff}", parent);
  applyElemHideEmulation(
    ["div > :-abp-properties(background-color: rgb(0, 0, 0))"]
  ).then(() =>
  {
    expectVisible(test, parent);
    expectVisible(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testVerbatimPropertySelectorWithSuffix = function(test)
{
  let parent = createElementWithStyle("{background-color: #000}");
  let toHide = createElementWithStyle("{background-color: #000}", parent);
  applyElemHideEmulation(
    [":-abp-properties(background-color: rgb(0, 0, 0)) > div"]
  ).then(() =>
  {
    expectVisible(test, parent);
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testVerbatimPropertyPseudoSelectorWithPrefixAndSuffix = function(test)
{
  let parent = createElementWithStyle("{background-color: #000}");
  let middle = createElementWithStyle("{background-color: #000}", parent);
  let toHide = createElementWithStyle("{background-color: #000}", middle);
  applyElemHideEmulation(
    ["div > :-abp-properties(background-color: rgb(0, 0, 0)) > div"]
  ).then(() =>
  {
    expectVisible(test, parent);
    expectVisible(test, middle);
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPropertySelectorWithWildcard = function(test)
{
  let toHide = createElementWithStyle("{background-color: #000}");
  applyElemHideEmulation(
    [":-abp-properties(*color: rgb(0, 0, 0))"]
  ).then(() =>
  {
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPropertySelectorWithRegularExpression = function(test)
{
  let toHide = createElementWithStyle("{background-color: #000}");
  applyElemHideEmulation(
    [":-abp-properties(/.*color: rgb\\(0, 0, 0\\)/)"]
  ).then(() =>
  {
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPropertySelectorWithEscapedBrace = function(test)
{
  let toHide = createElementWithStyle("{background-color: #000}");
  applyElemHideEmulation(
    [":-abp-properties(/background.\\x7B 0,6\\x7D : rgb\\(0, 0, 0\\)/)"]
  ).then(() =>
  {
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPropertySelectorWithImproperlyEscapedBrace = function(test)
{
  let toHide = createElementWithStyle("{background-color: #000}");
  applyElemHideEmulation(
    [":-abp-properties(/background.\\x7B0,6\\x7D: rgb\\(0, 0, 0\\)/)"]
  ).then(() =>
  {
    expectVisible(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testDynamicallyChangedProperty = function(test)
{
  let toHide = createElementWithStyle("{}");
  applyElemHideEmulation(
    [":-abp-properties(background-color: rgb(0, 0, 0))"]
  ).then(() =>
  {
    expectVisible(test, toHide);
    insertStyleRule("#" + toHide.id + " {background-color: #000}");
    return new Promise((resolve, reject) =>
    {
      // Re-evaluation will only happen after a few seconds
      expectVisible(test, toHide);
      window.setTimeout(() =>
      {
        expectHidden(test, toHide);
        resolve();
      }, 4000);
    });
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPseudoClassWithPropBeforeSelector = function(test)
{
  let parent = createElementWithStyle("{}");
  let child = createElementWithStyle("{background-color: #000}", parent);
  insertStyleRule(`#${child.id}::before {content: "publicite"}`);

  applyElemHideEmulation(
    ["div:-abp-properties(content: \"publicite\")"]
  ).then(() =>
  {
    expectHidden(test, child);
    expectVisible(test, parent);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPseudoClassHasSelector = function(test)
{
  let toHide = createElementWithStyle("{}");
  applyElemHideEmulation(
    ["div:-abp-has(div)"]
  ).then(() =>
  {
    expectVisible(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPseudoClassHasSelectorWithPrefix = function(test)
{
  let parent = createElementWithStyle("{}");
  let child = createElementWithStyle("{}", parent);
  applyElemHideEmulation(
    ["div:-abp-has(div)"]
  ).then(() =>
  {
    expectHidden(test, parent);
    expectVisible(test, child);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPseudoClassHasSelectorWithSuffix = function(test)
{
  let parent = createElementWithStyle("{}");
  let middle = createElementWithStyle("{}", parent);
  let child = createElementWithStyle("{}", middle);
  applyElemHideEmulation(
    ["div:-abp-has(div) > div"]
  ).then(() =>
  {
    expectVisible(test, parent);
    expectHidden(test, middle);
    expectHidden(test, child);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPseudoClassHasSelectorWithSuffixSibling = function(test)
{
  let parent = createElementWithStyle("{}");
  let middle = createElementWithStyle("{}", parent);
  let toHide = createElementWithStyle("{}");
  applyElemHideEmulation(
    ["div:-abp-has(div) + div"]
  ).then(() =>
  {
    expectVisible(test, parent);
    expectVisible(test, middle);
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPseudoClassHasSelectorWithSuffixSiblingChild = function(test)
{
  //  <div>
  //    <div></div>
  //    <div>
  //      <div>to hide</div>
  //    </div>
  //  </div>
  let parent = createElementWithStyle("{}");
  let middle = createElementWithStyle("{}", parent);
  let sibling = createElementWithStyle("{}");
  let toHide = createElementWithStyle("{}", sibling);
  applyElemHideEmulation(
    ["div:-abp-has(div) + div > div"]
  ).then(() =>
  {
    expectVisible(test, parent);
    expectVisible(test, middle);
    expectVisible(test, sibling);
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

function runTestPseudoClassHasSelectorWithHasAndWithSuffixSibling(test, selector, expectations)
{
  document.body.innerHTML = `<div id="parent">
      <div id="middle">
        <div id="middle1"><div id="inside" class="inside"></div></div>
      </div>
      <div id="sibling">
        <div id="tohide">to hide</div>
      </div>
      <div id="sibling2">
        <div id="sibling21"><div id="sibling211" class="inside"></div></div>
      </div>
    </div>`;
  let elems = {
    parent: document.getElementById("parent"),
    middle: document.getElementById("middle"),
    inside: document.getElementById("inside"),
    sibling: document.getElementById("sibling"),
    sibling2: document.getElementById("sibling2"),
    toHide: document.getElementById("tohide")
  };

  insertStyleRule(".inside {}");

  applyElemHideEmulation(
    [selector]
  ).then(() =>
  {
    for (let elem in expectations)
      if (elems[elem])
      {
        if (expectations[elem])
          expectVisible(test, elems[elem]);
        else
          expectHidden(test, elems[elem]);
      }
  }).catch(unexpectedError.bind(test)).then(() => test.done());
}

exports.testPseudoClassHasSelectorWithHasAndWithSuffixSibling = function(test)
{
  let expectations = {
    parent: true,
    middile: true,
    inside: true,
    sibling: true,
    sibling2: true,
    toHide: false
  };
  runTestPseudoClassHasSelectorWithHasAndWithSuffixSibling(
    test, "div:-abp-has(:-abp-has(div.inside)) + div > div", expectations);
};

exports.testPseudoClassHasSelectorWithHasAndWithSuffixSibling2 = function(test)
{
  let expectations = {
    parent: true,
    middile: true,
    inside: true,
    sibling: true,
    sibling2: true,
    toHide: false
  };
  runTestPseudoClassHasSelectorWithHasAndWithSuffixSibling(
    test, "div:-abp-has(:-abp-has(> div.inside)) + div > div", expectations);
};

exports.testPseudoClassHasSelectorWithSuffixSiblingNoop = function(test)
{
  let expectations = {
    parent: true,
    middile: true,
    inside: true,
    sibling: true,
    sibling2: true,
    toHide: true
  };
  runTestPseudoClassHasSelectorWithHasAndWithSuffixSibling(
    test, "div:-abp-has(> body div.inside) + div > div", expectations);
};

exports.testPseudoClassContains = function(test)
{
  document.body.innerHTML = `<div id="parent">
      <div id="middle">
        <div id="middle1"><div id="inside" class="inside"></div></div>
      </div>
      <div id="sibling">
        <div id="tohide">to hide</div>
      </div>
      <div id="sibling2">
        <div id="sibling21"><div id="sibling211" class="inside"></div></div>
      </div>
    </div>`;
  let parent = document.getElementById("parent");
  let middle = document.getElementById("middle");
  let inside = document.getElementById("inside");
  let sibling = document.getElementById("sibling");
  let sibling2 = document.getElementById("sibling2");
  let toHide = document.getElementById("tohide");

  applyElemHideEmulation(
    ["#parent div:-abp-contains(to hide)"]
  ).then(() =>
  {
    expectVisible(test, parent);
    expectVisible(test, middle);
    expectVisible(test, inside);
    expectHidden(test, sibling);
    expectVisible(test, sibling2);
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPseudoClassHasSelectorWithPropSelector = function(test)
{
  let parent = createElementWithStyle("{}");
  let child = createElementWithStyle("{background-color: #000}", parent);
  applyElemHideEmulation(
    ["div:-abp-has(:-abp-properties(background-color: rgb(0, 0, 0)))"]
  ).then(() =>
  {
    expectVisible(test, child);
    expectHidden(test, parent);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPseudoClassHasSelectorWithPropSelector2 = function(test)
{
  let parent = createElementWithStyle("{}");
  let child = createElementWithStyle("{}", parent);
  insertStyleRule("body #" + parent.id + " > div { background-color: #000}");
  applyElemHideEmulation(
    ["div:-abp-has(:-abp-properties(background-color: rgb(0, 0, 0)))"]
  ).then(() =>
  {
    expectVisible(test, child);
    expectHidden(test, parent);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};
