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

let Filter = null;
let RegExpFilter = null;
let CombinedMatcher = null;
let defaultMatcher = null;
let Matcher = null;

exports.setUp = function(callback)
{
  let sandboxedRequire = createSandbox();
  (
    {Filter, RegExpFilter} = sandboxedRequire("../lib/filterClasses"),
    {CombinedMatcher, defaultMatcher, Matcher} = sandboxedRequire("../lib/matcher")
  );

  callback();
};

function compareKeywords(test, text, expected)
{
  for (let filter of [Filter.fromText(text), Filter.fromText("@@" + text)])
  {
    let matcher = new Matcher();
    let result = [];
    for (let i = 0; i < expected.length; i++)
    {
      let keyword = matcher.findKeyword(filter);
      result.push(keyword);
      if (keyword)
      {
        let dummyFilter = Filter.fromText("^" + keyword + "^");
        dummyFilter.filterCount = Infinity;
        matcher.add(dummyFilter);
      }
    }

    test.equal(result.join(", "), expected.join(", "), "Keyword candidates for " + filter.text);
  }
}

function checkMatch(test, filters, location, contentType, docDomain, thirdParty, sitekey, specificOnly, expected)
{
  let matcher = new Matcher();
  for (let filter of filters)
    matcher.add(Filter.fromText(filter));

  let result = matcher.matchesAny(location, RegExpFilter.typeMap[contentType], docDomain, thirdParty, sitekey, specificOnly);
  if (result)
    result = result.text;

  test.equal(result, expected, "match(" + location + ", " + contentType + ", " + docDomain + ", " + (thirdParty ? "third-party" : "first-party") + ", " + (sitekey || "no-sitekey") + ", " + (specificOnly ? "specificOnly" : "not-specificOnly") + ") with:\n" + filters.join("\n"));

  let combinedMatcher = new CombinedMatcher();
  for (let i = 0; i < 2; i++)
  {
    for (let filter of filters)
      combinedMatcher.add(Filter.fromText(filter));

    result = combinedMatcher.matchesAny(location, RegExpFilter.typeMap[contentType], docDomain, thirdParty, sitekey, specificOnly);
    if (result)
      result = result.text;

    test.equal(result, expected, "combinedMatch(" + location + ", " + contentType + ", " + docDomain + ", " + (thirdParty ? "third-party" : "first-party") + ", " + (sitekey || "no-sitekey") + ", " + (specificOnly ? "specificOnly" : "not-specificOnly") + ") with:\n" + filters.join("\n"));

    // Generic whitelisting rules can match for specificOnly searches, so we
    // can't easily know which rule will match for these whitelisting tests
    if (specificOnly)
      continue;

    // For next run: add whitelisting filters for filters that aren't already
    filters = filters.map(text => text.substr(0, 2) == "@@" ? text : "@@" + text);
    if (expected && expected.substr(0, 2) != "@@")
      expected = "@@" + expected;
  }
}

function cacheCheck(test, matcher, location, contentType, docDomain, thirdParty, expected)
{
  let result = matcher.matchesAny(location, RegExpFilter.typeMap[contentType], docDomain, thirdParty);
  if (result)
    result = result.text;

  test.equal(result, expected, "match(" + location + ", " + contentType + ", " + docDomain + ", " + (thirdParty ? "third-party" : "first-party") + ") with static filters");
}

exports.testMatcherClassDefinitions = function(test)
{
  test.equal(typeof Matcher, "function", "typeof Matcher");
  test.equal(typeof CombinedMatcher, "function", "typeof CombinedMatcher");
  test.equal(typeof defaultMatcher, "object", "typeof defaultMatcher");
  test.ok(defaultMatcher instanceof CombinedMatcher, "defaultMatcher is a CombinedMatcher instance");

  test.done();
};

