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
let InvalidFilter = null;
let CommentFilter = null;
let ActiveFilter = null;
let RegExpFilter = null;
let BlockingFilter = null;
let ContentFilter = null;
let WhitelistFilter = null;
let ElemHideBase = null;
let ElemHideFilter = null;
let ElemHideException = null;
let ElemHideEmulationFilter = null;
let SnippetFilter = null;

let t = null;
let defaultTypes = null;

exports.setUp = function(callback)
{
  let sandboxedRequire = createSandbox();
  (
    {Filter, InvalidFilter, CommentFilter, ActiveFilter, RegExpFilter,
     BlockingFilter, WhitelistFilter, ContentFilter, ElemHideBase,
     ElemHideFilter, ElemHideException, ElemHideEmulationFilter,
     SnippetFilter} = sandboxedRequire("../lib/filterClasses")
  );
  t = RegExpFilter.typeMap;
  defaultTypes = 0x7FFFFFFF & ~(t.CSP | t.ELEMHIDE | t.DOCUMENT | t.POPUP |
                                t.GENERICHIDE | t.GENERICBLOCK);

  callback();
};

function serializeFilter(filter)
{
  // Filter serialization only writes out essential properties, need to do a full serialization here
  let result = [];
  result.push("text=" + filter.text);
  if (filter instanceof InvalidFilter)
  {
    result.push("type=invalid");
    result.push("reason=" + filter.reason);
  }
  else if (filter instanceof CommentFilter)
    result.push("type=comment");
  else if (filter instanceof ActiveFilter)
  {
    result.push("disabled=" + filter.disabled);
    result.push("lastHit=" + filter.lastHit);
    result.push("hitCount=" + filter.hitCount);

    let domains = [];
    if (filter.domains)
    {
      for (let [domain, isIncluded] of filter.domains)
      {
        if (domain != "")
          domains.push(isIncluded ? domain : "~" + domain);
      }
    }
    result.push("domains=" + domains.sort().join("|"));

    if (filter instanceof RegExpFilter)
    {
      result.push("regexp=" + filter.regexp.source);
      result.push("contentType=" + filter.contentType);
      result.push("matchCase=" + filter.matchCase);

      let sitekeys = filter.sitekeys || [];
      result.push("sitekeys=" + sitekeys.slice().sort().join("|"));

      result.push("thirdParty=" + filter.thirdParty);
      if (filter instanceof BlockingFilter)
      {
        result.push("type=filterlist");
        result.push("collapse=" + filter.collapse);
        result.push("csp=" + filter.csp);
        result.push("rewrite=" + filter.rewrite);
      }
      else if (filter instanceof WhitelistFilter)
        result.push("type=whitelist");
    }
    else if (filter instanceof ElemHideBase)
    {
      if (filter instanceof ElemHideFilter)
        result.push("type=elemhide");
      else if (filter instanceof ElemHideException)
        result.push("type=elemhideexception");
      else if (filter instanceof ElemHideEmulationFilter)
        result.push("type=elemhideemulation");

      result.push("selectorDomains=" +
                  [...filter.domains || []]
                  .filter(([domain, isIncluded]) => isIncluded)
                  .map(([domain]) => domain.toLowerCase()));
      result.push("selector=" + filter.selector);
    }
    else if (filter instanceof SnippetFilter)
    {
      result.push("type=snippet");
      result.push("scriptDomains=" +
                  [...filter.domains || []]
                  .filter(([domain, isIncluded]) => isIncluded)
                  .map(([domain]) => domain.toLowerCase()));
      result.push("script=" + filter.script);
    }
  }
  return result;
}

