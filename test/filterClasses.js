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
      result.push("regexp=" + (filter.regexp ? filter.regexp.source : null));
      result.push("contentType=" + filter.contentType);
      result.push("matchCase=" + filter.matchCase);

      let sitekeys = filter.sitekeys || [];
      result.push("sitekeys=" + sitekeys.slice().sort().join("|"));

      result.push("thirdParty=" + filter.thirdParty);
      if (filter instanceof BlockingFilter)
      {
        result.push("type=filterlist");
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
    addProperty("regexp", "null");
    addProperty("matchCase", "false");
    addProperty("thirdParty", "null");
    addProperty("domains", "");
    addProperty("sitekeys", "");
  }
  if (type == "filterlist")
  {
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

function compareFilter(text, expected, postInit)
{
  addDefaults(expected);

  let filter = Filter.fromText(text);
  if (postInit)
    postInit(filter);
  let result = serializeFilter(filter);
  assert.equal(result.sort().join("\n"), expected.sort().join("\n"), text);

  // Test round-trip
  let filter2;
  let buffer = [...filter.serialize()];
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

  assert.equal(serializeFilter(filter).join("\n"), serializeFilter(filter2).join("\n"), text + " deserialization");
}

exports.testFilterClassDefinitions = function(test)
{
  assert.equal(typeof Filter, "function", "typeof Filter");
  assert.equal(typeof InvalidFilter, "function", "typeof InvalidFilter");
  assert.equal(typeof CommentFilter, "function", "typeof CommentFilter");
  assert.equal(typeof ActiveFilter, "function", "typeof ActiveFilter");
  assert.equal(typeof RegExpFilter, "function", "typeof RegExpFilter");
  assert.equal(typeof BlockingFilter, "function", "typeof BlockingFilter");
  assert.equal(typeof ContentFilter, "function", "typeof ContentFilter");
  assert.equal(typeof WhitelistFilter, "function", "typeof WhitelistFilter");
  assert.equal(typeof ElemHideBase, "function", "typeof ElemHideBase");
  assert.equal(typeof ElemHideFilter, "function", "typeof ElemHideFilter");
  assert.equal(typeof ElemHideException, "function", "typeof ElemHideException");
  assert.equal(typeof ElemHideEmulationFilter, "function",
               "typeof ElemHideEmulationFilter");
  assert.equal(typeof SnippetFilter, "function", "typeof SnippetFilter");

  test.done();
};

exports.testComments = function(test)
{
  compareFilter("!asdf", ["type=comment", "text=!asdf"]);
  compareFilter("!foo#bar", ["type=comment", "text=!foo#bar"]);
  compareFilter("!foo##bar", ["type=comment", "text=!foo##bar"]);

  test.done();
};

exports.testInvalidFilters = function(test)
{
  compareFilter("/??/", ["type=invalid", "text=/??/", "reason=filter_invalid_regexp"]);
  compareFilter("asd$foobar", ["type=invalid", "text=asd$foobar", "reason=filter_unknown_option"]);

  // No $domain or $~third-party
  compareFilter("||example.com/ad.js$rewrite=abp-resource:noopjs", ["type=invalid", "text=||example.com/ad.js$rewrite=abp-resource:noopjs", "reason=filter_invalid_rewrite"]);
  compareFilter("*example.com/ad.js$rewrite=abp-resource:noopjs", ["type=invalid", "text=*example.com/ad.js$rewrite=abp-resource:noopjs", "reason=filter_invalid_rewrite"]);
  compareFilter("example.com/ad.js$rewrite=abp-resource:noopjs", ["type=invalid", "text=example.com/ad.js$rewrite=abp-resource:noopjs", "reason=filter_invalid_rewrite"]);
  // Patterns not starting with || or *
  compareFilter("example.com/ad.js$rewrite=abp-resource:noopjs,domain=foo.com", ["type=invalid", "text=example.com/ad.js$rewrite=abp-resource:noopjs,domain=foo.com", "reason=filter_invalid_rewrite"]);
  compareFilter("example.com/ad.js$rewrite=abp-resource:noopjs,~third-party", ["type=invalid", "text=example.com/ad.js$rewrite=abp-resource:noopjs,~third-party", "reason=filter_invalid_rewrite"]);
  // $~third-party requires ||
  compareFilter("*example.com/ad.js$rewrite=abp-resource:noopjs,~third-party", ["type=invalid", "text=*example.com/ad.js$rewrite=abp-resource:noopjs,~third-party", "reason=filter_invalid_rewrite"]);

  function checkElemHideEmulationFilterInvalid(domains)
  {
    let filterText = domains + "#?#:-abp-properties(abc)";
    compareFilter(
      filterText, [
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
  compareFilter("blabla", ["type=filterlist", "text=blabla"]);
  compareFilter(
    "blabla_default", ["type=filterlist", "text=blabla_default"],
    filter =>
    {
      filter.disabled = false;
      filter.hitCount = 0;
      filter.lastHit = 0;
    }
  );
  compareFilter(
    "blabla_non_default",
    ["type=filterlist", "text=blabla_non_default", "disabled=true", "hitCount=12", "lastHit=20"],
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
  compareFilter("/ddd|f?a[s]d/", ["type=filterlist", "text=/ddd|f?a[s]d/", "regexp=ddd|f?a[s]d"]);
  compareFilter("*asdf*d**dd*", ["type=filterlist", "text=*asdf*d**dd*", "regexp=asdf.*d.*dd"]);
  compareFilter("|*asd|f*d**dd*|", ["type=filterlist", "text=|*asd|f*d**dd*|", "regexp=^.*asd\\|f.*d.*dd.*$"]);
  compareFilter("dd[]{}$%<>&()*d", ["type=filterlist", "text=dd[]{}$%<>&()*d", "regexp=dd\\[\\]\\{\\}\\$\\%\\<\\>\\&\\(\\).*d"]);

  compareFilter("@@/ddd|f?a[s]d/", ["type=whitelist", "text=@@/ddd|f?a[s]d/", "regexp=ddd|f?a[s]d", "contentType=" + defaultTypes]);
  compareFilter("@@*asdf*d**dd*", ["type=whitelist", "text=@@*asdf*d**dd*", "regexp=asdf.*d.*dd", "contentType=" + defaultTypes]);
  compareFilter("@@|*asd|f*d**dd*|", ["type=whitelist", "text=@@|*asd|f*d**dd*|", "regexp=^.*asd\\|f.*d.*dd.*$", "contentType=" + defaultTypes]);
  compareFilter("@@dd[]{}$%<>&()*d", ["type=whitelist", "text=@@dd[]{}$%<>&()*d", "regexp=dd\\[\\]\\{\\}\\$\\%\\<\\>\\&\\(\\).*d", "contentType=" + defaultTypes]);

  test.done();
};

exports.testFilterOptions = function(test)
{
  compareFilter("bla$match-case,csp=first csp,script,other,third-party,domain=FOO.cOm,sitekey=foo", ["type=filterlist", "text=bla$match-case,csp=first csp,script,other,third-party,domain=FOO.cOm,sitekey=foo", "matchCase=true", "contentType=" + (t.SCRIPT | t.OTHER | t.CSP), "thirdParty=true", "domains=foo.com", "sitekeys=FOO", "csp=first csp"]);
  compareFilter("bla$~match-case,~csp=csp,~script,~other,~third-party,domain=~bAr.coM", ["type=filterlist", "text=bla$~match-case,~csp=csp,~script,~other,~third-party,domain=~bAr.coM", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.OTHER)), "thirdParty=false", "domains=~bar.com"]);
  compareFilter("@@bla$match-case,script,other,third-party,domain=foo.com|bar.com|~bAR.foO.Com|~Foo.Bar.com,csp=c s p,sitekey=foo|bar", ["type=whitelist", "text=@@bla$match-case,script,other,third-party,domain=foo.com|bar.com|~bAR.foO.Com|~Foo.Bar.com,csp=c s p,sitekey=foo|bar", "matchCase=true", "contentType=" + (t.SCRIPT | t.OTHER | t.CSP), "thirdParty=true", "domains=bar.com|foo.com|~bar.foo.com|~foo.bar.com", "sitekeys=BAR|FOO"]);
  compareFilter("@@bla$match-case,script,other,third-party,domain=foo.com|bar.com|~bar.foo.com|~foo.bar.com,sitekey=foo|bar", ["type=whitelist", "text=@@bla$match-case,script,other,third-party,domain=foo.com|bar.com|~bar.foo.com|~foo.bar.com,sitekey=foo|bar", "matchCase=true", "contentType=" + (t.SCRIPT | t.OTHER), "thirdParty=true", "domains=bar.com|foo.com|~bar.foo.com|~foo.bar.com", "sitekeys=BAR|FOO"]);

  compareFilter("||example.com/ad.js$rewrite=abp-resource:noopjs,domain=foo.com|bar.com", ["type=filterlist", "text=||example.com/ad.js$rewrite=abp-resource:noopjs,domain=foo.com|bar.com", "regexp=null", "matchCase=false", "rewrite=noopjs", "contentType=" + (defaultTypes), "domains=bar.com|foo.com"]);
  compareFilter("*example.com/ad.js$rewrite=abp-resource:noopjs,domain=foo.com|bar.com", ["type=filterlist", "text=*example.com/ad.js$rewrite=abp-resource:noopjs,domain=foo.com|bar.com", "regexp=null", "matchCase=false", "rewrite=noopjs", "contentType=" + (defaultTypes), "domains=bar.com|foo.com"]);
  compareFilter("||example.com/ad.js$rewrite=abp-resource:noopjs,~third-party", ["type=filterlist", "text=||example.com/ad.js$rewrite=abp-resource:noopjs,~third-party", "regexp=null", "matchCase=false", "rewrite=noopjs", "thirdParty=false", "contentType=" + (defaultTypes)]);
  compareFilter("||content.server.com/files/*.php$rewrite=$1", ["type=invalid", "reason=filter_invalid_rewrite", "text=||content.server.com/files/*.php$rewrite=$1"]);
  compareFilter("||content.server.com/files/*.php$rewrite=", ["type=invalid", "reason=filter_invalid_rewrite", "text=||content.server.com/files/*.php$rewrite="]);

  // background and image should be the same for backwards compatibility
  compareFilter("bla$image", ["type=filterlist", "text=bla$image", "contentType=" + (t.IMAGE)]);
  compareFilter("bla$background", ["type=filterlist", "text=bla$background", "contentType=" + (t.IMAGE)]);
  compareFilter("bla$~image", ["type=filterlist", "text=bla$~image", "contentType=" + (defaultTypes & ~t.IMAGE)]);
  compareFilter("bla$~background", ["type=filterlist", "text=bla$~background", "contentType=" + (defaultTypes & ~t.IMAGE)]);

  compareFilter("@@bla$~script,~other", ["type=whitelist", "text=@@bla$~script,~other", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.OTHER))]);
  compareFilter("@@http://bla$~script,~other", ["type=whitelist", "text=@@http://bla$~script,~other", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.OTHER))]);
  compareFilter("@@ftp://bla$~script,~other", ["type=whitelist", "text=@@ftp://bla$~script,~other", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.OTHER))]);
  compareFilter("@@bla$~script,~other,document", ["type=whitelist", "text=@@bla$~script,~other,document", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.OTHER) | t.DOCUMENT)]);
  compareFilter("@@bla$~script,~other,~document", ["type=whitelist", "text=@@bla$~script,~other,~document", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.OTHER))]);
  compareFilter("@@bla$document", ["type=whitelist", "text=@@bla$document", "contentType=" + t.DOCUMENT]);
  compareFilter("@@bla$~script,~other,elemhide", ["type=whitelist", "text=@@bla$~script,~other,elemhide", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.OTHER) | t.ELEMHIDE)]);
  compareFilter("@@bla$~script,~other,~elemhide", ["type=whitelist", "text=@@bla$~script,~other,~elemhide", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.OTHER))]);
  compareFilter("@@bla$elemhide", ["type=whitelist", "text=@@bla$elemhide", "contentType=" + t.ELEMHIDE]);

  compareFilter("@@bla$~script,~other,donottrack", ["type=invalid", "text=@@bla$~script,~other,donottrack", "reason=filter_unknown_option"]);
  compareFilter("@@bla$~script,~other,~donottrack", ["type=invalid", "text=@@bla$~script,~other,~donottrack", "reason=filter_unknown_option"]);
  compareFilter("@@bla$donottrack", ["type=invalid", "text=@@bla$donottrack", "reason=filter_unknown_option"]);
  compareFilter("@@bla$foobar", ["type=invalid", "text=@@bla$foobar", "reason=filter_unknown_option"]);
  compareFilter("@@bla$image,foobar", ["type=invalid", "text=@@bla$image,foobar", "reason=filter_unknown_option"]);
  compareFilter("@@bla$foobar,image", ["type=invalid", "text=@@bla$foobar,image", "reason=filter_unknown_option"]);

  compareFilter("bla$csp", ["type=invalid", "text=bla$csp", "reason=filter_invalid_csp"]);
  compareFilter("bla$csp=", ["type=invalid", "text=bla$csp=", "reason=filter_invalid_csp"]);

  // Blank CSP values are allowed for whitelist filters.
  compareFilter("@@bla$csp", ["type=whitelist", "text=@@bla$csp", "contentType=" + t.CSP]);
  compareFilter("@@bla$csp=", ["type=whitelist", "text=@@bla$csp=", "contentType=" + t.CSP]);

  compareFilter("bla$csp=report-uri", ["type=invalid", "text=bla$csp=report-uri", "reason=filter_invalid_csp"]);
  compareFilter("bla$csp=foo,csp=report-to", ["type=invalid", "text=bla$csp=foo,csp=report-to", "reason=filter_invalid_csp"]);
  compareFilter("bla$csp=foo,csp=referrer foo", ["type=invalid", "text=bla$csp=foo,csp=referrer foo", "reason=filter_invalid_csp"]);
  compareFilter("bla$csp=foo,csp=base-uri", ["type=invalid", "text=bla$csp=foo,csp=base-uri", "reason=filter_invalid_csp"]);
  compareFilter("bla$csp=foo,csp=upgrade-insecure-requests", ["type=invalid", "text=bla$csp=foo,csp=upgrade-insecure-requests", "reason=filter_invalid_csp"]);
  compareFilter("bla$csp=foo,csp=ReFeRReR", ["type=invalid", "text=bla$csp=foo,csp=ReFeRReR", "reason=filter_invalid_csp"]);

  test.done();
};

