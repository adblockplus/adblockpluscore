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

const {ElemHideEmulation, setTestMode,
       getTestInfo} = require("../../lib/content/elemHideEmulation");

const REFRESH_INTERVAL = 200;

let testDocument = null;

exports.setUp = function(callback)
{
  setTestMode();

  let iframe = document.createElement("iframe");
  document.body.appendChild(iframe);
  testDocument = iframe.contentDocument;

  callback();
};

exports.tearDown = function(callback)
{
  let iframe = testDocument.defaultView.frameElement;
  iframe.parentNode.removeChild(iframe);
  testDocument = null;

  callback();
};

function timeout(delay)
{
  return new Promise((resolve, reject) =>
  {
    window.setTimeout(resolve, delay);
  });
}

function unexpectedError(error)
{
  console.error(error);
  this.ok(false, "Unexpected error: " + error);
}

function expectHidden(test, element, id)
{
  let withId = "";
  if (typeof id != "undefined")
    withId = ` with ID '${id}'`;

  test.equal(
    window.getComputedStyle(element).display, "none",
    `The element${withId}'s display property should be set to 'none'`);
}

function expectVisible(test, element, id)
{
  let withId = "";
  if (typeof id != "undefined")
    withId = ` with ID '${id}'`;

  test.notEqual(
    window.getComputedStyle(element).display, "none",
    `The element${withId}'s display property should not be set to 'none'`);
}

function expectProcessed(test, element, id = null)
{
  let withId = "";
  if (id)
    withId = ` with ID '${id}'`;

  test.ok(
    getTestInfo().lastProcessedElements.has(element),
    `The element${withId} should have been processed`);
}

function expectNotProcessed(test, element, id = null)
{
  let withId = "";
  if (id)
    withId = ` with ID '${id}'`;

  test.ok(
    !getTestInfo().lastProcessedElements.has(element),
    `The element${withId} should not have been processed`);
}

function findUniqueId()
{
  let id = "elemHideEmulationTest-" + Math.floor(Math.random() * 10000);
  if (!testDocument.getElementById(id))
    return id;
  return findUniqueId();
}

function insertStyleRule(rule)
{
  let styleElement;
  let styleElements = testDocument.head.getElementsByTagName("style");
  if (styleElements.length)
    styleElement = styleElements[0];
  else
  {
    styleElement = testDocument.createElement("style");
    testDocument.head.appendChild(styleElement);
  }
  styleElement.sheet.insertRule(rule, styleElement.sheet.cssRules.length);
}

function createElement(parent, type = "div", id = findUniqueId(),
                       innerText = null)
{
  let element = testDocument.createElement(type);
  element.id = id;
  if (!parent)
    testDocument.body.appendChild(element);
  else
    parent.appendChild(element);
  if (innerText)
    element.innerText = innerText;
  return element;
}

// Insert a <div> with a unique id and a CSS rule
// for the the selector matching the id.
function createElementWithStyle(styleBlock, parent)
{
  let element = createElement(parent);
  insertStyleRule("#" + element.id + " " + styleBlock);
  return element;
}

