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

let {createSandbox} = require("./_common");

let Filter = null;
let RegExpFilter = null;

exports.setUp = function(callback)
{
  let sandboxedRequire = createSandbox();
  ({Filter, RegExpFilter} = sandboxedRequire("../lib/filterClasses"));
  callback();
};

function testMatch(test, text, location, contentType, docDomain, thirdParty, sitekey, expected)
{
  function testMatch_internal(text, location, contentType, docDomain, thirdParty, sitekey, expected)
  {
    let filter = Filter.fromText(text);
    let result = filter.matches(location, RegExpFilter.typeMap[contentType], docDomain, thirdParty, sitekey);
    test.equal(result, expected, '"' + text + '".matches(' + location + ", " + contentType + ", " + docDomain + ", " + (thirdParty ? "third-party" : "first-party") + ", " + (sitekey || "no-sitekey") + ")");
    filter.delete()
  }
  testMatch_internal(text, location, contentType, docDomain, thirdParty, sitekey, expected);
  if (!/^@@/.test(text))
    testMatch_internal("@@" + text, location, contentType, docDomain, thirdParty, sitekey, expected);
}

exports.testBasicFilters = function(test)
{
  testMatch(test, "abc", "http://abc/adf", "IMAGE", null, false, null, true);
  testMatch(test, "abc", "http://ABC/adf", "IMAGE", null, false, null, true);
  testMatch(test, "abc", "http://abd/adf", "IMAGE", null, false, null, false);
  testMatch(test, "|abc", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "|http://abc", "http://abc/adf", "IMAGE", null, false, null, true);
  testMatch(test, "abc|", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "abc/adf|", "http://abc/adf", "IMAGE", null, false, null, true);
  testMatch(test, "||example.com/foo", "http://example.com/foo/bar", "IMAGE", null, false, null, true);
  testMatch(test, "||com/foo", "http://example.com/foo/bar", "IMAGE", null, false, null, true);
  testMatch(test, "||mple.com/foo", "http://example.com/foo/bar", "IMAGE", null, false, null, false);
  testMatch(test, "||/example.com/foo", "http://example.com/foo/bar", "IMAGE", null, false, null, false);
  testMatch(test, "||example.com/foo/bar|", "http://example.com/foo/bar", "IMAGE", null, false, null, true);
  testMatch(test, "||example.com/foo", "http://foo.com/http://example.com/foo/bar", "IMAGE", null, false, null, false);
  testMatch(test, "||example.com/foo|", "http://example.com/foo/bar", "IMAGE", null, false, null, false);

  test.done();
};

exports.testSeparatorPlaceholders = function(test)
{
  testMatch(test, "abc^d", "http://abc/def", "IMAGE", null, false, null, true);
  testMatch(test, "abc^e", "http://abc/def", "IMAGE", null, false, null, false);
  testMatch(test, "def^", "http://abc/def", "IMAGE", null, false, null, true);
  testMatch(test, "http://abc/d^f", "http://abc/def", "IMAGE", null, false, null, false);
  testMatch(test, "http://abc/def^", "http://abc/def", "IMAGE", null, false, null, true);
  testMatch(test, "^foo=bar^", "http://abc/?foo=bar", "IMAGE", null, false, null, true);
  testMatch(test, "^foo=bar^", "http://abc/?a=b&foo=bar", "IMAGE", null, false, null, true);
  testMatch(test, "^foo=bar^", "http://abc/?foo=bar&a=b", "IMAGE", null, false, null, true);
  testMatch(test, "^foo=bar^", "http://abc/?notfoo=bar", "IMAGE", null, false, null, false);
  testMatch(test, "^foo=bar^", "http://abc/?foo=barnot", "IMAGE", null, false, null, false);
  testMatch(test, "^foo=bar^", "http://abc/?foo=bar%2Enot", "IMAGE", null, false, null, false);
  testMatch(test, "||example.com^", "http://example.com/foo/bar", "IMAGE", null, false, null, true);
  testMatch(test, "||example.com^", "http://example.company.com/foo/bar", "IMAGE", null, false, null, false);
  testMatch(test, "||example.com^", "http://example.com:1234/foo/bar", "IMAGE", null, false, null, true);
  testMatch(test, "||example.com^", "http://example.com.com/foo/bar", "IMAGE", null, false, null, false);
  testMatch(test, "||example.com^", "http://example.com-company.com/foo/bar", "IMAGE", null, false, null, false);
  testMatch(test, "||example.com^foo", "http://example.com/foo/bar", "IMAGE", null, false, null, true);
  testMatch(test, "||пример.ру^", "http://пример.ру/foo/bar", "IMAGE", null, false, null, true);
  testMatch(test, "||пример.ру^", "http://пример.руководитель.ру/foo/bar", "IMAGE", null, false, null, false);
  testMatch(test, "||пример.ру^", "http://пример.ру:1234/foo/bar", "IMAGE", null, false, null, true);
  testMatch(test, "||пример.ру^", "http://пример.ру.ру/foo/bar", "IMAGE", null, false, null, false);
  testMatch(test, "||пример.ру^", "http://пример.ру-ководитель.ру/foo/bar", "IMAGE", null, false, null, false);
  testMatch(test, "||пример.ру^foo", "http://пример.ру/foo/bar", "IMAGE", null, false, null, true);

  test.done();
};