exports.testElementHidingRules = function(test)
{
  compareFilter("##ddd", ["type=elemhide", "text=##ddd", "selector=ddd"]);
  compareFilter("##body > div:first-child", ["type=elemhide", "text=##body > div:first-child", "selector=body > div:first-child"]);
  compareFilter("fOO##ddd", ["type=elemhide", "text=fOO##ddd", "selectorDomains=foo", "selector=ddd", "domains=foo"]);
  compareFilter("Foo,bAr##ddd", ["type=elemhide", "text=Foo,bAr##ddd", "selectorDomains=foo,bar", "selector=ddd", "domains=bar|foo"]);
  compareFilter("foo,~baR##ddd", ["type=elemhide", "text=foo,~baR##ddd", "selectorDomains=foo", "selector=ddd", "domains=foo|~bar"]);
  compareFilter("foo,~baz,bar##ddd", ["type=elemhide", "text=foo,~baz,bar##ddd", "selectorDomains=foo,bar", "selector=ddd", "domains=bar|foo|~baz"]);

  test.done();
};

exports.testElementHidingExceptions = function(test)
{
  compareFilter("#@#ddd", ["type=elemhideexception", "text=#@#ddd", "selector=ddd"]);
  compareFilter("#@#body > div:first-child", ["type=elemhideexception", "text=#@#body > div:first-child", "selector=body > div:first-child"]);
  compareFilter("fOO#@#ddd", ["type=elemhideexception", "text=fOO#@#ddd", "selectorDomains=foo", "selector=ddd", "domains=foo"]);
  compareFilter("Foo,bAr#@#ddd", ["type=elemhideexception", "text=Foo,bAr#@#ddd", "selectorDomains=foo,bar", "selector=ddd", "domains=bar|foo"]);
  compareFilter("foo,~baR#@#ddd", ["type=elemhideexception", "text=foo,~baR#@#ddd", "selectorDomains=foo", "selector=ddd", "domains=foo|~bar"]);
  compareFilter("foo,~baz,bar#@#ddd", ["type=elemhideexception", "text=foo,~baz,bar#@#ddd", "selectorDomains=foo,bar", "selector=ddd", "domains=bar|foo|~baz"]);

  test.done();
};