function addDefaults(expected)
{
  let type = null;
  let hasProperty = {};
  for (let entry of expected)
  {
    if (/^type=(.*)/.test(entry))
      type = RegExp.$1;
    else if (/^(\w+)/.test(entry))
      hasProperty[RegExp.$1] = true;
  }

  function addProperty(prop, value)
  {
    if (!(prop in hasProperty))
      expected.push(prop + "=" + value);
  }

  if (type == "whitelist" || type == "filterlist" || type == "elemhide" ||
      type == "elemhideexception" || type == "elemhideemulation" ||
      type == "snippet")
  {
    addProperty("disabled", "false");
    addProperty("lastHit", "0");
    addProperty("hitCount", "0");
  }
  if (type == "whitelist" || type == "filterlist")
  {
    addProperty("contentType", 0x7FFFFFFF & ~(
      t.CSP | t.DOCUMENT | t.ELEMHIDE | t.POPUP | t.GENERICHIDE | t.GENERICBLOCK
    ));
    addProperty("matchCase", "false");
    addProperty("thirdParty", "null");
    addProperty("domains", "");
    addProperty("sitekeys", "");
  }
  if (type == "filterlist")
  {
    addProperty("collapse", "null");
    addProperty("csp", "null");
    addProperty("rewrite", "null");
  }
  if (type == "elemhide" || type == "elemhideexception" ||
      type == "elemhideemulation")
  {
    addProperty("selectorDomains", "");
    addProperty("domains", "");
  }
  if (type == "snippet")
  {
    addProperty("scriptDomains", "");
    addProperty("domains", "");
  }
}

function compareFilter(test, text, expected, postInit)
{
  addDefaults(expected);

  let filter = Filter.fromText(text);
  if (postInit)
    postInit(filter);
  let result = serializeFilter(filter);
  test.equal(result.sort().join("\n"), expected.sort().join("\n"), text);

  // Test round-trip
  let filter2;
  let buffer = [];
  filter.serialize(buffer);
  if (buffer.length)
  {
    let map = Object.create(null);
    for (let line of buffer.slice(1))
    {
      if (/(.*?)=(.*)/.test(line))
        map[RegExp.$1] = RegExp.$2;
    }
    filter2 = Filter.fromObject(map);
  }
  else
    filter2 = Filter.fromText(filter.text);

  test.equal(serializeFilter(filter).join("\n"), serializeFilter(filter2).join("\n"), text + " deserialization");
}

exports.testFilterClassDefinitions = function(test)
{
  test.equal(typeof Filter, "function", "typeof Filter");
  test.equal(typeof InvalidFilter, "function", "typeof InvalidFilter");
  test.equal(typeof CommentFilter, "function", "typeof CommentFilter");
  test.equal(typeof ActiveFilter, "function", "typeof ActiveFilter");
  test.equal(typeof RegExpFilter, "function", "typeof RegExpFilter");
  test.equal(typeof BlockingFilter, "function", "typeof BlockingFilter");
  test.equal(typeof ContentFilter, "function", "typeof ContentFilter");
  test.equal(typeof WhitelistFilter, "function", "typeof WhitelistFilter");
  test.equal(typeof ElemHideBase, "function", "typeof ElemHideBase");
  test.equal(typeof ElemHideFilter, "function", "typeof ElemHideFilter");
  test.equal(typeof ElemHideException, "function", "typeof ElemHideException");
  test.equal(typeof ElemHideEmulationFilter, "function",
             "typeof ElemHideEmulationFilter");
  test.equal(typeof SnippetFilter, "function", "typeof SnippetFilter");

  test.done();
};

exports.testComments = function(test)
{
  compareFilter(test, "!asdf", ["type=comment", "text=!asdf"]);
  compareFilter(test, "!foo#bar", ["type=comment", "text=!foo#bar"]);
  compareFilter(test, "!foo##bar", ["type=comment", "text=!foo##bar"]);

  test.done();
};

exports.testInvalidFilters = function(test)
{
  compareFilter(test, "/??/", ["type=invalid", "text=/??/", "reason=filter_invalid_regexp"]);
  compareFilter(test, "asd$foobar", ["type=invalid", "text=asd$foobar", "reason=filter_unknown_option"]);

  function checkElemHideEmulationFilterInvalid(domains)
  {
    let filterText = domains + "#?#:-abp-properties(abc)";
    compareFilter(
      test, filterText, [
        "type=invalid", "text=" + filterText,
        "reason=filter_elemhideemulation_nodomain"
      ]
    );
  }
  checkElemHideEmulationFilterInvalid("");
  checkElemHideEmulationFilterInvalid("~foo.com");
  checkElemHideEmulationFilterInvalid("~foo.com,~bar.com");
  checkElemHideEmulationFilterInvalid("foo");
  checkElemHideEmulationFilterInvalid("~foo.com,bar");

  test.done();
};

