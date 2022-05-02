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

"use strict";

const {ElemHideExceptions} = require("../../lib/elemHideExceptions");
const {ElemHide} = require("../../lib/elemHide");
const {Filter} = require("../../lib/filterClasses");

const {assert} = chai;

describe("Element hiding", function() {
  let elemHideExceptions = null;
  let elemHide = null;
  let testDocument = null;

  before(function() {
    elemHideExceptions = new ElemHideExceptions();
    elemHide = new ElemHide(elemHideExceptions);
  });

  after(function() {
    elemHide = null;
    elemHideExceptions = null;
  });

  beforeEach(function elemHidingBeforeEach() {
    let iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    testDocument = iframe.contentDocument;
  });

  afterEach(function elemHidingAfterEach() {
    let iframe = testDocument.defaultView.frameElement;
    iframe.parentNode.removeChild(iframe);
    testDocument = null;
  });

  function expectHidden(element) {
    assert.equal(window.getComputedStyle(element).display, "none");
  }

  function insertStyleSheet(cssRules) {
    let styleSheet = testDocument.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = cssRules;
    testDocument.head.appendChild(styleSheet);
  }

  function createElement(type = "div") {
    let element = testDocument.createElement(type);
    testDocument.body.appendChild(element);
    return element;
  }

  it("Hides a div", async function() {
    let toHide = createElement();
    elemHide.add(Filter.fromText("##div"));
    let {code} = elemHide.getStyleSheet("example.com");
    insertStyleSheet(code);
    expectHidden(toHide);
  });

  it("Hides a div even if there is another rule with an invalid selector", async function() {
    let toHide = createElement();
    elemHide.add(Filter.fromText("##div"));
    elemHide.add(Filter.fromText("##img:this-is-not-a-real-pseudoclass(.foo)"));
    let {code} = elemHide.getStyleSheet("example.com");
    insertStyleSheet(code);
    expectHidden(toHide);
  });

  it("Hides a div even if there is another rule with an invalid selector that does not close its braces", async function() {
    let toHide = createElement();
    elemHide.add(Filter.fromText("##img.foo["));
    elemHide.add(Filter.fromText("##div"));
    let {code} = elemHide.getStyleSheet("example.com");
    insertStyleSheet(code);
    expectHidden(toHide);
  });
});