exports.testElemHideEmulationFilters = function(test)
{
  // Check valid domain combinations
  compareFilter("fOO.cOm#?#:-abp-properties(abc)", ["type=elemhideemulation", "text=fOO.cOm#?#:-abp-properties(abc)", "selectorDomains=foo.com", "selector=:-abp-properties(abc)", "domains=foo.com"]);
  compareFilter("Foo.com,~bAr.com#?#:-abp-properties(abc)", ["type=elemhideemulation", "text=Foo.com,~bAr.com#?#:-abp-properties(abc)", "selectorDomains=foo.com", "selector=:-abp-properties(abc)", "domains=foo.com|~bar.com"]);
  compareFilter("foo.com,~baR#?#:-abp-properties(abc)", ["type=elemhideemulation", "text=foo.com,~baR#?#:-abp-properties(abc)", "selectorDomains=foo.com", "selector=:-abp-properties(abc)", "domains=foo.com|~bar"]);
  compareFilter("~foo.com,bar.com#?#:-abp-properties(abc)", ["type=elemhideemulation", "text=~foo.com,bar.com#?#:-abp-properties(abc)", "selectorDomains=bar.com", "selector=:-abp-properties(abc)", "domains=bar.com|~foo.com"]);

  // Check some special cases
  compareFilter("#?#:-abp-properties(abc)", ["type=invalid", "text=#?#:-abp-properties(abc)", "reason=filter_elemhideemulation_nodomain"]);
  compareFilter("foo.com#?#abc", ["type=elemhideemulation", "text=foo.com#?#abc", "selectorDomains=foo.com", "selector=abc", "domains=foo.com"]);
  compareFilter("foo.com#?#:-abp-foobar(abc)", ["type=elemhideemulation", "text=foo.com#?#:-abp-foobar(abc)", "selectorDomains=foo.com", "selector=:-abp-foobar(abc)", "domains=foo.com"]);
  compareFilter("foo.com#?#aaa :-abp-properties(abc) bbb", ["type=elemhideemulation", "text=foo.com#?#aaa :-abp-properties(abc) bbb", "selectorDomains=foo.com", "selector=aaa :-abp-properties(abc) bbb", "domains=foo.com"]);
  compareFilter("foo.com#?#:-abp-properties(|background-image: url(data:*))", ["type=elemhideemulation", "text=foo.com#?#:-abp-properties(|background-image: url(data:*))", "selectorDomains=foo.com", "selector=:-abp-properties(|background-image: url(data:*))", "domains=foo.com"]);

  // Support element hiding emulation filters for localhost (#6931).
  compareFilter("localhost#?#:-abp-properties(abc)", ["type=elemhideemulation", "text=localhost#?#:-abp-properties(abc)", "selectorDomains=localhost", "selector=:-abp-properties(abc)", "domains=localhost"]);
  compareFilter("localhost,~www.localhost#?#:-abp-properties(abc)", ["type=elemhideemulation", "text=localhost,~www.localhost#?#:-abp-properties(abc)", "selectorDomains=localhost", "selector=:-abp-properties(abc)", "domains=localhost|~www.localhost"]);
  compareFilter("~www.localhost,localhost#?#:-abp-properties(abc)", ["type=elemhideemulation", "text=~www.localhost,localhost#?#:-abp-properties(abc)", "selectorDomains=localhost", "selector=:-abp-properties(abc)", "domains=localhost|~www.localhost"]);

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
    assert.ok(filter instanceof InvalidFilter);
    assert.equal(filter.reason, "filter_invalid_domain");
  }

  test.done();
};