exports.testFiltersWithState = function(test)
{
  compareFilter(test, "blabla", ["type=filterlist", "text=blabla", "regexp=blabla"]);
  compareFilter(
    test, "blabla_default", ["type=filterlist", "text=blabla_default", "regexp=blabla_default"],
    filter =>
    {
      filter.disabled = false;
      filter.hitCount = 0;
      filter.lastHit = 0;
    }
  );
  compareFilter(
    test, "blabla_non_default",
    ["type=filterlist", "text=blabla_non_default", "regexp=blabla_non_default", "disabled=true", "hitCount=12", "lastHit=20"],
    filter =>
    {
      filter.disabled = true;
      filter.hitCount = 12;
      filter.lastHit = 20;
    }
  );

  test.done();
};

exports.testSpecialCharacters = function(test)
{
  compareFilter(test, "/ddd|f?a[s]d/", ["type=filterlist", "text=/ddd|f?a[s]d/", "regexp=ddd|f?a[s]d"]);
  compareFilter(test, "*asdf*d**dd*", ["type=filterlist", "text=*asdf*d**dd*", "regexp=asdf.*d.*dd"]);
  compareFilter(test, "|*asd|f*d**dd*|", ["type=filterlist", "text=|*asd|f*d**dd*|", "regexp=^.*asd\\|f.*d.*dd.*$"]);
  compareFilter(test, "dd[]{}$%<>&()d", ["type=filterlist", "text=dd[]{}$%<>&()d", "regexp=dd\\[\\]\\{\\}\\$\\%\\<\\>\\&\\(\\)d"]);

  // Leading and trailing wildcards should be left in for rewrite filters (#6868).
  compareFilter(test, "*asdf*d**dd*$rewrite=", ["type=filterlist", "text=*asdf*d**dd*$rewrite=", "regexp=.*asdf.*d.*dd.*", "rewrite=", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.SUBDOCUMENT | t.OBJECT | t.OBJECT_SUBREQUEST))]);

  compareFilter(test, "@@/ddd|f?a[s]d/", ["type=whitelist", "text=@@/ddd|f?a[s]d/", "regexp=ddd|f?a[s]d", "contentType=" + defaultTypes]);
  compareFilter(test, "@@*asdf*d**dd*", ["type=whitelist", "text=@@*asdf*d**dd*", "regexp=asdf.*d.*dd", "contentType=" + defaultTypes]);
  compareFilter(test, "@@|*asd|f*d**dd*|", ["type=whitelist", "text=@@|*asd|f*d**dd*|", "regexp=^.*asd\\|f.*d.*dd.*$", "contentType=" + defaultTypes]);
  compareFilter(test, "@@dd[]{}$%<>&()d", ["type=whitelist", "text=@@dd[]{}$%<>&()d", "regexp=dd\\[\\]\\{\\}\\$\\%\\<\\>\\&\\(\\)d", "contentType=" + defaultTypes]);

  test.done();
};