exports.testKeywordExtraction = function(test)
{
  compareKeywords(test, "*", []);
  compareKeywords(test, "asdf", []);
  compareKeywords(test, "/asdf/", []);
  compareKeywords(test, "/asdf1234", []);
  compareKeywords(test, "/asdf/1234", ["asdf"]);
  compareKeywords(test, "/asdf/1234^", ["asdf", "1234"]);
  compareKeywords(test, "/asdf/123456^", ["123456", "asdf"]);
  compareKeywords(test, "^asdf^1234^56as^", ["asdf", "1234", "56as"]);
  compareKeywords(test, "*asdf/1234^", ["1234"]);
  compareKeywords(test, "|asdf,1234*", ["asdf"]);
  compareKeywords(test, "||domain.example^", ["example", "domain"]);
  compareKeywords(test, "&asdf=1234|", ["asdf", "1234"]);
  compareKeywords(test, "^foo%2Ebar^", ["foo%2ebar"]);
  compareKeywords(test, "^aSdF^1234", ["asdf"]);
  compareKeywords(test, "_asdf_1234_", ["asdf", "1234"]);
  compareKeywords(test, "+asdf-1234=", ["asdf", "1234"]);
  compareKeywords(test, "/123^ad2&ad&", ["123", "ad2"]);
  compareKeywords(test, "/123^ad2&ad$script,domain=example.com", ["123", "ad2"]);

  test.done();
};