exports.testElemHideRulesWithBraces = function(test)
{
  compareFilter(
    "###foo{color: red}", [
      "type=elemhide",
      "text=###foo{color: red}",
      "selectorDomains=",
      "selector=#foo{color: red}",
      "domains="
    ]
  );
  compareFilter(
    "foo.com#?#:-abp-properties(/margin: [3-4]{2}/)", [
      "type=elemhideemulation",
      "text=foo.com#?#:-abp-properties(/margin: [3-4]{2}/)",
      "selectorDomains=foo.com",
      "selector=:-abp-properties(/margin: [3-4]{2}/)",
      "domains=foo.com"
    ]
  );
  test.done();
};

exports.testSnippetFilters = function(test)
{
  compareFilter("foo.com#$#abc", ["type=snippet", "text=foo.com#$#abc", "scriptDomains=foo.com", "script=abc", "domains=foo.com"]);
  compareFilter("foo.com,~bar.com#$#abc", ["type=snippet", "text=foo.com,~bar.com#$#abc", "scriptDomains=foo.com", "script=abc", "domains=foo.com|~bar.com"]);
  compareFilter("foo.com,~bar#$#abc", ["type=snippet", "text=foo.com,~bar#$#abc", "scriptDomains=foo.com", "script=abc", "domains=foo.com|~bar"]);
  compareFilter("~foo.com,bar.com#$#abc", ["type=snippet", "text=~foo.com,bar.com#$#abc", "scriptDomains=bar.com", "script=abc", "domains=bar.com|~foo.com"]);

  test.done();
};

