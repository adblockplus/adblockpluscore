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

describe("filterToRegExp()", function() {
  let filterToRegExp = null;

  beforeEach(function() {
    let sandboxedRequire = createSandbox();
    (
      {filterToRegExp} = sandboxedRequire(LIB_FOLDER + "/patterns")
    );
  });

  // Wildcards.
  it("should return '' for '*'", function() {
    assert.strictEqual(filterToRegExp("*"), "");
  });

  it("should return '' for '**'", function() {
    assert.strictEqual(filterToRegExp("**"), "");
  });

  it("should return 'a' for 'a*'", function() {
    assert.strictEqual(filterToRegExp("a*"), "a");
  });

  it("should return 'a' for '*a'", function() {
    assert.strictEqual(filterToRegExp("*a"), "a");
  });

  it("should return 'a' for 'a**'", function() {
    assert.strictEqual(filterToRegExp("a**"), "a");
  });

  it("should return 'a' for '**a'", function() {
    assert.strictEqual(filterToRegExp("**a"), "a");
  });

  it("should return 'a.*b' for 'a*b'", function() {
    assert.strictEqual(filterToRegExp("a*b"), "a.*b");
  });

  it("should return 'a.*b' for '*a*b*'", function() {
    assert.strictEqual(filterToRegExp("*a*b*"), "a.*b");
  });

  it("should return 'a.*b' for 'a**b'", function() {
    assert.strictEqual(filterToRegExp("a**b"), "a.*b");
  });

  it("should return 'a.*b' for '*a**b*'", function() {
    assert.strictEqual(filterToRegExp("*a**b*"), "a.*b");
  });

  it("should return 'a.*b.*c' for 'a*b*c'", function() {
    assert.strictEqual(filterToRegExp("a*b*c"), "a.*b.*c");
  });

  it("should return 'a.*b.*c' for '*a*b*c*'", function() {
    assert.strictEqual(filterToRegExp("*a*b*c*"), "a.*b.*c");
  });

  // Anchors.
  it("should return '^' for '|'", function() {
    assert.strictEqual(filterToRegExp("|"), "^");
  });

  it("should return '^a' for '|a'", function() {
    assert.strictEqual(filterToRegExp("|a"), "^a");
  });

  it("should return 'a$' for 'a|'", function() {
    assert.strictEqual(filterToRegExp("a|"), "a$");
  });

  it("should return '^a$' for '|a|'", function() {
    assert.strictEqual(filterToRegExp("|a|"), "^a$");
  });

  it("should return 'a\\|b' for 'a|b'", function() {
    assert.strictEqual(filterToRegExp("a|b"), "a\\|b");
  });

  it("should return 'a\\|$' for 'a||'", function() {
    assert.strictEqual(filterToRegExp("a||"), "a\\|$");
  });

  // Extended anchor.
  it("should return '^[\\w\\-]+:\\/+(?:[^\\/]+\\.)?' for '||'", function() {
    assert.strictEqual(filterToRegExp("||"),
                       "^[\\w\\-]+:\\/+(?:[^\\/]+\\.)?");
  });

  it("should return '^[\\w\\-]+:\\/+(?:[^\\/]+\\.)?a' for '||a'", function() {
    assert.strictEqual(filterToRegExp("||a"),
                       "^[\\w\\-]+:\\/+(?:[^\\/]+\\.)?a");
  });

  it("should return 'a\\|\\|b' for 'a||b'", function() {
    assert.strictEqual(filterToRegExp("a||b"), "a\\|\\|b");
  });

  // Extended anchor with anchors.
  it("should return '^[\\w\\-]+:\\/+(?:[^\\/]+\\.)?$' for '|||'", function() {
    assert.strictEqual(filterToRegExp("|||"),
                       "^[\\w\\-]+:\\/+(?:[^\\/]+\\.)?$");
  });

  it("should return '^[\\w\\-]+:\\/+(?:[^\\/]+\\.)?\\|$' for '||||'", function() {
    assert.strictEqual(filterToRegExp("||||"),
                       "^[\\w\\-]+:\\/+(?:[^\\/]+\\.)?\\|$");
  });

  it("should return '^[\\w\\-]+:\\/+(?:[^\\/]+\\.)?a$' for '||a|'", function() {
    assert.strictEqual(filterToRegExp("||a|"),
                       "^[\\w\\-]+:\\/+(?:[^\\/]+\\.)?a$");
  });

  it("should return '^[\\w\\-]+:\\/+(?:[^\\/]+\\.)?\\|a' for '|||a'", function() {
    assert.strictEqual(filterToRegExp("|||a"),
                       "^[\\w\\-]+:\\/+(?:[^\\/]+\\.)?\\|a");
  });

  // Separator placeholders.
  it("should return '(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)' for '^'", function() {
    assert.strictEqual(filterToRegExp("^"),
                       "(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)");
  });

  it("should return '(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)' for '^^", function() {
    assert.strictEqual(filterToRegExp("^^"),
                       "(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)");
  });

  it("should return 'a(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)' for 'a^'", function() {
    assert.strictEqual(filterToRegExp("a^"),
                       "a(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)");
  });

  it("should return '(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)a' for '^a'", function() {
    assert.strictEqual(filterToRegExp("^a"),
                       "(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)a");
  });

  it("should return '(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)a(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)' for '^a^'", function() {
    assert.strictEqual(filterToRegExp("^a^"),
                       "(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)a(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)");
  });

  it("should return 'a(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)b' for 'a^b'", function() {
    assert.strictEqual(filterToRegExp("a^b"),
                       "a(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)b");
  });

  it("should return 'a(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)b(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)c' for 'a^b^c'", function() {
    assert.strictEqual(filterToRegExp("a^b^c"),
                       "a(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)b(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)c");
  });

  // Separator placeholders with anchors.
  it("should return '(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)' for '^|'", function() {
    assert.strictEqual(filterToRegExp("^|"),
                       "(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)");
  });

  it("should return 'a(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)' for 'a^|'", function() {
    assert.strictEqual(filterToRegExp("a^|"),
                       "a(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)");
  });

  it("should return '(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)\\|$' for '^||'", function() {
    assert.strictEqual(filterToRegExp("^||"),
                       "(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)\\|$");
  });

  it("should return '^(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)' for '|^'", function() {
    assert.strictEqual(filterToRegExp("|^"),
                       "^(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)");
  });

  it("should return '^[\\w\\-]+:\\/+(?:[^\\/]+\\.)?(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)' for '||^'", function() {
    assert.strictEqual(filterToRegExp("||^"),
                       "^[\\w\\-]+:\\/+(?:[^\\/]+\\.)?(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)");
  });

  it("should return '^a(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)' for '|a^'", function() {
    assert.strictEqual(filterToRegExp("|a^"),
                       "^a(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)");
  });

  it("should return '^a(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)b' for '|a^b'", function() {
    assert.strictEqual(filterToRegExp("|a^b"),
                       "^a(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)b");
  });

  it("should return '^a(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)b$' for '|a^b|'", function() {
    assert.strictEqual(filterToRegExp("|a^b|"),
                       "^a(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)b$");
  });

  it("should return '^[\\w\\-]+:\\/+(?:[^\\/]+\\.)?a(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)' for '||a^'", function() {
    assert.strictEqual(filterToRegExp("||a^"),
                       "^[\\w\\-]+:\\/+(?:[^\\/]+\\.)?a(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)");
  });

  it("should return '^[\\w\\-]+:\\/+(?:[^\\/]+\\.)?a(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)b' for '||a^b'", function() {
    assert.strictEqual(filterToRegExp("||a^b"),
                       "^[\\w\\-]+:\\/+(?:[^\\/]+\\.)?a(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)b");
  });

  it("should return '^[\\w\\-]+:\\/+(?:[^\\/]+\\.)?a(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)b$' for '||a^b|'", function() {
    assert.strictEqual(filterToRegExp("||a^b|"),
                       "^[\\w\\-]+:\\/+(?:[^\\/]+\\.)?a(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)b$");
  });

  // Special characters.
  it("should return '\\:' for ':'", function() {
    assert.strictEqual(filterToRegExp(":"), "\\:");
  });

  it("should return '\\/' for '/'", function() {
    assert.strictEqual(filterToRegExp("/"), "\\/");
  });

  it("should return '\\.' for '.'", function() {
    assert.strictEqual(filterToRegExp("."), "\\.");
  });

  it("should return '\\?' for '?'", function() {
    assert.strictEqual(filterToRegExp("?"), "\\?");
  });

  it("should return '\\=' for '='", function() {
    assert.strictEqual(filterToRegExp("="), "\\=");
  });

  it("should return '\\&' for '&'", function() {
    assert.strictEqual(filterToRegExp("&"), "\\&");
  });

  it("should return '\\+' for '+'", function() {
    assert.strictEqual(filterToRegExp("+"), "\\+");
  });

  it("should return '\\#' for '#'", function() {
    assert.strictEqual(filterToRegExp("#"), "\\#");
  });

  it("should return '\\[' for '['", function() {
    assert.strictEqual(filterToRegExp("["), "\\[");
  });

  it("should return '\\]' for ']'", function() {
    assert.strictEqual(filterToRegExp("]"), "\\]");
  });

  it("should return '\\@' for '@'", function() {
    assert.strictEqual(filterToRegExp("@"), "\\@");
  });
});