exports.testWildcards = function(test)
{
  testMatch(test, "abc*d", "http://abc/adf", "IMAGE", null, false, null, true);
  testMatch(test, "abc*d", "http://abcd/af", "IMAGE", null, false, null, true);
  testMatch(test, "abc*d", "http://abc/d/af", "IMAGE", null, false, null, true);
  testMatch(test, "abc*d", "http://dabc/af", "IMAGE", null, false, null, false);
  testMatch(test, "*abc", "http://abc/adf", "IMAGE", null, false, null, true);
  testMatch(test, "abc*", "http://abc/adf", "IMAGE", null, false, null, true);
  testMatch(test, "|*abc", "http://abc/adf", "IMAGE", null, false, null, true);
  testMatch(test, "abc*|", "http://abc/adf", "IMAGE", null, false, null, true);
  testMatch(test, "abc***d", "http://abc/adf", "IMAGE", null, false, null, true);

  test.done();
};

exports.testTypeOptions = function(test)
{
  testMatch(test, "abc$image", "http://abc/adf", "IMAGE", null, false, null, true);
  testMatch(test, "abc$other", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "abc$other", "http://abc/adf", "OTHER", null, false, null, true);
  testMatch(test, "abc$~other", "http://abc/adf", "OTHER", null, false, null, false);
  testMatch(test, "abc$script", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "abc$script", "http://abc/adf", "SCRIPT", null, false, null, true);
  testMatch(test, "abc$~script", "http://abc/adf", "SCRIPT", null, false, null, false);
  testMatch(test, "abc$stylesheet", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "abc$stylesheet", "http://abc/adf", "STYLESHEET", null, false, null, true);
  testMatch(test, "abc$~stylesheet", "http://abc/adf", "STYLESHEET", null, false, null, false);
  testMatch(test, "abc$object", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "abc$object", "http://abc/adf", "OBJECT", null, false, null, true);
  testMatch(test, "abc$~object", "http://abc/adf", "OBJECT", null, false, null, false);
  testMatch(test, "abc$document", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "abc$document", "http://abc/adf", "DOCUMENT", null, false, null, true);
  testMatch(test, "abc$~document", "http://abc/adf", "DOCUMENT", null, false, null, false);
  testMatch(test, "abc$subdocument", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "abc$subdocument", "http://abc/adf", "SUBDOCUMENT", null, false, null, true);
  testMatch(test, "abc$~subdocument", "http://abc/adf", "SUBDOCUMENT", null, false, null, false);
  testMatch(test, "abc$background", "http://abc/adf", "OBJECT", null, false, null, false);
  testMatch(test, "abc$background", "http://abc/adf", "IMAGE", null, false, null, true);
  testMatch(test, "abc$~background", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "abc$xbl", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "abc$xbl", "http://abc/adf", "XBL", null, false, null, true);
  testMatch(test, "abc$~xbl", "http://abc/adf", "XBL", null, false, null, false);
  testMatch(test, "abc$ping", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "abc$ping", "http://abc/adf", "PING", null, false, null, true);
  testMatch(test, "abc$~ping", "http://abc/adf", "PING", null, false, null, false);
  testMatch(test, "abc$xmlhttprequest", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "abc$xmlhttprequest", "http://abc/adf", "XMLHTTPREQUEST", null, false, null, true);
  testMatch(test, "abc$~xmlhttprequest", "http://abc/adf", "XMLHTTPREQUEST", null, false, null, false);
  testMatch(test, "abc$object-subrequest", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "abc$object-subrequest", "http://abc/adf", "OBJECT_SUBREQUEST", null, false, null, true);
  testMatch(test, "abc$~object-subrequest", "http://abc/adf", "OBJECT_SUBREQUEST", null, false, null, false);
  testMatch(test, "abc$dtd", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "abc$dtd", "http://abc/adf", "DTD", null, false, null, true);
  testMatch(test, "abc$~dtd", "http://abc/adf", "DTD", null, false, null, false);

  testMatch(test, "abc$media", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "abc$media", "http://abc/adf", "MEDIA", null, false, null, true);
  testMatch(test, "abc$~media", "http://abc/adf", "MEDIA", null, false, null, false);

  testMatch(test, "abc$font", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "abc$font", "http://abc/adf", "FONT", null, false, null, true);
  testMatch(test, "abc$~font", "http://abc/adf", "FONT", null, false, null, false);

  testMatch(test, "abc$ping", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "abc$ping", "http://abc/adf", "PING", null, false, null, true);
  testMatch(test, "abc$~ping", "http://abc/adf", "PING", null, false, null, false);

  testMatch(test, "abc$image,script", "http://abc/adf", "IMAGE", null, false, null, true);
  testMatch(test, "abc$~image", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "abc$~script", "http://abc/adf", "IMAGE", null, false, null, true);
  testMatch(test, "abc$~image,~script", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "abc$~script,~image", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "abc$~document,~script,~other", "http://abc/adf", "IMAGE", null, false, null, true);
  testMatch(test, "abc$~image,image", "http://abc/adf", "IMAGE", null, false, null, true);
  testMatch(test, "abc$image,~image", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "abc$~image,image", "http://abc/adf", "SCRIPT", null, false, null, true);
  testMatch(test, "abc$image,~image", "http://abc/adf", "SCRIPT", null, false, null, false);
  testMatch(test, "abc$match-case", "http://abc/adf", "IMAGE", null, false, null, true);
  testMatch(test, "abc$match-case", "http://ABC/adf", "IMAGE", null, false, null, false);
  testMatch(test, "abc$~match-case", "http://abc/adf", "IMAGE", null, false, null, true);
  testMatch(test, "abc$~match-case", "http://ABC/adf", "IMAGE", null, false, null, true);
  testMatch(test, "abc$match-case,image", "http://abc/adf", "IMAGE", null, false, null, true);
  testMatch(test, "abc$match-case,script", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "abc$match-case,image", "http://ABC/adf", "IMAGE", null, false, null, false);
  testMatch(test, "abc$match-case,script", "http://ABC/adf", "IMAGE", null, false, null, false);
  testMatch(test, "abc$third-party", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "abc$third-party", "http://abc/adf", "IMAGE", null, true, null, true);
  testMatch(test, "abd$third-party", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "abd$third-party", "http://abc/adf", "IMAGE", null, true, null, false);
  testMatch(test, "abc$image,third-party", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "abc$image,third-party", "http://abc/adf", "IMAGE", null, true, null, true);
  testMatch(test, "abc$~image,third-party", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "abc$~image,third-party", "http://abc/adf", "IMAGE", null, true, null, false);
  testMatch(test, "abc$~third-party", "http://abc/adf", "IMAGE", null, false, null, true);
  testMatch(test, "abc$~third-party", "http://abc/adf", "IMAGE", null, true, null, false);
  testMatch(test, "abd$~third-party", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "abd$~third-party", "http://abc/adf", "IMAGE", null, true, null, false);
  testMatch(test, "abc$image,~third-party", "http://abc/adf", "IMAGE", null, false, null, true);
  testMatch(test, "abc$image,~third-party", "http://abc/adf", "IMAGE", null, true, null, false);
  testMatch(test, "abc$~image,~third-party", "http://abc/adf", "IMAGE", null, false, null, false);

  test.done();
};