exports.testFilterNormalization = function(test)
{
  // Line breaks etc
  assert.equal(Filter.normalize("\n\t\nad\ns"),
               "ads");

  // Comment filters
  assert.equal(Filter.normalize("   !  fo  o##  bar   "),
               "!  fo  o##  bar");

  // Element hiding filters
  assert.equal(Filter.normalize("   domain.c  om## # sele ctor   "),
               "domain.com### sele ctor");

  // Element hiding emulation filters
  assert.equal(Filter.normalize("   domain.c  om#?# # sele ctor   "),
               "domain.com#?## sele ctor");

  // Incorrect syntax: the separator "#?#" cannot contain spaces; treated as a
  // regular filter instead
  assert.equal(Filter.normalize("   domain.c  om# ?#. sele ctor   "),
               "domain.com#?#.selector");
  // Incorrect syntax: the separator "#?#" cannot contain spaces; treated as an
  // element hiding filter instead, because the "##" following the "?" is taken
  // to be the separator instead
  assert.equal(Filter.normalize("   domain.c  om# ?##sele ctor   "),
               "domain.com#?##sele ctor");

  // Element hiding exception filters
  assert.equal(Filter.normalize("   domain.c  om#@# # sele ctor   "),
               "domain.com#@## sele ctor");

  // Incorrect syntax: the separator "#@#" cannot contain spaces; treated as a
  // regular filter instead (not an element hiding filter either!), because
  // unlike the case with "# ?##" the "##" following the "@" is not considered
  // to be a separator
  assert.equal(Filter.normalize("   domain.c  om# @## sele ctor   "),
               "domain.com#@##selector");

  // Snippet filters
  assert.equal(Filter.normalize("   domain.c  om#$#  sni pp  et   "),
               "domain.com#$#sni pp  et");

  // Regular filters
  let normalized = Filter.normalize(
    "    b$l 	 a$sitekey=  foo  ,domain= do main.com |foo   .com,c sp= c   s p  "
  );
  assert.equal(
    normalized,
    "b$la$sitekey=foo,domain=domain.com|foo.com,csp=c s p"
  );
  compareFilter(
    normalized, [
      "type=filterlist",
      "text=" + normalized,
      "csp=c s p",
      "domains=domain.com|foo.com",
      "sitekeys=FOO",
      "contentType=" + t.CSP
    ]
  );

  // Some $csp edge cases
  assert.equal(Filter.normalize("$csp=  "),
               "$csp=");
  assert.equal(Filter.normalize("$csp= c s p"),
               "$csp=c s p");
  assert.equal(Filter.normalize("$$csp= c s p"),
               "$$csp=c s p");
  assert.equal(Filter.normalize("$$$csp= c s p"),
               "$$$csp=c s p");
  assert.equal(Filter.normalize("foo?csp=b a r$csp=script-src  'self'"),
               "foo?csp=bar$csp=script-src 'self'");
  assert.equal(Filter.normalize("foo$bar=c s p = ba z,cs p = script-src  'self'"),
               "foo$bar=csp=baz,csp=script-src 'self'");
  assert.equal(Filter.normalize("foo$csp=c s p csp= ba z,cs p  = script-src  'self'"),
               "foo$csp=c s p csp= ba z,csp=script-src 'self'");
  assert.equal(Filter.normalize("foo$csp=bar,$c sp=c s p"),
               "foo$csp=bar,$csp=c s p");
  assert.equal(Filter.normalize(" f o   o   $      bar   $csp=ba r"),
               "foo$bar$csp=ba r");
  assert.equal(Filter.normalize("f    $    o    $    o    $    csp=f o o "),
               "f$o$o$csp=f o o");
  assert.equal(Filter.normalize("/foo$/$ csp = script-src  http://example.com/?$1=1&$2=2&$3=3"),
               "/foo$/$csp=script-src http://example.com/?$1=1&$2=2&$3=3");
  assert.equal(Filter.normalize("||content.server.com/files/*.php$rewrite= $1"),
               "||content.server.com/files/*.php$rewrite=$1");
  test.done();
};