exports.testFilterOptions = function(test)
{
  compareFilter(test, "bla$match-case,csp=first csp,script,other,third-party,domain=FOO.cOm,sitekey=foo", ["type=filterlist", "text=bla$match-case,csp=first csp,script,other,third-party,domain=FOO.cOm,sitekey=foo", "regexp=bla", "matchCase=true", "contentType=" + (t.SCRIPT | t.OTHER | t.CSP), "thirdParty=true", "domains=foo.com", "sitekeys=FOO", "csp=first csp"]);
  compareFilter(test, "bla$~match-case,~csp=csp,~script,~other,~third-party,domain=~bAr.coM", ["type=filterlist", "text=bla$~match-case,~csp=csp,~script,~other,~third-party,domain=~bAr.coM", "regexp=bla", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.OTHER)), "thirdParty=false", "domains=~bar.com"]);
  compareFilter(test, "@@bla$match-case,script,other,third-party,domain=foo.com|bar.com|~bAR.foO.Com|~Foo.Bar.com,csp=c s p,sitekey=foo|bar", ["type=whitelist", "text=@@bla$match-case,script,other,third-party,domain=foo.com|bar.com|~bAR.foO.Com|~Foo.Bar.com,csp=c s p,sitekey=foo|bar", "regexp=bla", "matchCase=true", "contentType=" + (t.SCRIPT | t.OTHER | t.CSP), "thirdParty=true", "domains=bar.com|foo.com|~bar.foo.com|~foo.bar.com", "sitekeys=BAR|FOO"]);
  compareFilter(test, "@@bla$match-case,script,other,third-party,domain=foo.com|bar.com|~bar.foo.com|~foo.bar.com,sitekey=foo|bar", ["type=whitelist", "text=@@bla$match-case,script,other,third-party,domain=foo.com|bar.com|~bar.foo.com|~foo.bar.com,sitekey=foo|bar", "regexp=bla", "matchCase=true", "contentType=" + (t.SCRIPT | t.OTHER), "thirdParty=true", "domains=bar.com|foo.com|~bar.foo.com|~foo.bar.com", "sitekeys=BAR|FOO"]);
  compareFilter(test, "||content.server.com/files/*.php$rewrite=$1", ["type=filterlist", "text=||content.server.com/files/*.php$rewrite=$1", "regexp=^[\\w\\-]+:\\/+(?!\\/)(?:[^\\/]+\\.)?content\\.server\\.com\\/files\\/.*\\.php", "matchCase=false", "rewrite=$1", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.SUBDOCUMENT | t.OBJECT | t.OBJECT_SUBREQUEST))]);

  // background and image should be the same for backwards compatibility
  compareFilter(test, "bla$image", ["type=filterlist", "text=bla$image", "regexp=bla", "contentType=" + (t.IMAGE)]);
  compareFilter(test, "bla$background", ["type=filterlist", "text=bla$background", "regexp=bla", "contentType=" + (t.IMAGE)]);
  compareFilter(test, "bla$~image", ["type=filterlist", "text=bla$~image", "regexp=bla", "contentType=" + (defaultTypes & ~t.IMAGE)]);
  compareFilter(test, "bla$~background", ["type=filterlist", "text=bla$~background", "regexp=bla", "contentType=" + (defaultTypes & ~t.IMAGE)]);

  compareFilter(test, "@@bla$~script,~other", ["type=whitelist", "text=@@bla$~script,~other", "regexp=bla", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.OTHER))]);
  compareFilter(test, "@@http://bla$~script,~other", ["type=whitelist", "text=@@http://bla$~script,~other", "regexp=http\\:\\/\\/bla", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.OTHER))]);
  compareFilter(test, "@@|ftp://bla$~script,~other", ["type=whitelist", "text=@@|ftp://bla$~script,~other", "regexp=^ftp\\:\\/\\/bla", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.OTHER))]);
  compareFilter(test, "@@bla$~script,~other,document", ["type=whitelist", "text=@@bla$~script,~other,document", "regexp=bla", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.OTHER) | t.DOCUMENT)]);
  compareFilter(test, "@@bla$~script,~other,~document", ["type=whitelist", "text=@@bla$~script,~other,~document", "regexp=bla", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.OTHER))]);
  compareFilter(test, "@@bla$document", ["type=whitelist", "text=@@bla$document", "regexp=bla", "contentType=" + t.DOCUMENT]);
  compareFilter(test, "@@bla$~script,~other,elemhide", ["type=whitelist", "text=@@bla$~script,~other,elemhide", "regexp=bla", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.OTHER) | t.ELEMHIDE)]);
  compareFilter(test, "@@bla$~script,~other,~elemhide", ["type=whitelist", "text=@@bla$~script,~other,~elemhide", "regexp=bla", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.OTHER))]);
  compareFilter(test, "@@bla$elemhide", ["type=whitelist", "text=@@bla$elemhide", "regexp=bla", "contentType=" + t.ELEMHIDE]);

  compareFilter(test, "@@bla$~script,~other,donottrack", ["type=invalid", "text=@@bla$~script,~other,donottrack", "reason=filter_unknown_option"]);
  compareFilter(test, "@@bla$~script,~other,~donottrack", ["type=invalid", "text=@@bla$~script,~other,~donottrack", "reason=filter_unknown_option"]);
  compareFilter(test, "@@bla$donottrack", ["type=invalid", "text=@@bla$donottrack", "reason=filter_unknown_option"]);
  compareFilter(test, "@@bla$foobar", ["type=invalid", "text=@@bla$foobar", "reason=filter_unknown_option"]);
  compareFilter(test, "@@bla$image,foobar", ["type=invalid", "text=@@bla$image,foobar", "reason=filter_unknown_option"]);
  compareFilter(test, "@@bla$foobar,image", ["type=invalid", "text=@@bla$foobar,image", "reason=filter_unknown_option"]);

  compareFilter(test, "bla$csp", ["type=invalid", "text=bla$csp", "reason=filter_invalid_csp"]);
  compareFilter(test, "bla$csp=", ["type=invalid", "text=bla$csp=", "reason=filter_invalid_csp"]);

  // Blank CSP values are allowed for whitelist filters.
  compareFilter(test, "@@bla$csp", ["type=whitelist", "text=@@bla$csp", "regexp=bla", "contentType=" + t.CSP]);
  compareFilter(test, "@@bla$csp=", ["type=whitelist", "text=@@bla$csp=", "regexp=bla", "contentType=" + t.CSP]);

  compareFilter(test, "bla$csp=report-uri", ["type=invalid", "text=bla$csp=report-uri", "reason=filter_invalid_csp"]);
  compareFilter(test, "bla$csp=foo,csp=report-to", ["type=invalid", "text=bla$csp=foo,csp=report-to", "reason=filter_invalid_csp"]);
  compareFilter(test, "bla$csp=foo,csp=referrer foo", ["type=invalid", "text=bla$csp=foo,csp=referrer foo", "reason=filter_invalid_csp"]);
  compareFilter(test, "bla$csp=foo,csp=base-uri", ["type=invalid", "text=bla$csp=foo,csp=base-uri", "reason=filter_invalid_csp"]);
  compareFilter(test, "bla$csp=foo,csp=upgrade-insecure-requests", ["type=invalid", "text=bla$csp=foo,csp=upgrade-insecure-requests", "reason=filter_invalid_csp"]);
  compareFilter(test, "bla$csp=foo,csp=ReFeRReR", ["type=invalid", "text=bla$csp=foo,csp=ReFeRReR", "reason=filter_invalid_csp"]);

  test.done();
};