exports.testRegularExpressions = function(test)
{
  testMatch(test, "/abc/", "http://abc/adf", "IMAGE", null, false, null, true);
  testMatch(test, "/abc/", "http://abcd/adf", "IMAGE", null, false, null, true);
  testMatch(test, "*/abc/", "http://abc/adf", "IMAGE", null, false, null, true);
  testMatch(test, "*/abc/", "http://abcd/adf", "IMAGE", null, false, null, false);
  testMatch(test, "/a\\wc/", "http://abc/adf", "IMAGE", null, false, null, true);
  testMatch(test, "/a\\wc/", "http://a1c/adf", "IMAGE", null, false, null, true);
  testMatch(test, "/a\\wc/", "http://a_c/adf", "IMAGE", null, false, null, true);
  testMatch(test, "/a\\wc/", "http://a%c/adf", "IMAGE", null, false, null, false);

  test.done();
};

exports.textRegularExpressionsWithTypeOptions = function(test)
{
  testMatch(test, "/abc/$image", "http://abc/adf", "IMAGE", null, false, null, true);
  testMatch(test, "/abc/$image", "http://aBc/adf", "IMAGE", null, false, null, true);
  testMatch(test, "/abc/$script", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "/abc/$~image", "http://abcd/adf", "IMAGE", null, false, null, false);
  testMatch(test, "/ab{2}c/$image", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "/ab{2}c/$script", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "/ab{2}c/$~image", "http://abcd/adf", "IMAGE", null, false, null, false);
  testMatch(test, "/abc/$third-party", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "/abc/$third-party", "http://abc/adf", "IMAGE", null, true, null, true);
  testMatch(test, "/abc/$~third-party", "http://abc/adf", "IMAGE", null, false, null, true);
  testMatch(test, "/abc/$~third-party", "http://abc/adf", "IMAGE", null, true, null, false);
  testMatch(test, "/abc/$match-case", "http://abc/adf", "IMAGE", null, false, null, true);
  testMatch(test, "/abc/$match-case", "http://aBc/adf", "IMAGE", null, true, null, false);
  testMatch(test, "/ab{2}c/$match-case", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "/ab{2}c/$match-case", "http://aBc/adf", "IMAGE", null, true, null, false);
  testMatch(test, "/abc/$~match-case", "http://abc/adf", "IMAGE", null, false, null, true);
  testMatch(test, "/abc/$~match-case", "http://aBc/adf", "IMAGE", null, true, null, true);
  testMatch(test, "/ab{2}c/$~match-case", "http://abc/adf", "IMAGE", null, false, null, false);
  testMatch(test, "/ab{2}c/$~match-case", "http://aBc/adf", "IMAGE", null, true, null, false);

  test.done();
};

