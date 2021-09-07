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

const assert = require("assert");
const {LIB_FOLDER, createSandbox} = require("./_common");

describe("textToRegExp()", function() {
  let textToRegExp = null;

  beforeEach(function() {
    let sandboxedRequire = createSandbox();
    (
      {textToRegExp} = sandboxedRequire(LIB_FOLDER + "/common")
    );
  });

  for (let character of ["-", "/", "\\", "^", "$", "*", "+", "?", ".",
                         "(", ")", "|", "[", "]", "{", "}"]) {
    // Alone.
    it(`should return '\\${character}' for '${character}'`, function() {
      assert.strictEqual(textToRegExp(character), `\\${character}`);
    });

    // With single character.
    it(`should return '\\${character}a' for '${character}a'`, function() {
      assert.strictEqual(textToRegExp(character + "a"), `\\${character}a`);
    });

    it(`should return 'a\\${character}' for 'a${character}'`, function() {
      assert.strictEqual(textToRegExp("a" + character), `a\\${character}`);
    });

    it(`should return 'a\\${character}b' for 'a${character}b'`, function() {
      assert.strictEqual(textToRegExp("a" + character + "b"), `a\\${character}b`);
    });

    // With multiple characters.
    it(`should return '\\${character}ab' for '${character}ab'`, function() {
      assert.strictEqual(textToRegExp(character + "ab"), `\\${character}ab`);
    });

    it(`should return 'ab\\${character}' for 'ab${character}'`, function() {
      assert.strictEqual(textToRegExp("ab" + character), `ab\\${character}`);
    });

    it(`should return 'ab\\${character}cd' for 'ab${character}cd'`, function() {
      assert.strictEqual(textToRegExp("ab" + character + "cd"), `ab\\${character}cd`);
    });
  }
});

describe("makeRegExpParameter()", function() {
  let makeRegExpParameter = null;

  beforeEach(function() {
    let sandboxedRequire = createSandbox();
    (
      {makeRegExpParameter} = sandboxedRequire(LIB_FOLDER + "/common")
    );
  });

  it("should interpret patterns that start and end with / as a regex", function() {
    let text = "/[a-z]{3}/";
    let regexp = makeRegExpParameter(text);
    assert.equal(regexp.test("abc"), true);
    assert.equal(regexp.test("ABC"), false);
    assert.equal(regexp.test("[a-z]{3}"), false);
  });

  it("should allow regex flags", function() {
    let text = "/[a-z]{3}/i";
    let regexp = makeRegExpParameter(text);
    assert.equal(regexp.test("abc"), true);
    assert.equal(regexp.test("ABC"), true);
    assert.equal(regexp.test("[a-z]{3}"), false);
  });

  it("should match characters literally if they are not a regex", function() {
    let text = "[a-z]{3}";
    let regexp = makeRegExpParameter(text);
    assert.equal(regexp.test("abc"), false);
    assert.equal(regexp.test("ABC"), false);
    assert.equal(regexp.test("[a-z]{3}"), true);
    assert.equal(regexp.test("[A-Z]{3}"), false);
  });
});