exports.testElementHidingRules = function(test)
{
  compareFilter(test, "##ddd", ["type=elemhide", "text=##ddd", "selector=ddd"]);
  compareFilter(test, "##body > div:first-child", ["type=elemhide", "text=##body > div:first-child", "selector=body > div:first-child"]);
  compareFilter(test, "fOO##ddd", ["type=elemhide", "text=fOO##ddd", "selectorDomains=foo", "selector=ddd", "domains=foo"]);
  compareFilter(test, "Foo,bAr##ddd", ["type=elemhide", "text=Foo,bAr##ddd", "selectorDomains=foo,bar", "selector=ddd", "domains=bar|foo"]);
  compareFilter(test, "foo,~baR##ddd", ["type=elemhide", "text=foo,~baR##ddd", "selectorDomains=foo", "selector=ddd", "domains=foo|~bar"]);
  compareFilter(test, "foo,~baz,bar##ddd", ["type=elemhide", "text=foo,~baz,bar##ddd", "selectorDomains=foo,bar", "selector=ddd", "domains=bar|foo|~baz"]);

  test.done();
};

exports.testElementHidingExceptions = function(test)
{
  compareFilter(test, "#@#ddd", ["type=elemhideexception", "text=#@#ddd", "selector=ddd"]);
  compareFilter(test, "#@#body > div:first-child", ["type=elemhideexception", "text=#@#body > div:first-child", "selector=body > div:first-child"]);
  compareFilter(test, "fOO#@#ddd", ["type=elemhideexception", "text=fOO#@#ddd", "selectorDomains=foo", "selector=ddd", "domains=foo"]);
  compareFilter(test, "Foo,bAr#@#ddd", ["type=elemhideexception", "text=Foo,bAr#@#ddd", "selectorDomains=foo,bar", "selector=ddd", "domains=bar|foo"]);
  compareFilter(test, "foo,~baR#@#ddd", ["type=elemhideexception", "text=foo,~baR#@#ddd", "selectorDomains=foo", "selector=ddd", "domains=foo|~bar"]);
  compareFilter(test, "foo,~baz,bar#@#ddd", ["type=elemhideexception", "text=foo,~baz,bar#@#ddd", "selectorDomains=foo,bar", "selector=ddd", "domains=bar|foo|~baz"]);

  test.done();
};