exports.testDomainRestrictions = function(test)
{
  testMatch(test, "abc$domain=foo.com", "http://abc/def", "IMAGE", "foo.com", true, null, true);
  testMatch(test, "abc$domain=foo.com", "http://abc/def", "IMAGE", "foo.com.", true, null, true);
  testMatch(test, "abc$domain=foo.com", "http://abc/def", "IMAGE", "www.foo.com", true, null, true);
  testMatch(test, "abc$domain=foo.com", "http://abc/def", "IMAGE", "www.foo.com.", true, null, true);
  testMatch(test, "abc$domain=foo.com", "http://abc/def", "IMAGE", "Foo.com", true, null, true);
  testMatch(test, "abc$domain=foo.com", "http://abc/def", "IMAGE", "abc.def.foo.com", true, null, true);
  testMatch(test, "abc$domain=foo.com", "http://abc/def", "IMAGE", "www.baz.com", true, null, false);
  testMatch(test, "abc$domain=foo.com", "http://abc/def", "IMAGE", null, true, null, false);
  testMatch(test, "abc$domain=foo.com|bar.com", "http://abc/def", "IMAGE", "foo.com", true, null, true);
  testMatch(test, "abc$domain=foo.com|bar.com", "http://abc/def", "IMAGE", "foo.com.", true, null, true);
  testMatch(test, "abc$domain=foo.com|bar.com", "http://abc/def", "IMAGE", "www.foo.com", true, null, true);
  testMatch(test, "abc$domain=foo.com|bar.com", "http://abc/def", "IMAGE", "www.foo.com.", true, null, true);
  testMatch(test, "abc$domain=foo.com|bar.com", "http://abc/def", "IMAGE", "Foo.com", true, null, true);
  testMatch(test, "abc$domain=foo.com|bar.com", "http://abc/def", "IMAGE", "abc.def.foo.com", true, null, true);
  testMatch(test, "abc$domain=foo.com|bar.com", "http://abc/def", "IMAGE", "www.baz.com", true, null, false);
  testMatch(test, "abc$domain=foo.com|bar.com", "http://abc/def", "IMAGE", null, true, null, false);
  testMatch(test, "abc$domain=bar.com|foo.com", "http://abc/def", "IMAGE", "foo.com", true, null, true);
  testMatch(test, "abc$domain=bar.com|foo.com", "http://abc/def", "IMAGE", "foo.com.", true, null, true);
  testMatch(test, "abc$domain=bar.com|foo.com", "http://abc/def", "IMAGE", "www.foo.com", true, null, true);
  testMatch(test, "abc$domain=bar.com|foo.com", "http://abc/def", "IMAGE", "www.foo.com.", true, null, true);
  testMatch(test, "abc$domain=bar.com|foo.com", "http://abc/def", "IMAGE", "Foo.com", true, null, true);
  testMatch(test, "abc$domain=bar.com|foo.com", "http://abc/def", "IMAGE", "abc.def.foo.com", true, null, true);
  testMatch(test, "abc$domain=bar.com|foo.com", "http://abc/def", "IMAGE", "www.baz.com", true, null, false);
  testMatch(test, "abc$domain=bar.com|foo.com", "http://abc/def", "IMAGE", null, true, null, false);
  testMatch(test, "abc$domain=~foo.com", "http://abc/def", "IMAGE", "foo.com", true, null, false);
  testMatch(test, "abc$domain=~foo.com", "http://abc/def", "IMAGE", "foo.com.", true, null, false);
  testMatch(test, "abc$domain=~foo.com", "http://abc/def", "IMAGE", "www.foo.com", true, null, false);
  testMatch(test, "abc$domain=~foo.com", "http://abc/def", "IMAGE", "www.foo.com.", true, null, false);
  testMatch(test, "abc$domain=~foo.com", "http://abc/def", "IMAGE", "Foo.com", true, null, false);
  testMatch(test, "abc$domain=~foo.com", "http://abc/def", "IMAGE", "abc.def.foo.com", true, null, false);
  testMatch(test, "abc$domain=~foo.com", "http://abc/def", "IMAGE", "www.baz.com", true, null, true);
  testMatch(test, "abc$domain=~foo.com", "http://abc/def", "IMAGE", null, true, null, true);
  testMatch(test, "abc$domain=~foo.com|~bar.com", "http://abc/def", "IMAGE", "foo.com", true, null, false);
  testMatch(test, "abc$domain=~foo.com|~bar.com", "http://abc/def", "IMAGE", "foo.com.", true, null, false);
  testMatch(test, "abc$domain=~foo.com|~bar.com", "http://abc/def", "IMAGE", "www.foo.com", true, null, false);
  testMatch(test, "abc$domain=~foo.com|~bar.com", "http://abc/def", "IMAGE", "www.foo.com.", true, null, false);
  testMatch(test, "abc$domain=~foo.com|~bar.com", "http://abc/def", "IMAGE", "Foo.com", true, null, false);
  testMatch(test, "abc$domain=~foo.com|~bar.com", "http://abc/def", "IMAGE", "abc.def.foo.com", true, null, false);
  testMatch(test, "abc$domain=~foo.com|~bar.com", "http://abc/def", "IMAGE", "www.baz.com", true, null, true);
  testMatch(test, "abc$domain=~foo.com|~bar.com", "http://abc/def", "IMAGE", null, true, null, true);
  testMatch(test, "abc$domain=~bar.com|~foo.com", "http://abc/def", "IMAGE", "foo.com", true, null, false);
  testMatch(test, "abc$domain=~bar.com|~foo.com", "http://abc/def", "IMAGE", "foo.com.", true, null, false);
  testMatch(test, "abc$domain=~bar.com|~foo.com", "http://abc/def", "IMAGE", "www.foo.com", true, null, false);
  testMatch(test, "abc$domain=~bar.com|~foo.com", "http://abc/def", "IMAGE", "www.foo.com.", true, null, false);
  testMatch(test, "abc$domain=~bar.com|~foo.com", "http://abc/def", "IMAGE", "Foo.com", true, null, false);
  testMatch(test, "abc$domain=~bar.com|~foo.com", "http://abc/def", "IMAGE", "abc.def.foo.com", true, null, false);
  testMatch(test, "abc$domain=~bar.com|~foo.com", "http://abc/def", "IMAGE", "www.baz.com", true, null, true);
  testMatch(test, "abc$domain=~bar.com|~foo.com", "http://abc/def", "IMAGE", null, true, null, true);
  testMatch(test, "abc$domain=foo.com|~bar.com", "http://abc/def", "IMAGE", "foo.com", true, null, true);
  testMatch(test, "abc$domain=foo.com|~bar.com", "http://abc/def", "IMAGE", "bar.com", true, null, false);
  testMatch(test, "abc$domain=foo.com|~bar.com", "http://abc/def", "IMAGE", "baz.com", true, null, false);
  testMatch(test, "abc$domain=foo.com|~bar.foo.com", "http://abc/def", "IMAGE", "foo.com", true, null, true);
  testMatch(test, "abc$domain=foo.com|~bar.foo.com", "http://abc/def", "IMAGE", "www.foo.com", true, null, true);
  testMatch(test, "abc$domain=foo.com|~bar.foo.com", "http://abc/def", "IMAGE", "bar.foo.com", true, null, false);
  testMatch(test, "abc$domain=foo.com|~bar.foo.com", "http://abc/def", "IMAGE", "www.bar.foo.com", true, null, false);
  testMatch(test, "abc$domain=foo.com|~bar.foo.com", "http://abc/def", "IMAGE", "baz.com", true, null, false);
  testMatch(test, "abc$domain=foo.com|~bar.foo.com", "http://abc/def", "IMAGE", "www.baz.com", true, null, false);
  testMatch(test, "abc$domain=com|~foo.com", "http://abc/def", "IMAGE", "bar.com", true, null, true);
  testMatch(test, "abc$domain=com|~foo.com", "http://abc/def", "IMAGE", "bar.net", true, null, false);
  testMatch(test, "abc$domain=com|~foo.com", "http://abc/def", "IMAGE", "foo.com", true, null, false);
  testMatch(test, "abc$domain=com|~foo.com", "http://abc/def", "IMAGE", "foo.net", true, null, false);
  testMatch(test, "abc$domain=com|~foo.com", "http://abc/def", "IMAGE", "com", true, null, true);
  testMatch(test, "abc$domain=foo.com", "http://ccc/def", "IMAGE", "foo.com", true, null, false);
  testMatch(test, "abc$domain=foo.com", "http://ccc/def", "IMAGE", "bar.com", true, null, false);
  testMatch(test, "abc$image,domain=foo.com", "http://abc/def", "IMAGE", "foo.com", true, null, true);
  testMatch(test, "abc$image,domain=foo.com", "http://abc/def", "IMAGE", "bar.com", true, null, false);
  testMatch(test, "abc$image,domain=foo.com", "http://abc/def", "OBJECT", "foo.com", true, null, false);
  testMatch(test, "abc$image,domain=foo.com", "http://abc/def", "OBJECT", "bar.com", true, null, false);
  testMatch(test, "abc$~image,domain=foo.com", "http://abc/def", "IMAGE", "foo.com", true, null, false);
  testMatch(test, "abc$~image,domain=foo.com", "http://abc/def", "IMAGE", "bar.com", true, null, false);
  testMatch(test, "abc$~image,domain=foo.com", "http://abc/def", "OBJECT", "foo.com", true, null, true);
  testMatch(test, "abc$~image,domain=foo.com", "http://abc/def", "OBJECT", "bar.com", true, null, false);
  testMatch(test, "abc$domain=foo.com,image", "http://abc/def", "IMAGE", "foo.com", true, null, true);
  testMatch(test, "abc$domain=foo.com,image", "http://abc/def", "IMAGE", "bar.com", true, null, false);
  testMatch(test, "abc$domain=foo.com,image", "http://abc/def", "OBJECT", "foo.com", true, null, false);
  testMatch(test, "abc$domain=foo.com,image", "http://abc/def", "OBJECT", "bar.com", true, null, false);
  testMatch(test, "abc$domain=foo.com,~image", "http://abc/def", "IMAGE", "foo.com", true, null, false);
  testMatch(test, "abc$domain=foo.com,~image", "http://abc/def", "IMAGE", "bar.com", true, null, false);
  testMatch(test, "abc$domain=foo.com,~image", "http://abc/def", "OBJECT", "foo.com", true, null, true);
  testMatch(test, "abc$domain=foo.com,~image", "http://abc/def", "OBJECT", "bar.com", true, null, false);

  test.done();
};