// Create a new ElemHideEmulation instance with @selectors.
function applyElemHideEmulation(selectors)
{
  return Promise.resolve().then(() =>
  {
    let elemHideEmulation = new ElemHideEmulation(
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

    elemHideEmulation.document = testDocument;
    elemHideEmulation.MIN_INVOCATION_INTERVAL = REFRESH_INTERVAL / 2;
    elemHideEmulation.apply(selectors.map(
      selector => ({selector, text: selector})
    ));
    return elemHideEmulation;
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

// Add the style. Then add the element for that style.
// This should retrigger the filtering and hide it.
exports.testPropertyPseudoSelectorAddStyleAndElement = function(test)
{
  let styleElement;
  let toHide;
  applyElemHideEmulation(
    [":-abp-properties(background-color: rgb(0, 0, 0))"]
  ).then(() =>
  {
    styleElement = testDocument.createElement("style");
    testDocument.head.appendChild(styleElement);
    styleElement.sheet.insertRule("#toHide {background-color: #000}");
    return timeout(REFRESH_INTERVAL);
  }).then(() =>
  {
    toHide = createElement();
    toHide.id = "toHide";
    expectVisible(test, toHide);
    return timeout(REFRESH_INTERVAL);
  }).then(() =>
  {
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
    [":-abp-properties(/background.\\7B 0,6\\7D : rgb\\(0, 0, 0\\)/)"]
  ).then(() =>
  {
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPropertySelectorWithImproperlyEscapedBrace = function(test)
{
  let toHide = createElementWithStyle("{background-color: #000}");
  applyElemHideEmulation(
    [":-abp-properties(/background.\\7B0,6\\7D: rgb\\(0, 0, 0\\)/)"]
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

    return timeout(0);
  }).then(() =>
  {
    // Re-evaluation will only happen after a delay
    expectVisible(test, toHide);
    return timeout(REFRESH_INTERVAL);
  }).then(() =>
  {
    expectHidden(test, toHide);
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

function compareExpectations(test, elems, expectations)
{
  for (let elem in expectations)
  {
    if (elems[elem])
    {
      if (expectations[elem])
        expectVisible(test, elems[elem], elem);
      else
        expectHidden(test, elems[elem], elem);
    }
  }
}

function runTestPseudoClassHasSelectorWithHasAndWithSuffixSibling(test, selector, expectations)
{
  testDocument.body.innerHTML = `<div id="parent">
      <div id="middle">
        <div id="middle1"><div id="inside" class="inside"></div></div>
      </div>
      <div id="sibling">
        <div id="tohide"><span>to hide</span></div>
      </div>
      <div id="sibling2">
        <div id="sibling21"><div id="sibling211" class="inside"></div></div>
      </div>
    </div>`;
  let elems = {
    parent: testDocument.getElementById("parent"),
    middle: testDocument.getElementById("middle"),
    inside: testDocument.getElementById("inside"),
    sibling: testDocument.getElementById("sibling"),
    sibling2: testDocument.getElementById("sibling2"),
    toHide: testDocument.getElementById("tohide")
  };

  insertStyleRule(".inside {}");

  applyElemHideEmulation(
    [selector]
  ).then(() =>
  {
    compareExpectations(test, elems, expectations);
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

exports.testPseudoClassHasSelectorWithHasAndWithSuffixSibling3 = function(test)
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
    test, "div:-abp-has(> div:-abp-has(div.inside)) + div > div", expectations);
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

exports.testPseudoClassHasSelectorWithSuffixSiblingContains = function(test)
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
    test, "div:-abp-has(> span:-abp-contains(Advertisment))", expectations);
};

function runTestPseudoClassContains(test, selector, expectations)
{
  testDocument.body.innerHTML = `<div id="parent">
      <div id="middle">
        <div id="middle1"><div id="inside" class="inside"></div></div>
      </div>
      <div id="sibling">
        <div id="tohide">to hide \ud83d\ude42!</div>
      </div>
      <div id="sibling2">
        <div id="sibling21"><div id="sibling211" class="inside">Ad*</div></div>
      </div>
    </div>`;
  let elems = {
    parent: testDocument.getElementById("parent"),
    middle: testDocument.getElementById("middle"),
    inside: testDocument.getElementById("inside"),
    sibling: testDocument.getElementById("sibling"),
    sibling2: testDocument.getElementById("sibling2"),
    toHide: testDocument.getElementById("tohide")
  };

  applyElemHideEmulation(
    [selector]
  ).then(
    () => compareExpectations(test, elems, expectations)
  ).catch(unexpectedError.bind(test)).then(() => test.done());
}

exports.testPseudoClassContainsText = function(test)
{
  let expectations = {
    parent: true,
    middle: true,
    inside: true,
    sibling: false,
    sibling2: true,
    toHide: true
  };
  runTestPseudoClassContains(
    test, "#parent div:-abp-contains(to hide)", expectations);
};

exports.testPseudoClassContainsRegexp = function(test)
{
  let expectations = {
    parent: true,
    middle: true,
    inside: true,
    sibling: false,
    sibling2: true,
    toHide: true
  };
  runTestPseudoClassContains(
    test, "#parent div:-abp-contains(/to\\shide/)", expectations);
};

exports.testPseudoClassContainsRegexpIFlag = function(test)
{
  let expectations = {
    parent: true,
    middle: true,
    inside: true,
    sibling: false,
    sibling2: true,
    toHide: true
  };
  runTestPseudoClassContains(
    test, "#parent div:-abp-contains(/to\\sHide/i)", expectations);
};

exports.testPseudoClassContainsRegexpUFlag = function(test)
{
  let expectations = {
    parent: true,
    middle: true,
    inside: true,
    sibling: false,
    sibling2: true,
    toHide: true
  };
  runTestPseudoClassContains(
    test, "#parent div:-abp-contains(/to\\shide\\s.!/u)", expectations);
};

exports.testPseudoClassContainsWildcardNoMatch = function(test)
{
  let expectations = {
    parent: true,
    middle: true,
    inside: true,
    sibling: true,
    sibling2: true,
    toHide: true
  };
  // this filter shouldn't match anything as "*" has no meaning.
  runTestPseudoClassContains(
    test, "#parent div:-abp-contains(to *hide)", expectations);
};

exports.testPseudoClassContainsWildcardMatch = function(test)
{
  let expectations = {
    parent: true,
    middle: true,
    inside: true,
    sibling: true,
    sibling2: false,
    toHide: true
  };
  runTestPseudoClassContains(
    test, "#parent div:-abp-contains(Ad*)", expectations);
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

exports.testDomUpdatesStyle = function(test)
{
  let parent = createElementWithStyle("{}");
  let child = createElementWithStyle("{}", parent);
  applyElemHideEmulation(
    ["div:-abp-has(:-abp-properties(background-color: rgb(0, 0, 0)))"]
  ).then(() =>
  {
    expectVisible(test, child);
    expectVisible(test, parent);

    insertStyleRule("body #" + parent.id + " > div { background-color: #000}");
    return timeout(0);
  }).then(() =>
  {
    expectVisible(test, child);
    expectVisible(test, parent);
    return timeout(REFRESH_INTERVAL);
  }).then(() =>
  {
    expectVisible(test, child);
    expectHidden(test, parent);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testDomUpdatesContent = function(test)
{
  let parent = createElementWithStyle("{}");
  let child = createElementWithStyle("{}", parent);
  applyElemHideEmulation(
    ["div > div:-abp-contains(hide me)"]
  ).then(() =>
  {
    expectVisible(test, parent);
    expectVisible(test, child);

    child.textContent = "hide me";
    return timeout(0);
  }).then(() =>
  {
    expectVisible(test, parent);
    expectVisible(test, child);
    return timeout(REFRESH_INTERVAL);
  }).then(() =>
  {
    expectVisible(test, parent);
    expectHidden(test, child);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testDomUpdatesNewElement = function(test)
{
  let parent = createElementWithStyle("{}");
  let child = createElementWithStyle("{ background-color: #000}", parent);
  let sibling;
  let child2;
  applyElemHideEmulation(
    ["div:-abp-has(:-abp-properties(background-color: rgb(0, 0, 0)))"]
  ).then(() =>
  {
    expectHidden(test, parent);
    expectVisible(test, child);

    sibling = createElementWithStyle("{}");
    return timeout(0);
  }).then(() =>
  {
    expectHidden(test, parent);
    expectVisible(test, child);
    expectVisible(test, sibling);

    return timeout(REFRESH_INTERVAL);
  }).then(() =>
  {
    expectHidden(test, parent);
    expectVisible(test, child);
    expectVisible(test, sibling);

    child2 = createElementWithStyle("{ background-color: #000}",
                                    sibling);
    return timeout(0);
  }).then(() =>
  {
    expectVisible(test, child2);
    return timeout(REFRESH_INTERVAL);
  }).then(() =>
  {
    expectHidden(test, parent);
    expectVisible(test, child);
    expectHidden(test, sibling);
    expectVisible(test, child2);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPseudoClassPropertiesOnStyleSheetLoad = function(test)
{
  let parent = createElement();
  let child = createElement(parent);
  applyElemHideEmulation(
    ["div:-abp-properties(background-color: rgb(0, 0, 0))",
     "div:-abp-contains(hide me)",
     "div:-abp-has(> div.hideMe)"]
  ).then(() => timeout(REFRESH_INTERVAL)
  ).then(() =>
  {
    expectVisible(test, parent);
    expectVisible(test, child);

    // Load a style sheet that targets the parent element. This should run only
    // the "div:-abp-properties(background-color: rgb(0, 0, 0))" pattern.
    insertStyleRule("#" + parent.id + " {background-color: #000}");

    return timeout(REFRESH_INTERVAL);
  }).then(() =>
  {
    expectHidden(test, parent);
    expectVisible(test, child);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPlainAttributeOnDomMutation = function(test)
{
  let parent = createElement();
  let child = createElement(parent);
  applyElemHideEmulation(
    ["div:-abp-properties(background-color: rgb(0, 0, 0))",
     "div[data-hide-me]",
     "div:-abp-contains(hide me)",
     "div:-abp-has(> div.hideMe)"]
  ).then(() => timeout(REFRESH_INTERVAL)
  ).then(() =>
  {
    expectVisible(test, parent);
    expectVisible(test, child);

    // Set the "data-hide-me" attribute on the child element.
    //
    // Note: Since the "div[data-hide-me]" pattern has already been processed
    // and the selector added to the document's style sheet, this will in fact
    // not do anything at our end, but the browser will just match the selector
    // and hide the element.
    child.setAttribute("data-hide-me", "");

    return timeout(REFRESH_INTERVAL);
  }).then(() =>
  {
    expectVisible(test, parent);
    expectHidden(test, child);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPseudoClassContainsOnDomMutation = function(test)
{
  let parent = createElement();
  let child = createElement(parent);

  child.innerText = "do nothing";

  applyElemHideEmulation(
    ["div:-abp-properties(background-color: rgb(0, 0, 0))",
     "div[data-hide-me]",
     "div:-abp-contains(hide me)",
     "div:-abp-has(> div.hideMe)"]
  ).then(() => timeout(REFRESH_INTERVAL)
  ).then(() =>
  {
    expectVisible(test, parent);
    expectVisible(test, child);

    // Set the child element's text to "hide me". This should run only the
    // "div:-abp-contains(hide me)" pattern.
    //
    // Note: We need to set Node.innerText here in order to trigger the
    // "characterData" DOM mutation on Chromium. If we set Node.textContent
    // instead, it triggers the "childList" DOM mutation instead.
    child.innerText = "hide me";

    return timeout(REFRESH_INTERVAL);
  }).then(() =>
  {
    expectHidden(test, parent);
    expectVisible(test, child);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPseudoClassHasOnDomMutation = function(test)
{
  let parent = createElement();
  let child = null;
  applyElemHideEmulation(
    ["div:-abp-properties(background-color: rgb(0, 0, 0))",
     "div[data-hide-me]",
     "div:-abp-contains(hide me)",
     "div:-abp-has(> div)"]
  ).then(() => timeout(REFRESH_INTERVAL)
  ).then(() =>
  {
    expectVisible(test, parent);

    // Add the child element. This should run all the DOM-dependent patterns
    // ("div:-abp-contains(hide me)" and "div:-abp-has(> div)").
    child = createElement(parent);

    return timeout(REFRESH_INTERVAL);
  }).then(() =>
  {
    expectHidden(test, parent);
    expectVisible(test, child);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPseudoClassHasWithClassOnDomMutation = function(test)
{
  let parent = createElement();
  let child = createElement(parent);
  applyElemHideEmulation(
    ["div:-abp-properties(background-color: rgb(0, 0, 0))",
     "div[data-hide-me]",
     "div:-abp-contains(hide me)",
     "div:-abp-has(> div.hideMe)"]
  ).then(() => timeout(REFRESH_INTERVAL)
  ).then(() =>
  {
    expectVisible(test, parent);
    expectVisible(test, child);

    // Set the child element's class to "hideMe". This should run only the
    // "div:-abp-has(> div.hideMe)" pattern.
    child.className = "hideMe";

    return timeout(REFRESH_INTERVAL);
  }).then(() =>
  {
    expectHidden(test, parent);
    expectVisible(test, child);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPseudoClassHasWithPseudoClassContainsOnDomMutation = function(test)
{
  let parent = createElement();
  let child = createElement(parent);

  child.innerText = "do nothing";

  applyElemHideEmulation(
    ["div:-abp-properties(background-color: rgb(0, 0, 0))",
     "div[data-hide-me]",
     "div:-abp-contains(hide me)",
     "div:-abp-has(> div:-abp-contains(hide me))"]
  ).then(() => timeout(REFRESH_INTERVAL)
  ).then(() =>
  {
    expectVisible(test, parent);
    expectVisible(test, child);

    // Set the child element's text to "hide me". This should run only the
    // "div:-abp-contains(hide me)" and
    // "div:-abp-has(> div:-abp-contains(hide me))" patterns.
    child.innerText = "hide me";

    return timeout(REFRESH_INTERVAL);
  }).then(() =>
  {
    // Note: Even though it runs both the :-abp-contains() patterns, it only
    // hides the parent element because of revision d7d51d29aa34.
    expectHidden(test, parent);
    expectVisible(test, child);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testOnlyRelevantElementsProcessed = function(test)
{
  // <body>
  //   <div id="n1">
  //     <p id="n1_1"></p>
  //     <p id="n1_2"></p>
  //     <p id="n1_4">Hello</p>
  //   </div>
  //   <div id="n2">
  //     <p id="n2_1"></p>
  //     <p id="n2_2"></p>
  //     <p id="n2_4">Hello</p>
  //   </div>
  //   <div id="n3">
  //     <p id="n3_1"></p>
  //     <p id="n3_2"></p>
  //     <p id="n3_4">Hello</p>
  //   </div>
  //   <div id="n4">
  //     <p id="n4_1"></p>
  //     <p id="n4_2"></p>
  //     <p id="n4_4">Hello</p>
  //   </div>
  // </body>
  for (let i of [1, 2, 3, 4])
  {
    let n = createElement(null, "div", `n${i}`);
    for (let [j, text] of [[1], [2], [4, "Hello"]])
      createElement(n, "p", `n${i}_${j}`, text);
  }

  applyElemHideEmulation(
    ["p:-abp-contains(Hello)",
     "div:-abp-contains(Try me!)",
     "div:-abp-has(p:-abp-contains(This is good))"]
  ).then(() => timeout(REFRESH_INTERVAL)
  ).then(() =>
  {
    // This is only a sanity check to make sure everything else is working
    // before we do the actual test.
    for (let i of [1, 2, 3, 4])
    {
      for (let j of [1, 2, 4])
      {
        let id = `n${i}_${j}`;
        if (j == 4)
          expectHidden(test, testDocument.getElementById(id), id);
        else
          expectVisible(test, testDocument.getElementById(id), id);
      }
    }

    // All <div> and <p> elements should be processed initially.
    for (let element of [...testDocument.getElementsByTagName("div"),
                         ...testDocument.getElementsByTagName("p")])
    {
      expectProcessed(test, element, element.id);
    }

    // Modify the text in <p id="n4_1">
    testDocument.getElementById("n4_1").innerText = "Try me!";

    return timeout(REFRESH_INTERVAL);
  }).then(() =>
  {
    // When an element's text is modified, only the element or one of its
    // ancestors matching any selector is processed for :-abp-has() and
    // :-abp-contains()
    for (let element of [...testDocument.getElementsByTagName("div"),
                         ...testDocument.getElementsByTagName("p")])
    {
      if (element.id == "n4" || element.id == "n4_1")
        expectProcessed(test, element, element.id);
      else
        expectNotProcessed(test, element, element.id);
    }

    // Create a new <p id="n2_3"> element with no text.
    createElement(testDocument.getElementById("n2"), "p", "n2_3");

    return timeout(REFRESH_INTERVAL);
  }).then(() =>
  {
    // When a new element is added, only the element or one of its ancestors
    // matching any selector is processed for :-abp-has() and :-abp-contains()
    for (let element of [...testDocument.getElementsByTagName("div"),
                         ...testDocument.getElementsByTagName("p")])
    {
      if (element.id == "n2" || element.id == "n2_3")
        expectProcessed(test, element, element.id);
      else
        expectNotProcessed(test, element, element.id);
    }
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};