exports.testFilterRewriteOption = function(test)
{
  let text = "/(content\\.server\\/file\\/.*\\.txt)\\?.*$/$rewrite=$1";
  let filter = Filter.fromText(text);
  assert.ok(filter instanceof InvalidFilter);
  assert.equal(filter.type, "invalid");
  assert.equal(filter.reason, "filter_invalid_rewrite");

  text = "||/(content\\.server\\/file\\/.*\\.txt)\\?.*$/$rewrite=blank-text,domains=content.server";
  filter = Filter.fromText(text);
  assert.ok(filter instanceof InvalidFilter);
  assert.equal(filter.type, "invalid");
  assert.equal(filter.reason, "filter_invalid_rewrite");

  text = "||/(content\\.server\\/file\\/.*\\.txt)\\?.*$/$rewrite=abp-resource:blank-text,domain=content.server";
  filter = Filter.fromText(text);
  assert.equal(filter.rewriteUrl("http://content.server/file/foo.txt"),
               "data:text/plain,");
  assert.equal(filter.rewriteUrl("http://content.server/file/foo.txt?bar"),
               "data:text/plain,");

  test.done();
};

exports.testDomainMapDeduplication = function(test)
{
  let filter1 = Filter.fromText("foo$domain=blocking.example.com");
  let filter2 = Filter.fromText("bar$domain=blocking.example.com");
  let filter3 = Filter.fromText("elemhide.example.com##.foo");
  let filter4 = Filter.fromText("elemhide.example.com##.bar");

  // This compares the references to make sure that both refer to the same
  // object (#6815).

  assert.equal(filter1.domains, filter2.domains);
  assert.equal(filter3.domains, filter4.domains);

  let filter5 = Filter.fromText("bar$domain=www.example.com");
  let filter6 = Filter.fromText("www.example.com##.bar");

  assert.notEqual(filter2.domains, filter5.domains);
  assert.notEqual(filter4.domains, filter6.domains);

  test.done();
};