exports.testSitekeyRestrictions = function(test)
{
  testMatch(test, "abc$sitekey=foo-publickey", "http://abc/def", "IMAGE", "foo.com", true, "foo-publickey", true);
  testMatch(test, "abc$sitekey=foo-publickey", "http://abc/def", "IMAGE", "foo.com", true, null, false);
  testMatch(test, "abc$sitekey=foo-publickey", "http://abc/def", "IMAGE", "foo.com", true, "bar-publickey", false);
  testMatch(test, "abc$sitekey=foo-publickey|bar-publickey", "http://abc/def", "IMAGE", "foo.com", true, "foo-publickey", true);
  testMatch(test, "abc$sitekey=foo-publickey|bar-publickey", "http://abc/def", "IMAGE", "foo.com", true, null, false);
  testMatch(test, "abc$sitekey=bar-publickey|foo-publickey", "http://abc/def", "IMAGE", "foo.com", true, "foo-publickey", true);
  testMatch(test, "abc$sitekey=foo-publickey", "http://ccc/def", "IMAGE", "foo.com", true, "foo-publickey", false);
  testMatch(test, "abc$domain=foo.com,sitekey=foo-publickey", "http://abc/def", "IMAGE", "foo.com", true, "foo-publickey", true);
  testMatch(test, "abc$domain=foo.com,sitekey=foo-publickey", "http://abc/def", "IMAGE", "bar.com", true, "foo-publickey", false);
  testMatch(test, "abc$domain=~foo.com,sitekey=foo-publickey", "http://abc/def", "IMAGE", "foo.com", true, "foo-publickey", false);
  testMatch(test, "abc$domain=~foo.com,sitekey=foo-publickey", "http://abc/def", "IMAGE", "bar.com", true, "foo-publickey", true);

  test.done();
};