exports.testElemHideEmulationFilters = function(test)
{
  // Check valid domain combinations
  compareFilter(test, "fOO.cOm#?#:-abp-properties(abc)", ["type=elemhideemulation", "text=fOO.cOm#?#:-abp-properties(abc)", "selectorDomains=foo.com", "selector=:-abp-properties(abc)", "domains=foo.com"]);
  compareFilter(test, "Foo.com,~bAr.com#?#:-abp-properties(abc)", ["type=elemhideemulation", "text=Foo.com,~bAr.com#?#:-abp-properties(abc)", "selectorDomains=foo.com", "selector=:-abp-properties(abc)", "domains=foo.com|~bar.com"]);
  compareFilter(test, "foo.com,~baR#?#:-abp-properties(abc)", ["type=elemhideemulation", "text=foo.com,~baR#?#:-abp-properties(abc)", "selectorDomains=foo.com", "selector=:-abp-properties(abc)", "domains=foo.com|~bar"]);
  compareFilter(test, "~foo.com,bar.com#?#:-abp-properties(abc)", ["type=elemhideemulation", "text=~foo.com,bar.com#?#:-abp-properties(abc)", "selectorDomains=bar.com", "selector=:-abp-properties(abc)", "domains=bar.com|~foo.com"]);

  // Check some special cases
  compareFilter(test, "#?#:-abp-properties(abc)", ["type=invalid", "text=#?#:-abp-properties(abc)", "reason=filter_elemhideemulation_nodomain"]);
  compareFilter(test, "foo.com#?#abc", ["type=elemhideemulation", "text=foo.com#?#abc", "selectorDomains=foo.com", "selector=abc", "domains=foo.com"]);
  compareFilter(test, "foo.com#?#:-abp-foobar(abc)", ["type=elemhideemulation", "text=foo.com#?#:-abp-foobar(abc)", "selectorDomains=foo.com", "selector=:-abp-foobar(abc)", "domains=foo.com"]);
  compareFilter(test, "foo.com#?#aaa :-abp-properties(abc) bbb", ["type=elemhideemulation", "text=foo.com#?#aaa :-abp-properties(abc) bbb", "selectorDomains=foo.com", "selector=aaa :-abp-properties(abc) bbb", "domains=foo.com"]);
  compareFilter(test, "foo.com#?#:-abp-properties(|background-image: url(data:*))", ["type=elemhideemulation", "text=foo.com#?#:-abp-properties(|background-image: url(data:*))", "selectorDomains=foo.com", "selector=:-abp-properties(|background-image: url(data:*))", "domains=foo.com"]);

  // Support element hiding emulation filters for localhost (#6931).
  compareFilter(test, "localhost#?#:-abp-properties(abc)", ["type=elemhideemulation", "text=localhost#?#:-abp-properties(abc)", "selectorDomains=localhost", "selector=:-abp-properties(abc)", "domains=localhost"]);
  compareFilter(test, "localhost,~www.localhost#?#:-abp-properties(abc)", ["type=elemhideemulation", "text=localhost,~www.localhost#?#:-abp-properties(abc)", "selectorDomains=localhost", "selector=:-abp-properties(abc)", "domains=localhost|~www.localhost"]);
  compareFilter(test, "~www.localhost,localhost#?#:-abp-properties(abc)", ["type=elemhideemulation", "text=~www.localhost,localhost#?#:-abp-properties(abc)", "selectorDomains=localhost", "selector=:-abp-properties(abc)", "domains=localhost|~www.localhost"]);

  test.done();
};

exports.testEmptyElemHideDomains = function(test)
{
  let emptyDomainFilters = [
    ",##selector", ",,,##selector", "~,foo.com##selector", "foo.com,##selector",
    ",foo.com##selector", "foo.com,~##selector",
    "foo.com,,bar.com##selector", "foo.com,~,bar.com##selector"
  ];

  for (let filterText of emptyDomainFilters)
  {
    let filter = Filter.fromText(filterText);
    test.ok(filter instanceof InvalidFilter);
    test.equal(filter.reason, "filter_invalid_domain");
  }

  test.done();
};

