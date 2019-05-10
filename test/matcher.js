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
let parseURL = null;

exports.setUp = function(callback)
{
  let sandboxedRequire = createSandbox();
  (
    {Filter, RegExpFilter} = sandboxedRequire("../lib/filterClasses"),
    {CombinedMatcher, defaultMatcher, Matcher} = sandboxedRequire("../lib/matcher"),
    {parseURL} = sandboxedRequire("../lib/url")
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

function checkMatch(test, filters, location, contentType, docDomain, sitekey, specificOnly, expected, expectedFirstMatch = expected)
{
  let url = parseURL(location);

  let matcher = new Matcher();
  for (let filter of filters)
    matcher.add(Filter.fromText(filter));

  let result = matcher.matchesAny(url, RegExpFilter.typeMap[contentType], docDomain, sitekey, specificOnly);
  if (result)
    result = result.text;

  test.equal(result, expectedFirstMatch, "match(" + location + ", " + contentType + ", " + docDomain + ", " + (sitekey || "no-sitekey") + ", " + (specificOnly ? "specificOnly" : "not-specificOnly") + ") with:\n" + filters.join("\n"));

  let combinedMatcher = new CombinedMatcher();
  for (let i = 0; i < 2; i++)
  {
    for (let filter of filters)
      combinedMatcher.add(Filter.fromText(filter));

    result = combinedMatcher.matchesAny(url, RegExpFilter.typeMap[contentType], docDomain, sitekey, specificOnly);
    if (result)
      result = result.text;

    test.equal(result, expected, "combinedMatch(" + location + ", " + contentType + ", " + docDomain + ", " + (sitekey || "no-sitekey") + ", " + (specificOnly ? "specificOnly" : "not-specificOnly") + ") with:\n" + filters.join("\n"));

    // Generic whitelisting rules can match for specificOnly searches, so we
    // can't easily know which rule will match for these whitelisting tests
    if (specificOnly)
      continue;

    // For next run: add whitelisting filters for filters that aren't already
    filters = filters.map(text => text.substring(0, 2) == "@@" ? text : "@@" + text);
    if (expected && expected.substring(0, 2) != "@@")
      expected = "@@" + expected;
  }
}

function checkSearch(test, filters, location, contentType, docDomain,
                     sitekey, specificOnly, filterType, expected)
{
  let url = parseURL(location);

  let matcher = new CombinedMatcher();
  for (let filter of filters)
    matcher.add(Filter.fromText(filter));

  let result = matcher.search(url, RegExpFilter.typeMap[contentType],
                              docDomain, sitekey, specificOnly, filterType);
  for (let key in result)
    result[key] = result[key].map(filter => filter.text);

  test.deepEqual(result, expected, "search(" + location + ", " +
                 contentType + ", " + docDomain + ", " +
                 (sitekey || "no-sitekey") + ", " +
                 (specificOnly ? "specificOnly" : "not-specificOnly") + ", " +
                 filterType + ") with:\n" + filters.join("\n"));
}

function cacheCheck(test, matcher, location, contentType, docDomain, expected)
{
  let url = parseURL(location);

  let result = matcher.matchesAny(url, RegExpFilter.typeMap[contentType], docDomain);
  if (result)
    result = result.text;

  test.equal(result, expected, "match(" + location + ", " + contentType + ", " + docDomain + ") with static filters");
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
  checkMatch(test, [], "http://abc/def", "IMAGE", null, null, false, null);
  checkMatch(test, ["abc"], "http://abc/def", "IMAGE", null, null, false, "abc");
  checkMatch(test, ["abc", "ddd"], "http://abc/def", "IMAGE", null, null, false, "abc");
  checkMatch(test, ["ddd", "abc"], "http://abc/def", "IMAGE", null, null, false, "abc");
  checkMatch(test, ["ddd", "abd"], "http://abc/def", "IMAGE", null, null, false, null);
  checkMatch(test, ["abc", "://abc/d"], "http://abc/def", "IMAGE", null, null, false, "://abc/d");
  checkMatch(test, ["://abc/d", "abc"], "http://abc/def", "IMAGE", null, null, false, "://abc/d");
  checkMatch(test, ["|http://"], "http://abc/def", "IMAGE", null, null, false, "|http://");
  checkMatch(test, ["|http://abc"], "http://abc/def", "IMAGE", null, null, false, "|http://abc");
  checkMatch(test, ["|abc"], "http://abc/def", "IMAGE", null, null, false, null);
  checkMatch(test, ["|/abc/def"], "http://abc/def", "IMAGE", null, null, false, null);
  checkMatch(test, ["/def|"], "http://abc/def", "IMAGE", null, null, false, "/def|");
  checkMatch(test, ["/abc/def|"], "http://abc/def", "IMAGE", null, null, false, "/abc/def|");
  checkMatch(test, ["/abc/|"], "http://abc/def", "IMAGE", null, null, false, null);
  checkMatch(test, ["http://abc/|"], "http://abc/def", "IMAGE", null, null, false, null);
  checkMatch(test, ["|http://abc/def|"], "http://abc/def", "IMAGE", null, null, false, "|http://abc/def|");
  checkMatch(test, ["|/abc/def|"], "http://abc/def", "IMAGE", null, null, false, null);
  checkMatch(test, ["|http://abc/|"], "http://abc/def", "IMAGE", null, null, false, null);
  checkMatch(test, ["|/abc/|"], "http://abc/def", "IMAGE", null, null, false, null);
  checkMatch(test, ["||example.com/abc"], "http://example.com/abc/def", "IMAGE", null, null, false, "||example.com/abc");
  checkMatch(test, ["||com/abc/def"], "http://example.com/abc/def", "IMAGE", null, null, false, "||com/abc/def");
  checkMatch(test, ["||com/abc"], "http://example.com/abc/def", "IMAGE", null, null, false, "||com/abc");
  checkMatch(test, ["||mple.com/abc"], "http://example.com/abc/def", "IMAGE", null, null, false, null);
  checkMatch(test, ["||.com/abc/def"], "http://example.com/abc/def", "IMAGE", null, null, false, null);
  checkMatch(test, ["||http://example.com/"], "http://example.com/abc/def", "IMAGE", null, null, false, null);
  checkMatch(test, ["||example.com/abc/def|"], "http://example.com/abc/def", "IMAGE", null, null, false, "||example.com/abc/def|");
  checkMatch(test, ["||com/abc/def|"], "http://example.com/abc/def", "IMAGE", null, null, false, "||com/abc/def|");
  checkMatch(test, ["||example.com/abc|"], "http://example.com/abc/def", "IMAGE", null, null, false, null);
  checkMatch(test, ["abc", "://abc/d", "asdf1234"], "http://abc/def", "IMAGE", null, null, false, "://abc/d");
  checkMatch(test, ["foo*://abc/d", "foo*//abc/de", "://abc/de", "asdf1234"], "http://abc/def", "IMAGE", null, null, false, "://abc/de");
  checkMatch(test, ["abc$third-party", "abc$~third-party", "ddd"], "http://abc/def", "IMAGE", null, null, false, "abc$~third-party");
  checkMatch(test, ["abc$third-party", "abc$~third-party", "ddd"], "http://abc/def", "IMAGE", "other-domain", null, false, "abc$third-party");
  checkMatch(test, ["//abc/def$third-party", "//abc/def$~third-party", "//abc_def"], "http://abc/def", "IMAGE", null, null, false, "//abc/def$~third-party");
  checkMatch(test, ["//abc/def$third-party", "//abc/def$~third-party", "//abc_def"], "http://abc/def", "IMAGE", "other-domain", null, false, "//abc/def$third-party");
  checkMatch(test, ["abc$third-party", "abc$~third-party", "//abc/def"], "http://abc/def", "IMAGE", "other-domain", null, false, "//abc/def");
  checkMatch(test, ["//abc/def", "abc$third-party", "abc$~third-party"], "http://abc/def", "IMAGE", "other-domain", null, false, "//abc/def");
  checkMatch(test, ["abc$third-party", "abc$~third-party", "//abc/def$third-party"], "http://abc/def", "IMAGE", "other-domain", null, false, "//abc/def$third-party");
  checkMatch(test, ["abc$third-party", "abc$~third-party", "//abc/def$third-party"], "http://abc/def", "IMAGE", null, null, false, "abc$~third-party");
  checkMatch(test, ["abc$third-party", "abc$~third-party", "//abc/def$~third-party"], "http://abc/def", "IMAGE", "other-domain", null, false, "abc$third-party");
  checkMatch(test, ["abc$image", "abc$script", "abc$~image"], "http://abc/def", "IMAGE", null, null, false, "abc$image");
  checkMatch(test, ["abc$image", "abc$script", "abc$~script"], "http://abc/def", "SCRIPT", null, null, false, "abc$script");
  checkMatch(test, ["abc$image", "abc$script", "abc$~image"], "http://abc/def", "OTHER", null, null, false, "abc$~image");
  checkMatch(test, ["//abc/def$image", "//abc/def$script", "//abc/def$~image"], "http://abc/def", "IMAGE", null, null, false, "//abc/def$image");
  checkMatch(test, ["//abc/def$image", "//abc/def$script", "//abc/def$~script"], "http://abc/def", "SCRIPT", null, null, false, "//abc/def$script");
  checkMatch(test, ["//abc/def$image", "//abc/def$script", "//abc/def$~image"], "http://abc/def", "OTHER", null, null, false, "//abc/def$~image");
  checkMatch(test, ["abc$image", "abc$~image", "//abc/def"], "http://abc/def", "IMAGE", null, null, false, "//abc/def");
  checkMatch(test, ["//abc/def", "abc$image", "abc$~image"], "http://abc/def", "IMAGE", null, null, false, "//abc/def");
  checkMatch(test, ["abc$image", "abc$~image", "//abc/def$image"], "http://abc/def", "IMAGE", null, null, false, "//abc/def$image");
  checkMatch(test, ["abc$image", "abc$~image", "//abc/def$script"], "http://abc/def", "IMAGE", null, null, false, "abc$image");
  checkMatch(test, ["abc$domain=foo.com", "abc$domain=bar.com", "abc$domain=~foo.com|~bar.com"], "http://foo.com/abc/def", "IMAGE", "foo.com", null, false, "abc$domain=foo.com");
  checkMatch(test, ["abc$domain=foo.com", "abc$domain=bar.com", "abc$domain=~foo.com|~bar.com"], "http://bar.com/abc/def", "IMAGE", "bar.com", null, false, "abc$domain=bar.com");
  checkMatch(test, ["abc$domain=foo.com", "abc$domain=bar.com", "abc$domain=~foo.com|~bar.com"], "http://baz.com/abc/def", "IMAGE", "baz.com", null, false, "abc$domain=~foo.com|~bar.com");
  checkMatch(test, ["abc$domain=foo.com", "cba$domain=bar.com", "ccc$domain=~foo.com|~bar.com"], "http://foo.com/abc/def", "IMAGE", "foo.com", null, false, "abc$domain=foo.com");
  checkMatch(test, ["abc$domain=foo.com", "cba$domain=bar.com", "ccc$domain=~foo.com|~bar.com"], "http://bar.com/abc/def", "IMAGE", "bar.com", null, false, null);
  checkMatch(test, ["abc$domain=foo.com", "cba$domain=bar.com", "ccc$domain=~foo.com|~bar.com"], "http://baz.com/abc/def", "IMAGE", "baz.com", null, false, null);
  checkMatch(test, ["abc$domain=foo.com", "cba$domain=bar.com", "ccc$domain=~foo.com|~bar.com"], "http://baz.com/ccc/def", "IMAGE", "baz.com", null, false, "ccc$domain=~foo.com|~bar.com");
  checkMatch(test, ["abc$sitekey=foo-publickey", "abc$sitekey=bar-publickey"], "http://foo.com/abc/def", "IMAGE", "foo.com", "foo-publickey", false, "abc$sitekey=foo-publickey");
  checkMatch(test, ["abc$sitekey=foo-publickey", "abc$sitekey=bar-publickey"], "http://bar.com/abc/def", "IMAGE", "bar.com", "bar-publickey", false, "abc$sitekey=bar-publickey");
  checkMatch(test, ["abc$sitekey=foo-publickey", "cba$sitekey=bar-publickey"], "http://bar.com/abc/def", "IMAGE", "bar.com", "bar-publickey", false, null);
  checkMatch(test, ["abc$sitekey=foo-publickey", "cba$sitekey=bar-publickey"], "http://baz.com/abc/def", "IMAGE", "baz.com", null, false, null);
  checkMatch(test, ["abc$sitekey=foo-publickey,domain=foo.com", "abc$sitekey=bar-publickey,domain=bar.com"], "http://foo.com/abc/def", "IMAGE", "foo.com", "foo-publickey", false, "abc$sitekey=foo-publickey,domain=foo.com");
  checkMatch(test, ["abc$sitekey=foo-publickey,domain=foo.com", "abc$sitekey=bar-publickey,domain=bar.com"], "http://foo.com/abc/def", "IMAGE", "foo.com", "bar-publickey", false, null);
  checkMatch(test, ["abc$sitekey=foo-publickey,domain=foo.com", "abc$sitekey=bar-publickey,domain=bar.com"], "http://bar.com/abc/def", "IMAGE", "bar.com", "foo-publickey", false, null);
  checkMatch(test, ["abc$sitekey=foo-publickey,domain=foo.com", "abc$sitekey=bar-publickey,domain=bar.com"], "http://bar.com/abc/def", "IMAGE", "bar.com", "bar-publickey", false, "abc$sitekey=bar-publickey,domain=bar.com");
  checkMatch(test, ["@@foo.com$document"], "http://foo.com/bar", "DOCUMENT", "foo.com", null, false, "@@foo.com$document");
  checkMatch(test, ["@@foo.com$elemhide"], "http://foo.com/bar", "ELEMHIDE", "foo.com", null, false, "@@foo.com$elemhide");
  checkMatch(test, ["@@foo.com$generichide"], "http://foo.com/bar", "GENERICHIDE", "foo.com", null, false, "@@foo.com$generichide");
  checkMatch(test, ["@@foo.com$genericblock"], "http://foo.com/bar", "GENERICBLOCK", "foo.com", null, false, "@@foo.com$genericblock");
  checkMatch(test, ["@@bar.com$document"], "http://foo.com/bar", "DOCUMENT", "foo.com", null, false, null);
  checkMatch(test, ["@@bar.com$elemhide"], "http://foo.com/bar", "ELEMHIDE", "foo.com", null, false, null);
  checkMatch(test, ["@@bar.com$generichide"], "http://foo.com/bar", "GENERICHIDE", "foo.com", null, false, null);
  checkMatch(test, ["@@bar.com$genericblock"], "http://foo.com/bar", "GENERICBLOCK", "foo.com", null, false, null);
  checkMatch(test, ["/bar"], "http://foo.com/bar", "IMAGE", "foo.com", null, true, null);
  checkMatch(test, ["/bar$domain=foo.com"], "http://foo.com/bar", "IMAGE", "foo.com", null, true, "/bar$domain=foo.com");
  checkMatch(test, ["@@||foo.com^"], "http://foo.com/bar", "IMAGE", "foo.com", null, false, null, "@@||foo.com^");
  checkMatch(test, ["/bar", "@@||foo.com^"], "http://foo.com/bar", "IMAGE", "foo.com", null, false, "@@||foo.com^");
  checkMatch(test, ["/bar", "@@||foo.com^"], "http://foo.com/foo", "IMAGE", "foo.com", null, false, null, "@@||foo.com^");
  checkMatch(test, ["||foo.com^$popup"], "http://foo.com/bar", "POPUP", "foo.com", null, false, "||foo.com^$popup");
  checkMatch(test, ["@@||foo.com^$popup"], "http://foo.com/bar", "POPUP", "foo.com", null, false, null, "@@||foo.com^$popup");
  checkMatch(test, ["||foo.com^$popup", "@@||foo.com^$popup"], "http://foo.com/bar", "POPUP", "foo.com", null, false, "@@||foo.com^$popup", "||foo.com^$popup");
  checkMatch(test, ["||foo.com^$csp=script-src 'none'"], "http://foo.com/bar", "CSP", "foo.com", null, false, "||foo.com^$csp=script-src 'none'");
  checkMatch(test, ["@@||foo.com^$csp"], "http://foo.com/bar", "CSP", "foo.com", null, false, null, "@@||foo.com^$csp");
  checkMatch(test, ["||foo.com^$csp=script-src 'none'", "@@||foo.com^$csp"], "http://foo.com/bar", "CSP", "foo.com", null, false, "@@||foo.com^$csp", "||foo.com^$csp=script-src 'none'");

  // See #7312.
  checkMatch(test, ["^foo/bar/$script"], "http://foo/bar/", "SCRIPT", "example.com", null, true, null);
  checkMatch(test, ["^foo/bar/$script"], "http://foo/bar/", "SCRIPT", "example.com", null, false, "^foo/bar/$script");
  checkMatch(test, ["^foo/bar/$script,domain=example.com", "@@^foo/bar/$script"], "http://foo/bar/", "SCRIPT", "example.com", null, true, "@@^foo/bar/$script", "^foo/bar/$script,domain=example.com");
  checkMatch(test, ["@@^foo/bar/$script", "^foo/bar/$script,domain=example.com"], "http://foo/bar/", "SCRIPT", "example.com", null, true, "@@^foo/bar/$script", "^foo/bar/$script,domain=example.com");
  checkMatch(test, ["@@^foo/bar/$script", "^foo/bar/$script,domain=example.com"], "http://foo/bar/", "SCRIPT", "example.com", null, false, "@@^foo/bar/$script");

  test.done();
};

exports.testFilterSearch = function(test)
{
  // Start with three filters: foo, bar$domain=example.com, and @@foo
  let filters = ["foo", "bar$domain=example.com", "@@foo"];

  checkSearch(test, filters, "http://example.com/foo", "IMAGE", "example.com",
              null, false, "all",
              {blocking: ["foo"], whitelist: ["@@foo"]});

  // Blocking only.
  checkSearch(test, filters, "http://example.com/foo", "IMAGE", "example.com",
              null, false, "blocking", {blocking: ["foo"]});

  // Whitelist only.
  checkSearch(test, filters, "http://example.com/foo", "IMAGE", "example.com",
              null, false, "whitelist", {whitelist: ["@@foo"]});

  // Different URLs.
  checkSearch(test, filters, "http://example.com/bar", "IMAGE", "example.com",
              null, false, "all",
              {blocking: ["bar$domain=example.com"], whitelist: []});
  checkSearch(test, filters, "http://example.com/foo/bar", "IMAGE",
              "example.com", null, false, "all", {
                blocking: ["foo", "bar$domain=example.com"],
                whitelist: ["@@foo"]
              });

  // Non-matching content type.
  checkSearch(test, filters, "http://example.com/foo", "CSP", "example.com",
              null, false, "all", {blocking: [], whitelist: []});

  // Non-matching specificity.
  checkSearch(test, filters, "http://example.com/foo", "IMAGE", "example.com",
              null, true, "all", {blocking: [], whitelist: ["@@foo"]});

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

  cacheCheck(test, matcher, "http://abc", "IMAGE", null, "abc$image");
  cacheCheck(test, matcher, "http://abc", "SCRIPT", null, "abc$script");
  cacheCheck(test, matcher, "http://abc", "OTHER", null, "abc$~image,~script,~media,~ping");
  cacheCheck(test, matcher, "http://cba", "IMAGE", null, "cba$~third-party,~script");
  cacheCheck(test, matcher, "http://cba", "IMAGE", "other-domain", "cba$third-party");
  cacheCheck(test, matcher, "http://def", "IMAGE", null, "http://def$image");
  cacheCheck(test, matcher, "http://def", "SCRIPT", null, "http://def$script");
  cacheCheck(test, matcher, "http://def", "OTHER", null, "http://def$~image,~script,~media,~ping");
  cacheCheck(test, matcher, "http://fed", "IMAGE", null, "http://fed$~third-party,~script");
  cacheCheck(test, matcher, "http://fed", "IMAGE", "other-domain", "http://fed$third-party");
  cacheCheck(test, matcher, "http://abc_cba", "MEDIA", null, "cba$~third-party,~script");
  cacheCheck(test, matcher, "http://abc_cba", "MEDIA", "other-domain", "cba$third-party");
  cacheCheck(test, matcher, "http://abc_cba", "SCRIPT", null, "abc$script");
  cacheCheck(test, matcher, "http://def?http://fed", "MEDIA", null, "http://fed$~third-party,~script");
  cacheCheck(test, matcher, "http://def?http://fed", "MEDIA", "other-domain", "http://fed$third-party");
  cacheCheck(test, matcher, "http://def?http://fed", "SCRIPT", null, "http://def$script");

  test.done();
};

exports.testWhitelisted = function(test)
{
  let matcher = new CombinedMatcher();

  test.ok(!matcher.isWhitelisted(parseURL("https://example.com/foo"),
                                 RegExpFilter.typeMap.IMAGE));
  test.ok(!matcher.isWhitelisted(parseURL("https://example.com/bar"),
                                 RegExpFilter.typeMap.IMAGE));
  test.ok(!matcher.isWhitelisted(parseURL("https://example.com/foo"),
                                 RegExpFilter.typeMap.SUBDOCUMENT));

  matcher.add(Filter.fromText("@@/foo^$image"));

  test.ok(matcher.isWhitelisted(parseURL("https://example.com/foo"),
                                RegExpFilter.typeMap.IMAGE));
  test.ok(!matcher.isWhitelisted(parseURL("https://example.com/bar"),
                                 RegExpFilter.typeMap.IMAGE));
  test.ok(!matcher.isWhitelisted(parseURL("https://example.com/foo"),
                                 RegExpFilter.typeMap.SUBDOCUMENT));

  matcher.remove(Filter.fromText("@@/foo^$image"));

  test.ok(!matcher.isWhitelisted(parseURL("https://example.com/foo"),
                                 RegExpFilter.typeMap.IMAGE));
  test.ok(!matcher.isWhitelisted(parseURL("https://example.com/bar"),
                                 RegExpFilter.typeMap.IMAGE));
  test.ok(!matcher.isWhitelisted(parseURL("https://example.com/foo"),
                                 RegExpFilter.typeMap.SUBDOCUMENT));

  test.done();
};

exports.testAddRemoveByKeyword = function(test)
{
  let matcher = new CombinedMatcher();

  matcher.add(Filter.fromText("||example.com/foo/bar/ad.jpg^"));

  // Add the same filter a second time to make sure it doesn't get added again
  // by a different keyword.
  matcher.add(Filter.fromText("||example.com/foo/bar/ad.jpg^"));

  test.ok(!!matcher.matchesAny(parseURL("https://example.com/foo/bar/ad.jpg"),
                               RegExpFilter.typeMap.IMAGE));

  matcher.remove(Filter.fromText("||example.com/foo/bar/ad.jpg^"));

  // Make sure the filter got removed so there is no match.
  test.ok(!matcher.matchesAny(parseURL("https://example.com/foo/bar/ad.jpg"),
                              RegExpFilter.typeMap.IMAGE));

  // Map { "example" => { text: "||example.com^$~third-party" } }
  matcher.add(Filter.fromText("||example.com^$~third-party"));

  test.equal(matcher._blacklist._filterDomainMapsByKeyword.size, 1);

  for (let [key, value] of matcher._blacklist._filterDomainMapsByKeyword)
  {
    test.equal(key, "example");
    test.deepEqual(value, Filter.fromText("||example.com^$~third-party"));
    break;
  }

  test.ok(!!matcher.matchesAny(parseURL("https://example.com/example/ad.jpg"),
                               RegExpFilter.typeMap.IMAGE, "example.com"));

  // Map {
  //   "example" => Map {
  //     "" => Map {
  //       { text: "||example.com^$~third-party" } => true,
  //       { text: "/example/*$~third-party" } => true
  //     }
  //   }
  // }
  matcher.add(Filter.fromText("/example/*$~third-party"));

  test.equal(matcher._blacklist._filterDomainMapsByKeyword.size, 1);

  for (let [key, value] of matcher._blacklist._filterDomainMapsByKeyword)
  {
    test.equal(key, "example");
    test.equal(value.size, 1);

    let map = value.get("");
    test.equal(map.size, 2);
    test.equal(map.get(Filter.fromText("||example.com^$~third-party")), true);
    test.equal(map.get(Filter.fromText("/example/*$~third-party")), true);

    break;
  }

  test.ok(!!matcher.matchesAny(parseURL("https://example.com/example/ad.jpg"),
                               RegExpFilter.typeMap.IMAGE, "example.com"));

  // Map { "example" => { text: "/example/*$~third-party" } }
  matcher.remove(Filter.fromText("||example.com^$~third-party"));

  test.equal(matcher._blacklist._filterDomainMapsByKeyword.size, 1);

  for (let [key, value] of matcher._blacklist._filterDomainMapsByKeyword)
  {
    test.equal(key, "example");
    test.deepEqual(value, Filter.fromText("/example/*$~third-party"));
    break;
  }

  test.ok(!!matcher.matchesAny(parseURL("https://example.com/example/ad.jpg"),
                               RegExpFilter.typeMap.IMAGE, "example.com"));

  // Map {}
  matcher.remove(Filter.fromText("/example/*$~third-party"));

  test.equal(matcher._blacklist._filterDomainMapsByKeyword.size, 0);

  test.ok(!matcher.matchesAny(parseURL("https://example.com/example/ad.jpg"),
                              RegExpFilter.typeMap.IMAGE, "example.com"));

  test.done();
};