exports.testExceptionRules = function(test)
{
  testMatch(test, "@@test", "http://test/", "DOCUMENT", null, false, null, false);
  testMatch(test, "@@http://test*", "http://test/", "DOCUMENT", null, false, null, false);
  testMatch(test, "@@ftp://test*", "ftp://test/", "DOCUMENT", null, false, null, false);
  testMatch(test, "@@test$document", "http://test/", "DOCUMENT", null, false, null, true);
  testMatch(test, "@@test$document,image", "http://test/", "DOCUMENT", null, false, null, true);
  testMatch(test, "@@test$~image", "http://test/", "DOCUMENT", null, false, null, false);
  testMatch(test, "@@test$~image,document", "http://test/", "DOCUMENT", null, false, null, true);
  testMatch(test, "@@test$document,~image", "http://test/", "DOCUMENT", null, false, null, true);
  testMatch(test, "@@test$document,domain=foo.com", "http://test/", "DOCUMENT", "foo.com", false, null, true);
  testMatch(test, "@@test$document,domain=foo.com", "http://test/", "DOCUMENT", "bar.com", false, null, false);
  testMatch(test, "@@test$document,domain=~foo.com", "http://test/", "DOCUMENT", "foo.com", false, null, false);
  testMatch(test, "@@test$document,domain=~foo.com", "http://test/", "DOCUMENT", "bar.com", false, null, true);
  testMatch(test, "@@test$document,sitekey=foo-publickey", "http://test/", "DOCUMENT", "foo.com", false, "foo-publickey", true);
  testMatch(test, "@@test$document,sitekey=foo-publickey", "http://test/", "DOCUMENT", "foo.com", false, null, false);

  test.done();
};