exports.testFilterMatching = function(test)
{
  checkMatch(test, [], "http://abc/def", "IMAGE", null, false, null, false, null);
  checkMatch(test, ["abc"], "http://abc/def", "IMAGE", null, false, null, false, "abc");
  checkMatch(test, ["abc", "ddd"], "http://abc/def", "IMAGE", null, false, null, false, "abc");
  checkMatch(test, ["ddd", "abc"], "http://abc/def", "IMAGE", null, false, null, false, "abc");
  checkMatch(test, ["ddd", "abd"], "http://abc/def", "IMAGE", null, false, null, false, null);
  checkMatch(test, ["abc", "://abc/d"], "http://abc/def", "IMAGE", null, false, null, false, "://abc/d");
  checkMatch(test, ["://abc/d", "abc"], "http://abc/def", "IMAGE", null, false, null, false, "://abc/d");
  checkMatch(test, ["|http://"], "http://abc/def", "IMAGE", null, false, null, false, "|http://");
  checkMatch(test, ["|http://abc"], "http://abc/def", "IMAGE", null, false, null, false, "|http://abc");
  checkMatch(test, ["|abc"], "http://abc/def", "IMAGE", null, false, null, false, null);
  checkMatch(test, ["|/abc/def"], "http://abc/def", "IMAGE", null, false, null, false, null);
  checkMatch(test, ["/def|"], "http://abc/def", "IMAGE", null, false, null, false, "/def|");
  checkMatch(test, ["/abc/def|"], "http://abc/def", "IMAGE", null, false, null, false, "/abc/def|");
  checkMatch(test, ["/abc/|"], "http://abc/def", "IMAGE", null, false, null, false, null);
  checkMatch(test, ["http://abc/|"], "http://abc/def", "IMAGE", null, false, null, false, null);
  checkMatch(test, ["|http://abc/def|"], "http://abc/def", "IMAGE", null, false, null, false, "|http://abc/def|");
  checkMatch(test, ["|/abc/def|"], "http://abc/def", "IMAGE", null, false, null, false, null);
  checkMatch(test, ["|http://abc/|"], "http://abc/def", "IMAGE", null, false, null, false, null);
  checkMatch(test, ["|/abc/|"], "http://abc/def", "IMAGE", null, false, null, false, null);
  checkMatch(test, ["||example.com/abc"], "http://example.com/abc/def", "IMAGE", null, false, null, false, "||example.com/abc");
  checkMatch(test, ["||com/abc/def"], "http://example.com/abc/def", "IMAGE", null, false, null, false, "||com/abc/def");
  checkMatch(test, ["||com/abc"], "http://example.com/abc/def", "IMAGE", null, false, null, false, "||com/abc");
  checkMatch(test, ["||mple.com/abc"], "http://example.com/abc/def", "IMAGE", null, false, null, false, null);
  checkMatch(test, ["||.com/abc/def"], "http://example.com/abc/def", "IMAGE", null, false, null, false, null);
  checkMatch(test, ["||http://example.com/"], "http://example.com/abc/def", "IMAGE", null, false, null, false, null);
  checkMatch(test, ["||example.com/abc/def|"], "http://example.com/abc/def", "IMAGE", null, false, null, false, "||example.com/abc/def|");
  checkMatch(test, ["||com/abc/def|"], "http://example.com/abc/def", "IMAGE", null, false, null, false, "||com/abc/def|");
  checkMatch(test, ["||example.com/abc|"], "http://example.com/abc/def", "IMAGE", null, false, null, false, null);
  checkMatch(test, ["abc", "://abc/d", "asdf1234"], "http://abc/def", "IMAGE", null, false, null, false, "://abc/d");
  checkMatch(test, ["foo*://abc/d", "foo*//abc/de", "://abc/de", "asdf1234"], "http://abc/def", "IMAGE", null, false, null, false, "://abc/de");
  checkMatch(test, ["abc$third-party", "abc$~third-party", "ddd"], "http://abc/def", "IMAGE", null, false, null, false, "abc$~third-party");
  checkMatch(test, ["abc$third-party", "abc$~third-party", "ddd"], "http://abc/def", "IMAGE", null, true, null, false, "abc$third-party");
  checkMatch(test, ["//abc/def$third-party", "//abc/def$~third-party", "//abc_def"], "http://abc/def", "IMAGE", null, false, null, false, "//abc/def$~third-party");
  checkMatch(test, ["//abc/def$third-party", "//abc/def$~third-party", "//abc_def"], "http://abc/def", "IMAGE", null, true, null, false, "//abc/def$third-party");
  checkMatch(test, ["abc$third-party", "abc$~third-party", "//abc/def"], "http://abc/def", "IMAGE", null, true, null, false, "//abc/def");
  checkMatch(test, ["//abc/def", "abc$third-party", "abc$~third-party"], "http://abc/def", "IMAGE", null, true, null, false, "//abc/def");
  checkMatch(test, ["abc$third-party", "abc$~third-party", "//abc/def$third-party"], "http://abc/def", "IMAGE", null, true, null, false, "//abc/def$third-party");
  checkMatch(test, ["abc$third-party", "abc$~third-party", "//abc/def$third-party"], "http://abc/def", "IMAGE", null, false, null, false, "abc$~third-party");
  checkMatch(test, ["abc$third-party", "abc$~third-party", "//abc/def$~third-party"], "http://abc/def", "IMAGE", null, true, null, false, "abc$third-party");
  checkMatch(test, ["abc$image", "abc$script", "abc$~image"], "http://abc/def", "IMAGE", null, false, null, false, "abc$image");
  checkMatch(test, ["abc$image", "abc$script", "abc$~script"], "http://abc/def", "SCRIPT", null, false, null, false, "abc$script");
  checkMatch(test, ["abc$image", "abc$script", "abc$~image"], "http://abc/def", "OTHER", null, false, null, false, "abc$~image");
  checkMatch(test, ["//abc/def$image", "//abc/def$script", "//abc/def$~image"], "http://abc/def", "IMAGE", null, false, null, false, "//abc/def$image");
  checkMatch(test, ["//abc/def$image", "//abc/def$script", "//abc/def$~script"], "http://abc/def", "SCRIPT", null, false, null, false, "//abc/def$script");
  checkMatch(test, ["//abc/def$image", "//abc/def$script", "//abc/def$~image"], "http://abc/def", "OTHER", null, false, null, false, "//abc/def$~image");
  checkMatch(test, ["abc$image", "abc$~image", "//abc/def"], "http://abc/def", "IMAGE", null, false, null, false, "//abc/def");
  checkMatch(test, ["//abc/def", "abc$image", "abc$~image"], "http://abc/def", "IMAGE", null, false, null, false, "//abc/def");
  checkMatch(test, ["abc$image", "abc$~image", "//abc/def$image"], "http://abc/def", "IMAGE", null, false, null, false, "//abc/def$image");
  checkMatch(test, ["abc$image", "abc$~image", "//abc/def$script"], "http://abc/def", "IMAGE", null, false, null, false, "abc$image");
  checkMatch(test, ["abc$domain=foo.com", "abc$domain=bar.com", "abc$domain=~foo.com|~bar.com"], "http://abc/def", "IMAGE", "foo.com", false, null, false, "abc$domain=foo.com");
  checkMatch(test, ["abc$domain=foo.com", "abc$domain=bar.com", "abc$domain=~foo.com|~bar.com"], "http://abc/def", "IMAGE", "bar.com", false, null, false, "abc$domain=bar.com");
  checkMatch(test, ["abc$domain=foo.com", "abc$domain=bar.com", "abc$domain=~foo.com|~bar.com"], "http://abc/def", "IMAGE", "baz.com", false, null, false, "abc$domain=~foo.com|~bar.com");
  checkMatch(test, ["abc$domain=foo.com", "cba$domain=bar.com", "ccc$domain=~foo.com|~bar.com"], "http://abc/def", "IMAGE", "foo.com", false, null, false, "abc$domain=foo.com");
  checkMatch(test, ["abc$domain=foo.com", "cba$domain=bar.com", "ccc$domain=~foo.com|~bar.com"], "http://abc/def", "IMAGE", "bar.com", false, null, false, null);
  checkMatch(test, ["abc$domain=foo.com", "cba$domain=bar.com", "ccc$domain=~foo.com|~bar.com"], "http://abc/def", "IMAGE", "baz.com", false, null, false, null);
  checkMatch(test, ["abc$domain=foo.com", "cba$domain=bar.com", "ccc$domain=~foo.com|~bar.com"], "http://ccc/def", "IMAGE", "baz.com", false, null, false, "ccc$domain=~foo.com|~bar.com");
  checkMatch(test, ["abc$sitekey=foo-publickey", "abc$sitekey=bar-publickey"], "http://abc/def", "IMAGE", "foo.com", false, "foo-publickey", false, "abc$sitekey=foo-publickey");
  checkMatch(test, ["abc$sitekey=foo-publickey", "abc$sitekey=bar-publickey"], "http://abc/def", "IMAGE", "bar.com", false, "bar-publickey", false, "abc$sitekey=bar-publickey");
  checkMatch(test, ["abc$sitekey=foo-publickey", "cba$sitekey=bar-publickey"], "http://abc/def", "IMAGE", "bar.com", false, "bar-publickey", false, null);
  checkMatch(test, ["abc$sitekey=foo-publickey", "cba$sitekey=bar-publickey"], "http://abc/def", "IMAGE", "baz.com", false, null, false, null);
  checkMatch(test, ["abc$sitekey=foo-publickey,domain=foo.com", "abc$sitekey=bar-publickey,domain=bar.com"], "http://abc/def", "IMAGE", "foo.com", false, "foo-publickey", false, "abc$sitekey=foo-publickey,domain=foo.com");
  checkMatch(test, ["abc$sitekey=foo-publickey,domain=foo.com", "abc$sitekey=bar-publickey,domain=bar.com"], "http://abc/def", "IMAGE", "foo.com", false, "bar-publickey", false, null);
  checkMatch(test, ["abc$sitekey=foo-publickey,domain=foo.com", "abc$sitekey=bar-publickey,domain=bar.com"], "http://abc/def", "IMAGE", "bar.com", false, "foo-publickey", false, null);
  checkMatch(test, ["abc$sitekey=foo-publickey,domain=foo.com", "abc$sitekey=bar-publickey,domain=bar.com"], "http://abc/def", "IMAGE", "bar.com", false, "bar-publickey", false, "abc$sitekey=bar-publickey,domain=bar.com");
  checkMatch(test, ["@@foo.com$generichide"], "http://foo.com/bar", "GENERICHIDE", "foo.com", false, null, false, "@@foo.com$generichide");
  checkMatch(test, ["@@foo.com$genericblock"], "http://foo.com/bar", "GENERICBLOCK", "foo.com", false, null, false, "@@foo.com$genericblock");
  checkMatch(test, ["@@bar.com$generichide"], "http://foo.com/bar", "GENERICHIDE", "foo.com", false, null, false, null);
  checkMatch(test, ["@@bar.com$genericblock"], "http://foo.com/bar", "GENERICBLOCK", "foo.com", false, null, false, null);
  checkMatch(test, ["/bar"], "http://foo.com/bar", "IMAGE", "foo.com", false, null, true, null);
  checkMatch(test, ["/bar$domain=foo.com"], "http://foo.com/bar", "IMAGE", "foo.com", false, null, true, "/bar$domain=foo.com");

  test.done();
};

