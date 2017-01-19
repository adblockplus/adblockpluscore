/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-2017 Eyeo GmbH
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

// We are currently limited to ECMAScript 5 in this file, because it is being
// used in the browser tests. See https://issues.adblockplus.org/ticket/4796

QUnit.module("Element hiding emulation",
{
  before: function()
  {
    // The URL object in PhantomJS 2.1.7 does not implement any properties, so
    // we need a polyfill.
    if (!URL || !("origin" in URL))
    {
      var doc = document.implementation.createHTMLDocument();
      var anchor = doc.createElement("a");
      doc.body.appendChild(anchor);
      URL = function(url)
      {
        if (!url)
          throw "Invalid URL";
        anchor.href = url;
        this.origin = anchor.origin;
      };
    }
  },
  afterEach: function()
  {
    var styleElements = document.head.getElementsByTagName("style");
    for (var i = 0; i < styleElements.length; i++)
      document.head.removeChild(styleElements[0]);
  }
});

QUnit.assert.hidden = function(element)
{
  this.equal(getComputedStyle(element).display, "none",
             "The element's display property should be set to 'none'");
};

QUnit.assert.visible = function(element)
{
  this.notEqual(getComputedStyle(element).display, "none",
                "The element's display property should not be set to 'none'");
};

function findUniqueId()
{
  var id = "elemHideEmulationTest-" + Math.floor(Math.random() * 10000);
  if (!document.getElementById(id))
    return id;
  return findUniqueId();
}

function insertStyleRule(rule)
{
  var styleElement;
  var styleElements = document.head.getElementsByTagName("style");
  if (styleElements.length)
  {
    styleElement = styleElements[0];
  }
  else
  {
    styleElement = document.createElement("style");
    document.head.appendChild(styleElement);
  }
  styleElement.sheet.insertRule(rule, styleElement.sheet.cssRules.length);
}

function createElementWithStyle(styleBlock)
{
  var element = document.createElement("div");
  element.id = findUniqueId();
  document.body.appendChild(element);
  insertStyleRule("#" + element.id + " " + styleBlock);
  return element;
}

function applyElemHideEmulation(selectors, callback)
{
  var elemHideEmulation = new ElemHideEmulation(
    window,
    function(callback)
    {
      var patterns = [];
      selectors.forEach(function(selector)
      {
        patterns.push({selector: selector});
      });
      callback(patterns);
    },
    function(selectors)
    {
      if (!selectors.length)
        return;
      var selector = selectors.join(", ");
      insertStyleRule(selector + "{display: none !important;}");
    }
  );

  elemHideEmulation.load(function()
  {
    elemHideEmulation.apply();
    callback();
  });
}

QUnit.test(
  "Verbatim property selector",
  function(assert)
  {
    var done = assert.async();
    var toHide = createElementWithStyle("{background-color: #000}");
    applyElemHideEmulation(
      ["[-abp-properties='background-color: rgb(0, 0, 0)']"],
      function()
      {
        assert.hidden(toHide);
        done();
      }
    );
  }
);

QUnit.test(
  "Property selector with wildcard",
  function(assert)
  {
    var done = assert.async();
    var toHide = createElementWithStyle("{background-color: #000}");
    applyElemHideEmulation(
      ["[-abp-properties='*color: rgb(0, 0, 0)']"],
      function()
      {
        assert.hidden(toHide);
        done();
      }
    );
  }
);

QUnit.test(
  "Property selector with regular expression",
  function(assert)
  {
    var done = assert.async();
    var toHide = createElementWithStyle("{background-color: #000}");
    applyElemHideEmulation(
      ["[-abp-properties='/.*color: rgb\\(0, 0, 0\\)/']"],
      function()
      {
        assert.hidden(toHide);
        done();
      }
    );
  }
);

QUnit.test(
  "Property selector with regular expression containing escaped brace",
  function(assert)
  {
    var done = assert.async();
    var toHide = createElementWithStyle("{background-color: #000}");
    applyElemHideEmulation(
      ["[-abp-properties='/background.\\x7B 0,6\\x7D : rgb\\(0, 0, 0\\)/']"],
      function()
      {
        assert.hidden(toHide);
        done();
      }
    );
  }
);

QUnit.test(
  "Property selector with regular expression containing improperly escaped \
brace",
  function(assert)
  {
    var done = assert.async();
    var toHide = createElementWithStyle("{background-color: #000}");
    applyElemHideEmulation(
      ["[-abp-properties='/background.\\x7B0,6\\x7D: rgb\\(0, 0, 0\\)/']"],
      function()
      {
        assert.visible(toHide);
        done();
      }
    );
  }
);

QUnit.test(
  "Property selector works for dynamically changed property",
  function(assert)
  {
    var done = assert.async();
    var toHide = createElementWithStyle("{}");
    applyElemHideEmulation(
      ["[-abp-properties='background-color: rgb(0, 0, 0)']"],
      function()
      {
        assert.visible(toHide);
        insertStyleRule("#" + toHide.id + " {background-color: #000}");
        setTimeout(function()
        {
          assert.hidden(toHide);
          done();
        });
      }
    );
  }
);