exports.testElemHideRulesWithBraces = function(test)
{
  compareFilter(
    test, "###foo{color: red}", [
      "type=elemhide",
      "text=###foo{color: red}",
      "selectorDomains=",
      "selector=#foo\\7B color: red\\7D ",
      "domains="
    ]
  );
  compareFilter(
    test, "foo.com#?#:-abp-properties(/margin: [3-4]{2}/)", [
      "type=elemhideemulation",
      "text=foo.com#?#:-abp-properties(/margin: [3-4]{2}/)",
      "selectorDomains=foo.com",
      "selector=:-abp-properties(/margin: [3-4]\\7B 2\\7D /)",
      "domains=foo.com"
    ]
  );
  test.done();
};

exports.testSnippetFilters = function(test)
{
  compareFilter(test, "foo.com#$#abc", ["type=snippet", "text=foo.com#$#abc", "scriptDomains=foo.com", "script=abc", "domains=foo.com"]);
  compareFilter(test, "foo.com,~bar.com#$#abc", ["type=snippet", "text=foo.com,~bar.com#$#abc", "scriptDomains=foo.com", "script=abc", "domains=foo.com|~bar.com"]);
  compareFilter(test, "foo.com,~bar#$#abc", ["type=snippet", "text=foo.com,~bar#$#abc", "scriptDomains=foo.com", "script=abc", "domains=foo.com|~bar"]);
  compareFilter(test, "~foo.com,bar.com#$#abc", ["type=snippet", "text=~foo.com,bar.com#$#abc", "scriptDomains=bar.com", "script=abc", "domains=bar.com|~foo.com"]);

  test.done();
};

exports.testFilterNormalization = function(test)
{
  // Line breaks etc
  test.equal(Filter.normalize("\n\t\nad\ns"),
             "ads");

  // Comment filters
  test.equal(Filter.normalize("   !  fo  o##  bar   "),
             "!  fo  o##  bar");

  // Element hiding filters
  test.equal(Filter.normalize("   domain.c  om## # sele ctor   "),
             "domain.com### sele ctor");

  // Element hiding emulation filters
  test.equal(Filter.normalize("   domain.c  om#?# # sele ctor   "),
             "domain.com#?## sele ctor");

  // Incorrect syntax: the separator "#?#" cannot contain spaces; treated as a
  // regular filter instead
  test.equal(Filter.normalize("   domain.c  om# ?#. sele ctor   "),
             "domain.com#?#.selector");
  // Incorrect syntax: the separator "#?#" cannot contain spaces; treated as an
  // element hiding filter instead, because the "##" following the "?" is taken
  // to be the separator instead
  test.equal(Filter.normalize("   domain.c  om# ?##sele ctor   "),
             "domain.com#?##sele ctor");

  // Element hiding exception filters
  test.equal(Filter.normalize("   domain.c  om#@# # sele ctor   "),
             "domain.com#@## sele ctor");

  // Incorrect syntax: the separator "#@#" cannot contain spaces; treated as a
  // regular filter instead (not an element hiding filter either!), because
  // unlike the case with "# ?##" the "##" following the "@" is not considered
  // to be a separator
  test.equal(Filter.normalize("   domain.c  om# @## sele ctor   "),
             "domain.com#@##selector");

  // Snippet filters
  test.equal(Filter.normalize("   domain.c  om#$#  sni pp  et   "),
             "domain.com#$#sni pp  et");

  // Regular filters
  let normalized = Filter.normalize(
    "    b$l 	 a$sitekey=  foo  ,domain= do main.com |foo   .com,c sp= c   s p  "
  );
  test.equal(
    normalized,
    "b$la$sitekey=foo,domain=domain.com|foo.com,csp=c s p"
  );
  compareFilter(
    test, normalized, [
      "type=filterlist",
      "text=" + normalized,
      "csp=c s p",
      "domains=domain.com|foo.com",
      "sitekeys=FOO",
      "regexp=b\\$la",
      "contentType=" + t.CSP
    ]
  );

  // Some $csp edge cases
  test.equal(Filter.normalize("$csp=  "),
             "$csp=");
  test.equal(Filter.normalize("$csp= c s p"),
             "$csp=c s p");
  test.equal(Filter.normalize("$$csp= c s p"),
             "$$csp=c s p");
  test.equal(Filter.normalize("$$$csp= c s p"),
             "$$$csp=c s p");
  test.equal(Filter.normalize("foo?csp=b a r$csp=script-src  'self'"),
             "foo?csp=bar$csp=script-src 'self'");
  test.equal(Filter.normalize("foo$bar=c s p = ba z,cs p = script-src  'self'"),
             "foo$bar=csp=baz,csp=script-src 'self'");
  test.equal(Filter.normalize("foo$csp=c s p csp= ba z,cs p  = script-src  'self'"),
             "foo$csp=c s p csp= ba z,csp=script-src 'self'");
  test.equal(Filter.normalize("foo$csp=bar,$c sp=c s p"),
             "foo$csp=bar,$csp=c s p");
  test.equal(Filter.normalize(" f o   o   $      bar   $csp=ba r"),
             "foo$bar$csp=ba r");
  test.equal(Filter.normalize("f    $    o    $    o    $    csp=f o o "),
             "f$o$o$csp=f o o");
  test.equal(Filter.normalize("/foo$/$ csp = script-src  http://example.com/?$1=1&$2=2&$3=3"),
             "/foo$/$csp=script-src http://example.com/?$1=1&$2=2&$3=3");
  test.equal(Filter.normalize("||content.server.com/files/*.php$rewrite= $1"),
             "||content.server.com/files/*.php$rewrite=$1");
  test.done();
};