exports.testResultCacheChecks = function(test)
{
  let matcher = new CombinedMatcher();
  matcher.add(Filter.fromText("abc$image"));
  matcher.add(Filter.fromText("abc$script"));
  matcher.add(Filter.fromText("abc$~image,~script,~media,~ping"));
  matcher.add(Filter.fromText("cba$third-party"));
  matcher.add(Filter.fromText("cba$~third-party,~script"));
  matcher.add(Filter.fromText("http://def$image"));
  matcher.add(Filter.fromText("http://def$script"));
  matcher.add(Filter.fromText("http://def$~image,~script,~media,~ping"));
  matcher.add(Filter.fromText("http://fed$third-party"));
  matcher.add(Filter.fromText("http://fed$~third-party,~script"));

  cacheCheck(test, matcher, "http://abc", "IMAGE", null, false, "abc$image");
  cacheCheck(test, matcher, "http://abc", "SCRIPT", null, false, "abc$script");
  cacheCheck(test, matcher, "http://abc", "OTHER", null, false, "abc$~image,~script,~media,~ping");
  cacheCheck(test, matcher, "http://cba", "IMAGE", null, false, "cba$~third-party,~script");
  cacheCheck(test, matcher, "http://cba", "IMAGE", null, true, "cba$third-party");
  cacheCheck(test, matcher, "http://def", "IMAGE", null, false, "http://def$image");
  cacheCheck(test, matcher, "http://def", "SCRIPT", null, false, "http://def$script");
  cacheCheck(test, matcher, "http://def", "OTHER", null, false, "http://def$~image,~script,~media,~ping");
  cacheCheck(test, matcher, "http://fed", "IMAGE", null, false, "http://fed$~third-party,~script");
  cacheCheck(test, matcher, "http://fed", "IMAGE", null, true, "http://fed$third-party");
  cacheCheck(test, matcher, "http://abc_cba", "MEDIA", null, false, "cba$~third-party,~script");
  cacheCheck(test, matcher, "http://abc_cba", "MEDIA", null, true, "cba$third-party");
  cacheCheck(test, matcher, "http://abc_cba", "SCRIPT", null, false, "abc$script");
  cacheCheck(test, matcher, "http://def?http://fed", "MEDIA", null, false, "http://fed$~third-party,~script");
  cacheCheck(test, matcher, "http://def?http://fed", "MEDIA", null, true, "http://fed$third-party");
  cacheCheck(test, matcher, "http://def?http://fed", "SCRIPT", null, false, "http://def$script");

  test.done();
};