describe("Pattern", function() {
  let Pattern = null;
  let filterToRegExp = null;
  let makeRegExpParameter = null;
  let URLRequest = null;

  beforeEach(function() {
    let sandboxedRequire = createSandbox();
    ({Pattern, filterToRegExp} = sandboxedRequire(LIB_FOLDER + "/patterns"));
    ({makeRegExpParameter} = sandboxedRequire(LIB_FOLDER + "/common"));
    ({URLRequest} = sandboxedRequire(LIB_FOLDER + "/url"));
  });

  it("should not compile literal patterns to regexes", function() {
    function expectLiteralPattern(patternText) {
      let pattern = new Pattern(patternText);
      assert.equal(pattern.regexp,
                   null,
                   `${patternText} should be a literal pattern`);
    }
    expectLiteralPattern("abcd");
    expectLiteralPattern("|abcd");
    expectLiteralPattern("||abcd");
    expectLiteralPattern("||abcd|");
    expectLiteralPattern("abcd^");
  });

  it("should compile explicit regexes", function() {
    function expectLiteralRegExpPattern(patternText) {
      let pattern = new Pattern(patternText);
      assert.deepStrictEqual(pattern.regexp, makeRegExpParameter(patternText));
    }
    expectLiteralRegExpPattern("/abcd/");
    expectLiteralRegExpPattern("/example.com$/");
  });

  it("should compile complex patterns to regexes", function() {
    function expectFilterToRegexPattern(patternText) {
      let pattern = new Pattern(patternText);
      assert.deepStrictEqual(pattern.regexp, new RegExp(filterToRegExp(patternText)));
    }
    expectFilterToRegexPattern("abc^def");
    expectFilterToRegexPattern("abc*def");
  });

  it("should flag patterns without keywords", function() {
    function expectHasNoKeywords(patternText) {
      let pattern = new Pattern(patternText);
      assert.ok(!pattern.hasKeywords(), `expected ${patternText} to have no keywords`);
      assert.equal(pattern.keywordCandidates(), null);
    }
    expectHasNoKeywords("/abcd/");
    expectHasNoKeywords("abcd");
  });

  it("should extract pattern's keywords", function() {
    function expectKeywords(patternText, expectedKeywords) {
      let pattern = new Pattern(patternText);
      assert.ok(pattern.hasKeywords(), `expected ${patternText} to have keywords`);
      assert.deepStrictEqual(pattern.keywordCandidates(), expectedKeywords);
    }
    expectKeywords("/abcd/*", ["/abcd"]);
    expectKeywords("||example.com/abc/def", ["|example", ".com", "/abc"]);
  });

  it("should match requests if the pattern matches", function() {
    function expectMatch(patternText, url, matchCase) {
      let pattern = new Pattern(patternText, matchCase);
      let request = URLRequest.from(url);
      assert.ok(pattern.matchesLocation(request), `expected ${patternText} with matchCase=${matchCase} to match ${url}`);
    }
    function expectNotMatch(patternText, url, matchCase) {
      let pattern = new Pattern(patternText, matchCase);
      let request = URLRequest.from(url);
      assert.ok(!pattern.matchesLocation(request), `expected ${patternText} with matchCase=${matchCase} to not match ${url}`);
    }

    expectMatch("abcd", "http://abcd/def");
    expectMatch("abcd", "http://aBcD/def");
    expectNotMatch("abcd", "http://aBcD/def", true);
    expectMatch("aBcD", "http://aBcD/def", true);
    expectNotMatch("dddd", "http://abcd/def");
    expectMatch("://abcd/d", "http://abcd/def");
    expectMatch("|http://", "http://abc/def");
    expectNotMatch("|abcd", "http://abcd/def");
    expectNotMatch("|/abcd/def", "http://abcd/def");
    expectMatch("/def|", "http://abc/def");
    expectMatch("/abc/def|", "http://abc/def");
    expectNotMatch("/abc/|", "http://abc/def");
    expectMatch("|http://abc/def|", "http://abc/def");
    expectMatch("||example.com/abc", "http://example.com/abc/def");
    expectMatch("||com^", "http://example.com/abc/def");
    expectMatch("||com^", "http://example.com/abc/def", true);
    expectMatch("||com^", "http://example.com");
    expectMatch("||com^", "http://example.com:8080");
    expectNotMatch("||mple.com", "http://example.com");
    expectNotMatch("||.com", "http://example.com");
    expectNotMatch("||http://example.com", "http://example.com");
    expectMatch("||example.com/abc|", "http://example.com/abc");
    expectNotMatch("||example.com/abc|", "http://example.com/abc/def");
    expectMatch("ex*abc", "http://example.com/abc");
    expectMatch("/\\d{3}/[0-9]+/", "http://example.com/132/234");
    expectMatch("/example.com/[a-z]{3}/[A-Z]{3}/", "http://example.com/AbC/DeF");
    expectNotMatch("/example.com/[a-z]{3}/[A-Z]{3}/", "http://example.com/AbC/DeF", true);
    expectMatch("/example.com/[a-z]{3}/[A-Z]{3}/", "http://example.com/abc/DEF", true);
    expectMatch("*", "http://foo/bar");
    expectMatch("||домен.рф/путь|", "http://домен.рф/путь");
  });
});