exports.testFilterRewriteOption = function(test)
{
  let text = "/(content\\.server\\/file\\/.*\\.txt)\\?.*$/$rewrite=$1";

  let filter = Filter.fromText(text);

  test.equal(filter.rewrite, "$1");
  // no rewrite occured: didn't match.
  test.equal(filter.rewriteUrl("foo"), "foo");
  // rewrite occured: matched.
  test.equal(filter.rewriteUrl("http://content.server/file/foo.txt?bar"),
             "http://content.server/file/foo.txt");

  // checking for same origin.
  let rewriteDiffOrigin =
      "/content\\.server(\\/file\\/.*\\.txt)\\?.*$/$rewrite=foo.com$1";
  let filterDiffOrigin = Filter.fromText(rewriteDiffOrigin);

  // no rewrite occured because of a different origin.
  test.equal(
    filterDiffOrigin.rewriteUrl("http://content.server/file/foo.txt?bar"),
    "http://content.server/file/foo.txt?bar"
  );

  // relative path.
  let rewriteRelative = "/(\\/file\\/.*\\.txt)\\?.*$/$rewrite=$1/disable";
  let filterRelative = Filter.fromText(rewriteRelative);

  test.equal(
    filterRelative.rewriteUrl("http://content.server/file/foo.txt?bar"),
    "http://content.server/file/foo.txt/disable"
  );
  test.equal(
    filterRelative.rewriteUrl("http://example.com/file/foo.txt?bar"),
    "http://example.com/file/foo.txt/disable"
  );

  // Example from https://github.com/uBlockOrigin/uBlock-issues/issues/46#issuecomment-391190533
  // The rewrite shouldn't happen.
  let rewriteEvil = "/(^https?:\\/\\/[^/])/$script,rewrite=$1.evil.com";
  let filterEvil = Filter.fromText(rewriteEvil);

  test.equal(
    filterEvil.rewriteUrl("https://www.adblockplus.org/script.js"),
    "https://www.adblockplus.org/script.js"
  );

  // Strip.
  let rewriteStrip = "tag$rewrite=";
  let filterStrip = Filter.fromText(rewriteStrip);

  test.equal(filterStrip.rewrite, "");
  test.equal(
    filterStrip.rewriteUrl("http://example.com/?tag"),
    "http://example.com/?"
  );

  test.done();
};

exports.testDomainMapDeduplication = function(test)
{
  let filter1 = Filter.fromText("example.com##.foo");
  let filter2 = Filter.fromText("example.com##.bar");

  // This compares the references to make sure that both refer to the same
  // object (#6815).
  test.equal(filter1.domains, filter2.domains);

  let filter3 = Filter.fromText("www.example.com##.bar");

  test.notEqual(filter2.domains, filter3.domains);

  test.done();
};