describe("qualifySelector()", function() {
  let qualifySelector = null;

  beforeEach(function() {
    let sandboxedRequire = createSandbox();
    (
      {qualifySelector} = sandboxedRequire(LIB_FOLDER + "/common")
    );
  });

  // Simple selectors.
  it("should return div#foo for #foo and div", function() {
    assert.equal(qualifySelector("#foo", "div"), "div#foo");
  });

  it("should return div.foo for .foo and div", function() {
    assert.equal(qualifySelector(".foo", "div"), "div.foo");
  });

  it("should return div#foo for div and #foo", function() {
    assert.equal(qualifySelector("div", "#foo"), "div#foo");
  });

  it("should return div.foo for div and .foo", function() {
    assert.equal(qualifySelector("div", ".foo"), "div.foo");
  });

  it("should return div.foo#bar for div#bar and .foo", function() {
    assert.equal(qualifySelector("div#bar", ".foo"), "div.foo#bar");
  });

  it("should return div#foo.bar for div.bar and #foo", function() {
    assert.equal(qualifySelector("div.bar", "#foo"), "div#foo.bar");
  });

  // Now repeat the above tests but with the types of the selector and the
  // qualifier being the same (e.g. both div) (#7400), a recurring pattern
  // throughout this function.
  it("should return div for div and div", function() {
    assert.equal(qualifySelector("div", "div"), "div");
  });

  it("should return div#foo for div#foo and div", function() {
    assert.equal(qualifySelector("div#foo", "div"), "div#foo");
  });

  it("should return div.foo for div.foo and div", function() {
    assert.equal(qualifySelector("div.foo", "div"), "div.foo");
  });

  it("should return div#foo for div and div#foo", function() {
    assert.equal(qualifySelector("div", "div#foo"), "div#foo");
  });

  it("should return div.foo for div and div.foo", function() {
    assert.equal(qualifySelector("div", "div.foo"), "div.foo");
  });

  it("should return div.foo#bar for div#bar and div.foo", function() {
    assert.equal(qualifySelector("div#bar", "div.foo"), "div.foo#bar");
  });

  it("should return div#foo.bar for div.bar and div#foo", function() {
    assert.equal(qualifySelector("div.bar", "div#foo"), "div#foo.bar");
  });

  // Compound selectors.
  it("should return body div#foo for body #foo and div", function() {
    assert.equal(qualifySelector("body #foo", "div"), "body div#foo");
  });

  it("should return body div.foo for body .foo and div", function() {
    assert.equal(qualifySelector("body .foo", "div"), "body div.foo");
  });

  it("should return body div#foo for body div and #foo", function() {
    assert.equal(qualifySelector("body div", "#foo"), "body div#foo");
  });

  it("should return body div.foo for body div and .foo", function() {
    assert.equal(qualifySelector("body div", ".foo"), "body div.foo");
  });

  it("should return body div.foo#bar for body div#bar and .foo", function() {
    assert.equal(qualifySelector("body div#bar", ".foo"), "body div.foo#bar");
  });

  it("should return body div#foo.bar for body div.bar and #foo", function() {
    assert.equal(qualifySelector("body div.bar", "#foo"), "body div#foo.bar");
  });

  it("should return body div#foo for body div#foo and div", function() {
    assert.equal(qualifySelector("body div#foo", "div"), "body div#foo");
  });

  it("should return body div.foo for body div.foo and div", function() {
    assert.equal(qualifySelector("body div.foo", "div"), "body div.foo");
  });

  it("should return body div#foo for body div and div#foo", function() {
    assert.equal(qualifySelector("body div", "div#foo"), "body div#foo");
  });

  it("should return body div.foo for body div and div.foo", function() {
    assert.equal(qualifySelector("body div", "div.foo"), "body div.foo");
  });

  it("should return body div.foo#bar for body div#bar and div.foo", function() {
    assert.equal(qualifySelector("body div#bar", "div.foo"), "body div.foo#bar");
  });

  it("should return body div#foo.bar for body div.bar and div#foo", function() {
    assert.equal(qualifySelector("body div.bar", "div#foo"), "body div#foo.bar");
  });

  // Compound selectors with universal selector.
  it("should return #foo div for #foo * and div", function() {
    assert.equal(qualifySelector("#foo *", "div"), "#foo div");
  });

  it("should return .foo div for .foo * and div", function() {
    assert.equal(qualifySelector(".foo *", "div"), ".foo div");
  });

  it("should return div #foo for div * and #foo", function() {
    assert.equal(qualifySelector("div *", "#foo"), "div #foo");
  });

  it("should return div .foo for div * and .foo", function() {
    assert.equal(qualifySelector("div *", ".foo"), "div .foo");
  });

  it("should return div#bar .foo for div#bar * and .foo", function() {
    assert.equal(qualifySelector("div#bar *", ".foo"), "div#bar .foo");
  });

  it("should return div.bar #foo for div.bar * and #foo", function() {
    assert.equal(qualifySelector("div.bar *", "#foo"), "div.bar #foo");
  });

  it("should return body div#foo for body *#foo and div", function() {
    assert.equal(qualifySelector("body *#foo", "div"), "body div#foo");
  });

  it("should return body div.foo for body *.foo and div", function() {
    assert.equal(qualifySelector("body *.foo", "div"), "body div.foo");
  });

  it("should return #foo * for #foo * and *", function() {
    assert.equal(qualifySelector("#foo *", "*"), "#foo *");
  });

  it("should return .foo * for .foo * and *", function() {
    assert.equal(qualifySelector(".foo *", "*"), ".foo *");
  });

  it("should return div *#foo for div * and *#foo", function() {
    assert.equal(qualifySelector("div *", "*#foo"), "div *#foo");
  });

  it("should return div *.foo for div * and *.foo", function() {
    assert.equal(qualifySelector("div *", "*.foo"), "div *.foo");
  });

  it("should return div#bar *.foo for div#bar * and *.foo", function() {
    assert.equal(qualifySelector("div#bar *", "*.foo"), "div#bar *.foo");
  });

  it("should return div.bar *#foo for div.bar * and *#foo", function() {
    assert.equal(qualifySelector("div.bar *", "*#foo"), "div.bar *#foo");
  });

  it("should return body *#foo for body *#foo and *", function() {
    assert.equal(qualifySelector("body *#foo", "*"), "body *#foo");
  });

  it("should return body *.foo for body *.foo and *", function() {
    assert.equal(qualifySelector("body *.foo", "*"), "body *.foo");
  });

  // Compound selectors with pseudo-class with parentheses.
  it("should return body div#foo:nth-child(1) for body #foo:nth-child(1) and div", function() {
    assert.equal(qualifySelector("body #foo:nth-child(1)", "div"),
                 "body div#foo:nth-child(1)");
  });

  it("should return body div.foo:nth-child(1) for body .foo:nth-child(1) and div", function() {
    assert.equal(qualifySelector("body .foo:nth-child(1)", "div"),
                 "body div.foo:nth-child(1)");
  });

  it("should return body div#foo:nth-child(1) for body div:nth-child(1) and #foo", function() {
    assert.equal(qualifySelector("body div:nth-child(1)", "#foo"),
                 "body div#foo:nth-child(1)");
  });

  it("should return body div.foo:nth-child(1) for body div:nth-child(1) and .foo", function() {
    assert.equal(qualifySelector("body div:nth-child(1)", ".foo"),
                 "body div.foo:nth-child(1)");
  });

  it("should return body div.foo#bar:nth-child(1) for body div#bar:nth-child(1) and .foo", function() {
    assert.equal(qualifySelector("body div#bar:nth-child(1)", ".foo"),
                 "body div.foo#bar:nth-child(1)");
  });

  it("should return body div#foo.bar:nth-child(1) for body div.bar:nth-child(1) and #foo", function() {
    assert.equal(qualifySelector("body div.bar:nth-child(1)", "#foo"),
                 "body div#foo.bar:nth-child(1)");
  });

  it("should return body div#foo:nth-child(1) for body div#foo:nth-child(1) and div", function() {
    assert.equal(qualifySelector("body div#foo:nth-child(1)", "div"),
                 "body div#foo:nth-child(1)");
  });

  it("should return body div.foo:nth-child(1) for body div.foo:nth-child(1) and div", function() {
    assert.equal(qualifySelector("body div.foo:nth-child(1)", "div"),
                 "body div.foo:nth-child(1)");
  });

  it("should return body div#foo:nth-child(1) for body div:nth-child(1) and div#foo", function() {
    assert.equal(qualifySelector("body div:nth-child(1)", "div#foo"),
                 "body div#foo:nth-child(1)");
  });

  it("should return body div.foo:nth-child(1) for body div:nth-child(1) and div.foo", function() {
    assert.equal(qualifySelector("body div:nth-child(1)", "div.foo"),
                 "body div.foo:nth-child(1)");
  });

  it("should return body div.foo#bar:nth-child(1) for body div#bar:nth-child(1) and div.foo", function() {
    assert.equal(qualifySelector("body div#bar:nth-child(1)", "div.foo"),
                 "body div.foo#bar:nth-child(1)");
  });

  it("should return body div#foo.bar:nth-child(1) for body div.bar:nth-child(1) and div#foo", function() {
    assert.equal(qualifySelector("body div.bar:nth-child(1)", "div#foo"),
                 "body div#foo.bar:nth-child(1)");
  });

  // Compound selectors with pseudo-class with parentheses containing extra
  // whitespace.
  it("should return body div#foo:nth-child( 1 ) for body #foo:nth-child( 1 ) and div", function() {
    assert.equal(qualifySelector("body #foo:nth-child( 1 )", "div"),
                 "body div#foo:nth-child( 1 )");
  });

  it("should return body div.foo:nth-child( 1 ) for body .foo:nth-child( 1 ) and div", function() {
    assert.equal(qualifySelector("body .foo:nth-child( 1 )", "div"),
                 "body div.foo:nth-child( 1 )");
  });

  it("should return body div#foo:nth-child( 1 ) for body div:nth-child( 1 ) and #foo", function() {
    assert.equal(qualifySelector("body div:nth-child( 1 )", "#foo"),
                 "body div#foo:nth-child( 1 )");
  });

  it("should return body div.foo:nth-child( 1 ) for body div:nth-child( 1 ) and .foo", function() {
    assert.equal(qualifySelector("body div:nth-child( 1 )", ".foo"),
                 "body div.foo:nth-child( 1 )");
  });

  it("should return body div.foo#bar:nth-child( 1 ) for body div#bar:nth-child( 1 ) and .foo", function() {
    assert.equal(qualifySelector("body div#bar:nth-child( 1 )", ".foo"),
                 "body div.foo#bar:nth-child( 1 )");
  });

  it("should return body div#foo.bar:nth-child( 1 ) for body div.bar:nth-child( 1 ) and #foo", function() {
    assert.equal(qualifySelector("body div.bar:nth-child( 1 )", "#foo"),
                 "body div#foo.bar:nth-child( 1 )");
  });

  it("should return body div#foo:nth-child( 1 ) for body div#foo:nth-child( 1 ) and div", function() {
    assert.equal(qualifySelector("body div#foo:nth-child( 1 )", "div"),
                 "body div#foo:nth-child( 1 )");
  });

  it("should return body div.foo:nth-child( 1 ) for body div.foo:nth-child( 1 ) and div", function() {
    assert.equal(qualifySelector("body div.foo:nth-child( 1 )", "div"),
                 "body div.foo:nth-child( 1 )");
  });

  it("should return body div#foo:nth-child( 1 ) for body div:nth-child( 1 ) and div#foo", function() {
    assert.equal(qualifySelector("body div:nth-child( 1 )", "div#foo"),
                 "body div#foo:nth-child( 1 )");
  });

  it("should return body div.foo:nth-child( 1 ) for body div:nth-child( 1 ) and div.foo", function() {
    assert.equal(qualifySelector("body div:nth-child( 1 )", "div.foo"),
                 "body div.foo:nth-child( 1 )");
  });

  it("should return body div.foo#bar:nth-child( 1 ) for body div#bar:nth-child( 1 ) and div.foo", function() {
    assert.equal(qualifySelector("body div#bar:nth-child( 1 )", "div.foo"),
                 "body div.foo#bar:nth-child( 1 )");
  });

  it("should return body div#foo.bar:nth-child( 1 ) for body div.bar:nth-child( 1 ) and div#foo", function() {
    assert.equal(qualifySelector("body div.bar:nth-child( 1 )", "div#foo"),
                 "body div#foo.bar:nth-child( 1 )");
  });

  // Compound selectors with child combinator and pseudo-class with
  // parentheses.
  it("should return body > div#foo:nth-child(1) for body > #foo:nth-child(1) and div", function() {
    assert.equal(qualifySelector("body > #foo:nth-child(1)", "div"),
                 "body > div#foo:nth-child(1)");
  });

  it("should return body > div.foo:nth-child(1) for body > .foo:nth-child(1) and div", function() {
    assert.equal(qualifySelector("body > .foo:nth-child(1)", "div"),
                 "body > div.foo:nth-child(1)");
  });

  it("should return body > div#foo:nth-child(1) for body > div:nth-child(1) and #foo", function() {
    assert.equal(qualifySelector("body > div:nth-child(1)", "#foo"),
                 "body > div#foo:nth-child(1)");
  });

  it("should return body > div.foo:nth-child(1) for body > div:nth-child(1) and .foo", function() {
    assert.equal(qualifySelector("body > div:nth-child(1)", ".foo"),
                 "body > div.foo:nth-child(1)");
  });

  it("should return body > div.foo#bar:nth-child(1) for body > div#bar:nth-child(1) and .foo", function() {
    assert.equal(qualifySelector("body > div#bar:nth-child(1)", ".foo"),
                 "body > div.foo#bar:nth-child(1)");
  });

  it("should return body > div#foo.bar:nth-child(1) for body > div.bar:nth-child(1) and #foo", function() {
    assert.equal(qualifySelector("body > div.bar:nth-child(1)", "#foo"),
                 "body > div#foo.bar:nth-child(1)");
  });

  it("should return body > div#foo:nth-child(1) for body > div#foo:nth-child(1) and div", function() {
    assert.equal(qualifySelector("body > div#foo:nth-child(1)", "div"),
                 "body > div#foo:nth-child(1)");
  });

  it("should return body > div.foo:nth-child(1) for body > div.foo:nth-child(1) and div", function() {
    assert.equal(qualifySelector("body > div.foo:nth-child(1)", "div"),
                 "body > div.foo:nth-child(1)");
  });

  it("should return body > div#foo:nth-child(1) for body > div:nth-child(1) and div#foo", function() {
    assert.equal(qualifySelector("body > div:nth-child(1)", "div#foo"),
                 "body > div#foo:nth-child(1)");
  });

  it("should return body > div.foo:nth-child(1) for body > div:nth-child(1) and div.foo", function() {
    assert.equal(qualifySelector("body > div:nth-child(1)", "div.foo"),
                 "body > div.foo:nth-child(1)");
  });

  it("should return body > div.foo#bar:nth-child(1) for body > div#bar:nth-child(1) and div.foo", function() {
    assert.equal(qualifySelector("body > div#bar:nth-child(1)", "div.foo"),
                 "body > div.foo#bar:nth-child(1)");
  });

  it("should return body > div#foo.bar:nth-child(1) for body > div.bar:nth-child(1) and div#foo", function() {
    assert.equal(qualifySelector("body > div.bar:nth-child(1)", "div#foo"),
                 "body > div#foo.bar:nth-child(1)");
  });

  // Compound selectors with child combinator surrounded by no whitespace and
  // pseudo-class with parentheses.
  it("should return body>div#foo:nth-child(1) for body>#foo:nth-child(1) and div", function() {
    assert.equal(qualifySelector("body>#foo:nth-child(1)", "div"),
                 "body>div#foo:nth-child(1)");
  });

  it("should return body>div.foo:nth-child(1) for body>.foo:nth-child(1) and div", function() {
    assert.equal(qualifySelector("body>.foo:nth-child(1)", "div"),
                 "body>div.foo:nth-child(1)");
  });

  it("should return body>div#foo:nth-child(1) for body>div:nth-child(1) and #foo", function() {
    assert.equal(qualifySelector("body>div:nth-child(1)", "#foo"),
                 "body>div#foo:nth-child(1)");
  });

  it("should return body>div.foo:nth-child(1) for body>div:nth-child(1) and .foo", function() {
    assert.equal(qualifySelector("body>div:nth-child(1)", ".foo"),
                 "body>div.foo:nth-child(1)");
  });

  it("should return body>div.foo#bar:nth-child(1) for body>div#bar:nth-child(1) and .foo", function() {
    assert.equal(qualifySelector("body>div#bar:nth-child(1)", ".foo"),
                 "body>div.foo#bar:nth-child(1)");
  });

  it("should return body>div#foo.bar:nth-child(1) for body>div.bar:nth-child(1) and #foo", function() {
    assert.equal(qualifySelector("body>div.bar:nth-child(1)", "#foo"),
                 "body>div#foo.bar:nth-child(1)");
  });

  it("should return body>div#foo:nth-child(1) for body>div#foo:nth-child(1) and div", function() {
    assert.equal(qualifySelector("body>div#foo:nth-child(1)", "div"),
                 "body>div#foo:nth-child(1)");
  });

  it("should return body>div.foo:nth-child(1) for body>div.foo:nth-child(1) and div", function() {
    assert.equal(qualifySelector("body>div.foo:nth-child(1)", "div"),
                 "body>div.foo:nth-child(1)");
  });

  it("should return body>div#foo:nth-child(1) for body>div:nth-child(1) and div#foo", function() {
    assert.equal(qualifySelector("body>div:nth-child(1)", "div#foo"),
                 "body>div#foo:nth-child(1)");
  });

  it("should return body>div.foo:nth-child(1) for body>div:nth-child(1) and div.foo", function() {
    assert.equal(qualifySelector("body>div:nth-child(1)", "div.foo"),
                 "body>div.foo:nth-child(1)");
  });

  it("should return body>div.foo#bar:nth-child(1) for body>div#bar:nth-child(1) and div.foo", function() {
    assert.equal(qualifySelector("body>div#bar:nth-child(1)", "div.foo"),
                 "body>div.foo#bar:nth-child(1)");
  });

  it("should return body>div#foo.bar:nth-child(1) for body>div.bar:nth-child(1) and div#foo", function() {
    assert.equal(qualifySelector("body>div.bar:nth-child(1)", "div#foo"),
                 "body>div#foo.bar:nth-child(1)");
  });

  // Compound selectors with adjacent sibling combinator and pseudo-class with
  // parentheses.
  it("should return article + div#foo:nth-child(1) for article + #foo:nth-child(1) and div", function() {
    assert.equal(qualifySelector("article + #foo:nth-child(1)", "div"),
                 "article + div#foo:nth-child(1)");
  });

  it("should return article + div.foo:nth-child(1) for article + .foo:nth-child(1) and div", function() {
    assert.equal(qualifySelector("article + .foo:nth-child(1)", "div"),
                 "article + div.foo:nth-child(1)");
  });

  it("should return article + div#foo:nth-child(1) for article + div:nth-child(1) and #foo", function() {
    assert.equal(qualifySelector("article + div:nth-child(1)", "#foo"),
                 "article + div#foo:nth-child(1)");
  });

  it("should return article + div.foo:nth-child(1) for article + div:nth-child(1) and .foo", function() {
    assert.equal(qualifySelector("article + div:nth-child(1)", ".foo"),
                 "article + div.foo:nth-child(1)");
  });

  it("should return article + div.foo#bar:nth-child(1) for article + div#bar:nth-child(1) and .foo", function() {
    assert.equal(qualifySelector("article + div#bar:nth-child(1)", ".foo"),
                 "article + div.foo#bar:nth-child(1)");
  });

  it("should return article + div#foo.bar:nth-child(1) for article + div.bar:nth-child(1) and #foo", function() {
    assert.equal(qualifySelector("article + div.bar:nth-child(1)", "#foo"),
                 "article + div#foo.bar:nth-child(1)");
  });

  it("should return article + div#foo:nth-child(1) for article + div#foo:nth-child(1) and div", function() {
    assert.equal(qualifySelector("article + div#foo:nth-child(1)", "div"),
                 "article + div#foo:nth-child(1)");
  });

  it("should return article + div.foo:nth-child(1) for article + div.foo:nth-child(1) and div", function() {
    assert.equal(qualifySelector("article + div.foo:nth-child(1)", "div"),
                 "article + div.foo:nth-child(1)");
  });

  it("should return article + div#foo:nth-child(1) for article + div:nth-child(1) and div#foo", function() {
    assert.equal(qualifySelector("article + div:nth-child(1)", "div#foo"),
                 "article + div#foo:nth-child(1)");
  });

  it("should return article + div.foo:nth-child(1) for article + div:nth-child(1) and div.foo", function() {
    assert.equal(qualifySelector("article + div:nth-child(1)", "div.foo"),
                 "article + div.foo:nth-child(1)");
  });

  it("should return article + div.foo#bar:nth-child(1) for article + div#bar:nth-child(1) and div.foo", function() {
    assert.equal(qualifySelector("article + div#bar:nth-child(1)", "div.foo"),
                 "article + div.foo#bar:nth-child(1)");
  });

  it("should return article + div#foo.bar:nth-child(1) for article + div.bar:nth-child(1) and div#foo", function() {
    assert.equal(qualifySelector("article + div.bar:nth-child(1)", "div#foo"),
                 "article + div#foo.bar:nth-child(1)");
  });

  // Compound selectors with general sibling combinator and pseudo-class with
  // parentheses.
  it("should return article ~ div#foo:nth-child(1) for article ~ #foo:nth-child(1) and div", function() {
    assert.equal(qualifySelector("article ~ #foo:nth-child(1)", "div"),
                 "article ~ div#foo:nth-child(1)");
  });

  it("should return article ~ div.foo:nth-child(1) for article ~ .foo:nth-child(1) and div", function() {
    assert.equal(qualifySelector("article ~ .foo:nth-child(1)", "div"),
                 "article ~ div.foo:nth-child(1)");
  });

  it("should return article ~ div#foo:nth-child(1) for article ~ div:nth-child(1) and #foo", function() {
    assert.equal(qualifySelector("article ~ div:nth-child(1)", "#foo"),
                 "article ~ div#foo:nth-child(1)");
  });

  it("should return article ~ div.foo:nth-child(1) for article ~ div:nth-child(1) and .foo", function() {
    assert.equal(qualifySelector("article ~ div:nth-child(1)", ".foo"),
                 "article ~ div.foo:nth-child(1)");
  });

  it("should return article ~ div.foo#bar:nth-child(1) for article ~ div#bar:nth-child(1) and .foo", function() {
    assert.equal(qualifySelector("article ~ div#bar:nth-child(1)", ".foo"),
                 "article ~ div.foo#bar:nth-child(1)");
  });

  it("should return article ~ div#foo.bar:nth-child(1) for article ~ div.bar:nth-child(1) and #foo", function() {
    assert.equal(qualifySelector("article ~ div.bar:nth-child(1)", "#foo"),
                 "article ~ div#foo.bar:nth-child(1)");
  });

  it("should return article ~ div#foo:nth-child(1) for article ~ div#foo:nth-child(1) and div", function() {
    assert.equal(qualifySelector("article ~ div#foo:nth-child(1)", "div"),
                 "article ~ div#foo:nth-child(1)");
  });

  it("should return article ~ div.foo:nth-child(1) for article ~ div.foo:nth-child(1) and div", function() {
    assert.equal(qualifySelector("article ~ div.foo:nth-child(1)", "div"),
                 "article ~ div.foo:nth-child(1)");
  });

  it("should return article ~ div#foo:nth-child(1) for article ~ div:nth-child(1) and div#foo", function() {
    assert.equal(qualifySelector("article ~ div:nth-child(1)", "div#foo"),
                 "article ~ div#foo:nth-child(1)");
  });

  it("should return article ~ div.foo:nth-child(1) for article ~ div:nth-child(1) and div.foo", function() {
    assert.equal(qualifySelector("article ~ div:nth-child(1)", "div.foo"),
                 "article ~ div.foo:nth-child(1)");
  });

  it("should return article ~ div.foo#bar:nth-child(1) for article ~ div#bar:nth-child(1) and div.foo", function() {
    assert.equal(qualifySelector("article ~ div#bar:nth-child(1)", "div.foo"),
                 "article ~ div.foo#bar:nth-child(1)");
  });

  it("should return article ~ div#foo.bar:nth-child(1) for article ~ div.bar:nth-child(1) and div#foo", function() {
    assert.equal(qualifySelector("article ~ div.bar:nth-child(1)", "div#foo"),
                 "article ~ div#foo.bar:nth-child(1)");
  });

  // Compound selectors with child combinator and pseudo-element.
  it("should return body > div#foo::first-child for body > #foo::first-child and div", function() {
    assert.equal(qualifySelector("body > #foo::first-child", "div"),
                 "body > div#foo::first-child");
  });

  it("should return body > div.foo::first-child for body > .foo::first-child and div", function() {
    assert.equal(qualifySelector("body > .foo::first-child", "div"),
                 "body > div.foo::first-child");
  });

  it("should return body > div#foo::first-child for body > div::first-child and #foo", function() {
    assert.equal(qualifySelector("body > div::first-child", "#foo"),
                 "body > div#foo::first-child");
  });

  it("should return body > div.foo::first-child for body > div::first-child and .foo", function() {
    assert.equal(qualifySelector("body > div::first-child", ".foo"),
                 "body > div.foo::first-child");
  });

  it("should return body > div.foo#bar::first-child for body > div#bar::first-child and .foo", function() {
    assert.equal(qualifySelector("body > div#bar::first-child", ".foo"),
                 "body > div.foo#bar::first-child");
  });

  it("should return body > div#foo.bar::first-child for body > div.bar::first-child and #foo", function() {
    assert.equal(qualifySelector("body > div.bar::first-child", "#foo"),
                 "body > div#foo.bar::first-child");
  });

  it("should return body > div#foo::first-child for body > div#foo::first-child and div", function() {
    assert.equal(qualifySelector("body > div#foo::first-child", "div"),
                 "body > div#foo::first-child");
  });

  it("should return body > div.foo::first-child for body > div.foo::first-child and div", function() {
    assert.equal(qualifySelector("body > div.foo::first-child", "div"),
                 "body > div.foo::first-child");
  });

  it("should return body > div#foo::first-child for body > div::first-child and div#foo", function() {
    assert.equal(qualifySelector("body > div::first-child", "div#foo"),
                 "body > div#foo::first-child");
  });

  it("should return body > div.foo::first-child for body > div::first-child and div.foo", function() {
    assert.equal(qualifySelector("body > div::first-child", "div.foo"),
                 "body > div.foo::first-child");
  });

  it("should return body > div.foo#bar::first-child for body > div#bar::first-child and div.foo", function() {
    assert.equal(qualifySelector("body > div#bar::first-child", "div.foo"),
                 "body > div.foo#bar::first-child");
  });

  it("should return body > div#foo.bar::first-child for body > div.bar::first-child and div#foo", function() {
    assert.equal(qualifySelector("body > div.bar::first-child", "div#foo"),
                 "body > div#foo.bar::first-child");
  });

  // Compound selectors with attribute selector.
  it("should return body div#foo[style='display: block'] for body #foo[style='display: block'] and div", function() {
    assert.equal(qualifySelector("body #foo[style='display: block']", "div"),
                 "body div#foo[style='display: block']");
  });

  it("should return body div.foo[style='display: block'] for body .foo[style='display: block'] and div", function() {
    assert.equal(qualifySelector("body .foo[style='display: block']", "div"),
                 "body div.foo[style='display: block']");
  });

  it("should return body div#foo[style='display: block'] for body div[style='display: block'] and #foo", function() {
    assert.equal(qualifySelector("body div[style='display: block']", "#foo"),
                 "body div#foo[style='display: block']");
  });

  it("should return body div.foo[style='display: block'] for body div[style='display: block'] and .foo", function() {
    assert.equal(qualifySelector("body div[style='display: block']", ".foo"),
                 "body div.foo[style='display: block']");
  });

  it("should return body div.foo#bar[style='display: block'] for body div#bar[style='display: block'] and .foo", function() {
    assert.equal(qualifySelector("body div#bar[style='display: block']", ".foo"),
                 "body div.foo#bar[style='display: block']");
  });

  it("should return body div#foo.bar[style='display: block'] for body div.bar[style='display: block'] and #foo", function() {
    assert.equal(qualifySelector("body div.bar[style='display: block']", "#foo"),
                 "body div#foo.bar[style='display: block']");
  });

  it("should return body div#foo[style='display: block'] for body div#foo[style='display: block'] and div", function() {
    assert.equal(qualifySelector("body div#foo[style='display: block']", "div"),
                 "body div#foo[style='display: block']");
  });

  it("should return body div.foo[style='display: block'] for body div.foo[style='display: block'] and div", function() {
    assert.equal(qualifySelector("body div.foo[style='display: block']", "div"),
                 "body div.foo[style='display: block']");
  });

  it("should return body div#foo[style='display: block'] for body div[style='display: block'] and div#foo", function() {
    assert.equal(qualifySelector("body div[style='display: block']", "div#foo"),
                 "body div#foo[style='display: block']");
  });

  it("should return body div.foo[style='display: block'] for body div[style='display: block'] and div.foo", function() {
    assert.equal(qualifySelector("body div[style='display: block']", "div.foo"),
                 "body div.foo[style='display: block']");
  });

  it("should return body div.foo#bar[style='display: block'] for body div#bar[style='display: block'] and div.foo", function() {
    assert.equal(qualifySelector("body div#bar[style='display: block']", "div.foo"),
                 "body div.foo#bar[style='display: block']");
  });

  it("should return body div#foo.bar[style='display: block'] for body div.bar[style='display: block'] and div#foo", function() {
    assert.equal(qualifySelector("body div.bar[style='display: block']", "div#foo"),
                 "body div#foo.bar[style='display: block']");
  });

  // Compound selectors with unqualified attribute selector.
  it("should return body div[style='display: block'] for body [style='display: block'] and div", function() {
    assert.equal(qualifySelector("body [style='display: block']", "div"),
                 "body div[style='display: block']");
  });

  it("should return body #foo[style='display: block'] for body [style='display: block'] and #foo", function() {
    assert.equal(qualifySelector("body [style='display: block']", "#foo"),
                 "body #foo[style='display: block']");
  });

  it("should return body .foo[style='display: block'] for body [style='display: block'] and .foo", function() {
    assert.equal(qualifySelector("body [style='display: block']", ".foo"),
                 "body .foo[style='display: block']");
  });

  // Multiple selectors.
  it("should return div#foo, div#bar for #foo, #bar and div", function() {
    assert.equal(qualifySelector("#foo, #bar", "div"), "div#foo, div#bar");
  });

  it("should return div.foo, div.bar for .foo, .bar and div", function() {
    assert.equal(qualifySelector(".foo, .bar", "div"), "div.foo, div.bar");
  });

  it("should return div#foo, #foo.bar for div, .bar and #foo", function() {
    assert.equal(qualifySelector("div, .bar", "#foo"), "div#foo, #foo.bar");
  });

  it("should return div.foo, .foo#bar for div, #bar and .foo", function() {
    assert.equal(qualifySelector("div, #bar", ".foo"), "div.foo, .foo#bar");
  });

  it("should return div#foo, div#bar for div#foo, div#bar and div", function() {
    assert.equal(qualifySelector("div#foo, div#bar", "div"), "div#foo, div#bar");
  });

  it("should return div.foo, div.bar for div.foo, div.bar and div", function() {
    assert.equal(qualifySelector("div.foo, div.bar", "div"), "div.foo, div.bar");
  });

  it("should return div#foo, div#foo.bar for div, div.bar and div#foo", function() {
    assert.equal(qualifySelector("div, div.bar", "div#foo"), "div#foo, div#foo.bar");
  });

  it("should return div.foo, div.foo#bar for div, div#bar and div.foo", function() {
    assert.equal(qualifySelector("div, div#bar", "div.foo"), "div.foo, div.foo#bar");
  });

  // Compound selector with class selector containing Unicode composite
  // character.
  it("should return body img.\ud83d\ude42 for body .\ud83d\ude42 and img", function() {
    assert.equal(qualifySelector("body .\ud83d\ude42", "img"),
                 "body img.\ud83d\ude42");
  });

  it("should return body img.\ud83d\ude42 for body img.\ud83d\ude42 and img", function() {
    assert.equal(qualifySelector("body img.\ud83d\ude42", "img"),
                 "body img.\ud83d\ude42");
  });

  // Qualifiers ending in combinators.
  for (let combinator of [" ", ">", " > ", "+", " + ", "~", " ~ "]) {
    // Simple selectors and simple qualifiers.
    it("should return div" + combinator + "#foo for #foo and div" + combinator, function() {
      assert.equal(qualifySelector("#foo", "div" + combinator),
                   "div" + combinator + "#foo");
    });

    it("should return div" + combinator + ".foo for .foo and div" + combinator, function() {
      assert.equal(qualifySelector(".foo", "div" + combinator),
                   "div" + combinator + ".foo");
    });

    it("should return #foo" + combinator + "div for div and #foo" + combinator, function() {
      assert.equal(qualifySelector("div", "#foo" + combinator),
                   "#foo" + combinator + "div");
    });

    it("should return .foo" + combinator + "div for div and .foo" + combinator, function() {
      assert.equal(qualifySelector("div", ".foo" + combinator),
                   ".foo" + combinator + "div");
    });

    it("should return .foo" + combinator + "div#bar for div#bar and .foo" + combinator, function() {
      assert.equal(qualifySelector("div#bar", ".foo" + combinator),
                   ".foo" + combinator + "div#bar");
    });

    it("should return #foo" + combinator + "div.bar for div.bar and #foo" + combinator, function() {
      assert.equal(qualifySelector("div.bar", "#foo" + combinator),
                   "#foo" + combinator + "div.bar");
    });

    // Simple selectors and compound qualifiers.
    it("should return body #foo" + combinator + "div for div and body #foo" + combinator, function() {
      assert.equal(qualifySelector("div", "body #foo" + combinator),
                   "body #foo" + combinator + "div");
    });

    it("should return body .foo" + combinator + "div for div and body .foo" + combinator, function() {
      assert.equal(qualifySelector("div", "body .foo" + combinator),
                   "body .foo" + combinator + "div");
    });

    it("should return body div" + combinator + "#foo for #foo and body div" + combinator, function() {
      assert.equal(qualifySelector("#foo", "body div" + combinator),
                   "body div" + combinator + "#foo");
    });

    it("should return body div" + combinator + ".foo for .foo and body div" + combinator, function() {
      assert.equal(qualifySelector(".foo", "body div" + combinator),
                   "body div" + combinator + ".foo");
    });

    it("should return body div#bar" + combinator + ".foo for .foo and body div#bar" + combinator, function() {
      assert.equal(qualifySelector(".foo", "body div#bar" + combinator),
                   "body div#bar" + combinator + ".foo");
    });

    it("should return body div.bar" + combinator + "#foo for #foo and body div.bar" + combinator, function() {
      assert.equal(qualifySelector("#foo", "body div.bar" + combinator),
                   "body div.bar" + combinator + "#foo");
    });

    // Compound selectors and simple qualifiers.
    it("should return body div" + combinator + "#foo for body #foo and div" + combinator, function() {
      assert.equal(qualifySelector("body #foo", "div" + combinator),
                   "body div" + combinator + "#foo");
    });

    it("should return body div" + combinator + ".foo for body .foo and div" + combinator, function() {
      assert.equal(qualifySelector("body .foo", "div" + combinator),
                   "body div" + combinator + ".foo");
    });

    it("should return body #foo" + combinator + "div for body div and #foo" + combinator, function() {
      assert.equal(qualifySelector("body div", "#foo" + combinator),
                   "body #foo" + combinator + "div");
    });

    it("should return body .foo" + combinator + "div for body div and .foo" + combinator, function() {
      assert.equal(qualifySelector("body div", ".foo" + combinator),
                   "body .foo" + combinator + "div");
    });

    it("should return body .foo" + combinator + "div#bar for body div#bar and .foo" + combinator, function() {
      assert.equal(qualifySelector("body div#bar", ".foo" + combinator),
                   "body .foo" + combinator + "div#bar");
    });

    it("should return body #foo" + combinator + "div.bar for body div.bar and #foo" + combinator, function() {
      assert.equal(qualifySelector("body div.bar", "#foo" + combinator),
                   "body #foo" + combinator + "div.bar");
    });

    // Note: There are some unresolved issues with compound selectors and
    // compound qualifiers (see #7402, #7403).
  }
});
