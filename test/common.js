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

const {createSandbox} = require("./_common");

let qualifySelector = null;

exports.setUp = function(callback)
{
  let sandboxedRequire = createSandbox();
  (
    {qualifySelector} = sandboxedRequire("../lib/common")
  );

  callback();
};

exports.testQualifySelector = function(test)
{
  // Simple selectors.
  test.equal(qualifySelector("#foo", "div"), "div#foo");
  test.equal(qualifySelector(".foo", "div"), "div.foo");
  test.equal(qualifySelector("div", "#foo"), "div#foo");
  test.equal(qualifySelector("div", ".foo"), "div.foo");
  test.equal(qualifySelector("div#bar", ".foo"), "div.foo#bar");
  test.equal(qualifySelector("div.bar", "#foo"), "div#foo.bar");

  // Compound selectors.
  test.equal(qualifySelector("body #foo", "div"), "body div#foo");
  test.equal(qualifySelector("body .foo", "div"), "body div.foo");
  test.equal(qualifySelector("body div", "#foo"), "body div#foo");
  test.equal(qualifySelector("body div", ".foo"), "body div.foo");
  test.equal(qualifySelector("body div#bar", ".foo"), "body div.foo#bar");
  test.equal(qualifySelector("body div.bar", "#foo"), "body div#foo.bar");

  // Compound selectors with universal selector.
  test.equal(qualifySelector("#foo *", "div"), "#foo div");
  test.equal(qualifySelector(".foo *", "div"), ".foo div");
  test.equal(qualifySelector("div *", "#foo"), "div #foo");
  test.equal(qualifySelector("div *", ".foo"), "div .foo");
  test.equal(qualifySelector("div#bar *", ".foo"), "div#bar .foo");
  test.equal(qualifySelector("div.bar *", "#foo"), "div.bar #foo");
  test.equal(qualifySelector("body *#foo", "div"), "body div#foo");
  test.equal(qualifySelector("body *.foo", "div"), "body div.foo");

  // Compound selectors with pseudo-class with parentheses.
  test.equal(qualifySelector("body #foo:nth-child(1)", "div"),
             "body div#foo:nth-child(1)");
  test.equal(qualifySelector("body .foo:nth-child(1)", "div"),
             "body div.foo:nth-child(1)");
  test.equal(qualifySelector("body div:nth-child(1)", "#foo"),
             "body div#foo:nth-child(1)");
  test.equal(qualifySelector("body div:nth-child(1)", ".foo"),
             "body div.foo:nth-child(1)");
  test.equal(qualifySelector("body div#bar:nth-child(1)", ".foo"),
             "body div.foo#bar:nth-child(1)");
  test.equal(qualifySelector("body div.bar:nth-child(1)", "#foo"),
             "body div#foo.bar:nth-child(1)");

  // Compound selectors with pseudo-class with parentheses containing extra
  // whitespace.
  test.equal(qualifySelector("body #foo:nth-child( 1 )", "div"),
             "body div#foo:nth-child( 1 )");
  test.equal(qualifySelector("body .foo:nth-child( 1 )", "div"),
             "body div.foo:nth-child( 1 )");
  test.equal(qualifySelector("body div:nth-child( 1 )", "#foo"),
             "body div#foo:nth-child( 1 )");
  test.equal(qualifySelector("body div:nth-child( 1 )", ".foo"),
             "body div.foo:nth-child( 1 )");
  test.equal(qualifySelector("body div#bar:nth-child( 1 )", ".foo"),
             "body div.foo#bar:nth-child( 1 )");
  test.equal(qualifySelector("body div.bar:nth-child( 1 )", "#foo"),
             "body div#foo.bar:nth-child( 1 )");

  // Compound selectors with child combinator and pseudo-class with
  // parentheses.
  test.equal(qualifySelector("body > #foo:nth-child(1)", "div"),
             "body > div#foo:nth-child(1)");
  test.equal(qualifySelector("body > .foo:nth-child(1)", "div"),
             "body > div.foo:nth-child(1)");
  test.equal(qualifySelector("body > div:nth-child(1)", "#foo"),
             "body > div#foo:nth-child(1)");
  test.equal(qualifySelector("body > div:nth-child(1)", ".foo"),
             "body > div.foo:nth-child(1)");
  test.equal(qualifySelector("body > div#bar:nth-child(1)", ".foo"),
             "body > div.foo#bar:nth-child(1)");
  test.equal(qualifySelector("body > div.bar:nth-child(1)", "#foo"),
             "body > div#foo.bar:nth-child(1)");

  // Compound selectors with child combinator surrounded by no whitespace and
  // pseudo-class with parentheses.
  test.equal(qualifySelector("body>#foo:nth-child(1)", "div"),
             "body>div#foo:nth-child(1)");
  test.equal(qualifySelector("body>.foo:nth-child(1)", "div"),
             "body>div.foo:nth-child(1)");
  test.equal(qualifySelector("body>div:nth-child(1)", "#foo"),
             "body>div#foo:nth-child(1)");
  test.equal(qualifySelector("body>div:nth-child(1)", ".foo"),
             "body>div.foo:nth-child(1)");
  test.equal(qualifySelector("body>div#bar:nth-child(1)", ".foo"),
             "body>div.foo#bar:nth-child(1)");
  test.equal(qualifySelector("body>div.bar:nth-child(1)", "#foo"),
             "body>div#foo.bar:nth-child(1)");

  // Compound selectors with adjacent sibling combinator and pseudo-class with
  // parentheses.
  test.equal(qualifySelector("article + #foo:nth-child(1)", "div"),
             "article + div#foo:nth-child(1)");
  test.equal(qualifySelector("article + .foo:nth-child(1)", "div"),
             "article + div.foo:nth-child(1)");
  test.equal(qualifySelector("article + div:nth-child(1)", "#foo"),
             "article + div#foo:nth-child(1)");
  test.equal(qualifySelector("article + div:nth-child(1)", ".foo"),
             "article + div.foo:nth-child(1)");
  test.equal(qualifySelector("article + div#bar:nth-child(1)", ".foo"),
             "article + div.foo#bar:nth-child(1)");
  test.equal(qualifySelector("article + div.bar:nth-child(1)", "#foo"),
             "article + div#foo.bar:nth-child(1)");

  // Compound selectors with general sibling combinator and pseudo-class with
  // parentheses.
  test.equal(qualifySelector("article ~ #foo:nth-child(1)", "div"),
             "article ~ div#foo:nth-child(1)");
  test.equal(qualifySelector("article ~ .foo:nth-child(1)", "div"),
             "article ~ div.foo:nth-child(1)");
  test.equal(qualifySelector("article ~ div:nth-child(1)", "#foo"),
             "article ~ div#foo:nth-child(1)");
  test.equal(qualifySelector("article ~ div:nth-child(1)", ".foo"),
             "article ~ div.foo:nth-child(1)");
  test.equal(qualifySelector("article ~ div#bar:nth-child(1)", ".foo"),
             "article ~ div.foo#bar:nth-child(1)");
  test.equal(qualifySelector("article ~ div.bar:nth-child(1)", "#foo"),
             "article ~ div#foo.bar:nth-child(1)");

  // Compound selectors with child combinator and pseudo-element.
  test.equal(qualifySelector("body > #foo::first-child", "div"),
             "body > div#foo::first-child");
  test.equal(qualifySelector("body > .foo::first-child", "div"),
             "body > div.foo::first-child");
  test.equal(qualifySelector("body > div::first-child", "#foo"),
             "body > div#foo::first-child");
  test.equal(qualifySelector("body > div::first-child", ".foo"),
             "body > div.foo::first-child");
  test.equal(qualifySelector("body > div#bar::first-child", ".foo"),
             "body > div.foo#bar::first-child");
  test.equal(qualifySelector("body > div.bar::first-child", "#foo"),
             "body > div#foo.bar::first-child");

  // Compound selectors with attribute selector.
  test.equal(qualifySelector("body #foo[style='display: block']", "div"),
             "body div#foo[style='display: block']");
  test.equal(qualifySelector("body .foo[style='display: block']", "div"),
             "body div.foo[style='display: block']");
  test.equal(qualifySelector("body div[style='display: block']", "#foo"),
             "body div#foo[style='display: block']");
  test.equal(qualifySelector("body div[style='display: block']", ".foo"),
             "body div.foo[style='display: block']");
  test.equal(qualifySelector("body div#bar[style='display: block']", ".foo"),
             "body div.foo#bar[style='display: block']");
  test.equal(qualifySelector("body div.bar[style='display: block']", "#foo"),
             "body div#foo.bar[style='display: block']");

  // Compound selectors with unqualified attribute selector.
  test.equal(qualifySelector("body [style='display: block']", "div"),
             "body div[style='display: block']");
  test.equal(qualifySelector("body [style='display: block']", "#foo"),
             "body #foo[style='display: block']");
  test.equal(qualifySelector("body [style='display: block']", ".foo"),
             "body .foo[style='display: block']");

  // Multiple selectors.
  test.equal(qualifySelector("#foo, #bar", "div"), "div#foo, div#bar");
  test.equal(qualifySelector(".foo, .bar", "div"), "div.foo, div.bar");
  test.equal(qualifySelector("div, .bar", "#foo"), "div#foo, #foo.bar");
  test.equal(qualifySelector("div, #bar", ".foo"), "div.foo, .foo#bar");

  // Compound selector with class selector containing Unicode composite
  // character.
  test.equal(qualifySelector("body .\ud83d\ude42", "img"),
             "body img.\ud83d\ude42");

  test.done();
};
