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

function createElementWithStyle(styleBlock)
{
  let element = document.createElement("div");
  element.id = findUniqueId();
  document.body.appendChild(element);
  insertStyleRule("#" + element.id + " " + styleBlock);
  return element;
}

function applyElemHideEmulation(selectors)
{
  if (typeof ElemHideEmulation == "undefined")
  {
    return loadScript(myUrl + "/../../../lib/common.js").then(() =>
    {
      return loadScript(myUrl + "/../../../chrome/content/elemHideEmulation.js");
    }).then(() =>
    {
      return applyElemHideEmulation(selectors);
    });
  }

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
    }, newSelectors =>
    {
      if (!newSelectors.length)
        return;
      let selector = newSelectors.join(", ");
      insertStyleRule(selector + "{display: none !important;}");
    }
  );

  elemHideEmulation.apply();
  return Promise.resolve();
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
      window.setTimeout(() =>
      {
        expectHidden(test, toHide);
        resolve();
      }, 0);
    });
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};
