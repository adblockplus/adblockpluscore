/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-2016 Eyeo GmbH
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
let InvalidFilter = null;
let CommentFilter = null;
let ActiveFilter = null;
let RegExpFilter = null;
let BlockingFilter = null;
let WhitelistFilter = null;
let ElemHideBase = null;
let ElemHideFilter = null;
let ElemHideException = null;
let ElemHideEmulationFilter = null;

let t = null;
let defaultTypes = null;

exports.setUp = function(callback)
{
  let sandboxedRequire = createSandbox();
  (
    {Filter, InvalidFilter, CommentFilter, ActiveFilter, RegExpFilter,
     BlockingFilter, WhitelistFilter, ElemHideBase, ElemHideFilter,
     ElemHideException,
     ElemHideEmulationFilter} = sandboxedRequire("../lib/filterClasses")
  );
  t = RegExpFilter.typeMap;
  defaultTypes = 0x7FFFFFFF & ~(t.ELEMHIDE | t.DOCUMENT | t.POPUP |
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
  {
    result.push("type=comment");
  }
  else if (filter instanceof ActiveFilter)
  {
    result.push("disabled=" + filter.disabled);
    result.push("lastHit=" + filter.lastHit);
    result.push("hitCount=" + filter.hitCount);

    let domains = [];
    if (filter.domains)
    {
      for (let domain in filter.domains)
        if (domain != "")
          domains.push(filter.domains[domain] ? domain : "~" + domain);
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
      }
      else if (filter instanceof WhitelistFilter)
      {
        result.push("type=whitelist");
      }
    }
    else if (filter instanceof ElemHideBase)
    {
      if (filter instanceof ElemHideFilter)
        result.push("type=elemhide");
      else if (filter instanceof ElemHideException)
        result.push("type=elemhideexception");
      else if (filter instanceof ElemHideEmulationFilter)
        result.push("type=elemhideemulation");

      result.push("selectorDomain=" + (filter.selectorDomain || ""));
      result.push("selector=" + filter.selector);
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
      type == "elemhideexception" || type == "elemhideemulation")
  {
    addProperty("disabled", "false");
    addProperty("lastHit", "0");
    addProperty("hitCount", "0");
  }
  if (type == "whitelist" || type == "filterlist")
  {
    addProperty("contentType", 0x7FFFFFFF & ~(
      RegExpFilter.typeMap.DOCUMENT | RegExpFilter.typeMap.ELEMHIDE |
      RegExpFilter.typeMap.POPUP | RegExpFilter.typeMap.GENERICHIDE |
      RegExpFilter.typeMap.GENERICBLOCK
    ));
    addProperty("matchCase", "false");
    addProperty("thirdParty", "null");
    addProperty("domains", "");
    addProperty("sitekeys", "");
  }
  if (type == "filterlist")
  {
    addProperty("collapse", "null");
  }
  if (type == "elemhide" || type == "elemhideexception" ||
      type == "elemhideemulation")
  {
    addProperty("selectorDomain", "");
    addProperty("domains", "");
  }
}

function compareFilter(test, text, expected, postInit)
{
  addDefaults(expected);

  let filter = Filter.fromText(text);
  if (postInit)
    postInit(filter)
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
  {
    filter2 = Filter.fromText(filter.text);
  }

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
  test.equal(typeof WhitelistFilter, "function", "typeof WhitelistFilter");
  test.equal(typeof ElemHideBase, "function", "typeof ElemHideBase");
  test.equal(typeof ElemHideFilter, "function", "typeof ElemHideFilter");
  test.equal(typeof ElemHideException, "function", "typeof ElemHideException");
  test.equal(typeof ElemHideEmulationFilter, "function",
             "typeof ElemHideEmulationFilter");

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
  compareFilter(test, "#dd(asd)(ddd)", ["type=invalid", "text=#dd(asd)(ddd)", "reason=filter_elemhide_duplicate_id"]);
  compareFilter(test, "#*", ["type=invalid", "text=#*", "reason=filter_elemhide_nocriteria"]);

  function checkElemHideEmulationFilterInvalid(domains)
  {
    let filterText = domains + "##[-abp-properties='abc']";
    compareFilter(test, filterText,
                  ["type=invalid", "text=" + filterText,
                   "reason=filter_elemhideemulation_nodomain"]);
  }
  checkElemHideEmulationFilterInvalid("");
  checkElemHideEmulationFilterInvalid("~foo.com");
  checkElemHideEmulationFilterInvalid("~foo.com,~bar.com");
  checkElemHideEmulationFilterInvalid("foo");
  checkElemHideEmulationFilterInvalid("~foo.com,bar");

  test.done();
};

exports.testFiltersWithState  = function(test)
{
  compareFilter(test, "blabla", ["type=filterlist", "text=blabla", "regexp=blabla"]);
  compareFilter(test, "blabla_default", ["type=filterlist", "text=blabla_default", "regexp=blabla_default"], function(filter)
  {
    filter.disabled = false;
    filter.hitCount = 0;
    filter.lastHit = 0;
  });
  compareFilter(test, "blabla_non_default", ["type=filterlist", "text=blabla_non_default", "regexp=blabla_non_default", "disabled=true", "hitCount=12", "lastHit=20"], function(filter)
  {
    filter.disabled = true;
    filter.hitCount = 12;
    filter.lastHit = 20;
  });

  test.done();
};

exports.testSpecialCharacters = function(test)
{
  compareFilter(test, "/ddd|f?a[s]d/", ["type=filterlist", "text=/ddd|f?a[s]d/", "regexp=ddd|f?a[s]d"]);
  compareFilter(test, "*asdf*d**dd*", ["type=filterlist", "text=*asdf*d**dd*", "regexp=asdf.*d.*dd"]);
  compareFilter(test, "|*asd|f*d**dd*|", ["type=filterlist", "text=|*asd|f*d**dd*|", "regexp=^.*asd\\|f.*d.*dd.*$"]);
  compareFilter(test, "dd[]{}$%<>&()d", ["type=filterlist", "text=dd[]{}$%<>&()d", "regexp=dd\\[\\]\\{\\}\\$\\%\\<\\>\\&\\(\\)d"]);

  compareFilter(test, "@@/ddd|f?a[s]d/", ["type=whitelist", "text=@@/ddd|f?a[s]d/", "regexp=ddd|f?a[s]d", "contentType=" + defaultTypes]);
  compareFilter(test, "@@*asdf*d**dd*", ["type=whitelist", "text=@@*asdf*d**dd*", "regexp=asdf.*d.*dd", "contentType=" + defaultTypes]);
  compareFilter(test, "@@|*asd|f*d**dd*|", ["type=whitelist", "text=@@|*asd|f*d**dd*|", "regexp=^.*asd\\|f.*d.*dd.*$", "contentType=" + defaultTypes]);
  compareFilter(test, "@@dd[]{}$%<>&()d", ["type=whitelist", "text=@@dd[]{}$%<>&()d", "regexp=dd\\[\\]\\{\\}\\$\\%\\<\\>\\&\\(\\)d", "contentType=" + defaultTypes]);

  test.done();
};

exports.testFilterOptions = function(test)
{
  compareFilter(test, "bla$match-case,script,other,third-party,domain=foo.com,sitekey=foo", ["type=filterlist", "text=bla$match-case,script,other,third-party,domain=foo.com,sitekey=foo", "regexp=bla", "matchCase=true", "contentType=" + (t.SCRIPT | t.OTHER), "thirdParty=true", "domains=FOO.COM", "sitekeys=FOO"]);
  compareFilter(test, "bla$~match-case,~script,~other,~third-party,domain=~bar.com", ["type=filterlist", "text=bla$~match-case,~script,~other,~third-party,domain=~bar.com", "regexp=bla", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.OTHER)), "thirdParty=false", "domains=~BAR.COM"]);
  compareFilter(test, "@@bla$match-case,script,other,third-party,domain=foo.com|bar.com|~bar.foo.com|~foo.bar.com,sitekey=foo|bar", ["type=whitelist", "text=@@bla$match-case,script,other,third-party,domain=foo.com|bar.com|~bar.foo.com|~foo.bar.com,sitekey=foo|bar", "regexp=bla", "matchCase=true", "contentType=" + (t.SCRIPT | t.OTHER), "thirdParty=true", "domains=BAR.COM|FOO.COM|~BAR.FOO.COM|~FOO.BAR.COM", "sitekeys=BAR|FOO"]);

  // background and image should be the same for backwards compatibility
  compareFilter(test, "bla$image", ["type=filterlist", "text=bla$image", "regexp=bla", "contentType=" + (t.IMAGE)]);
  compareFilter(test, "bla$background", ["type=filterlist", "text=bla$background", "regexp=bla", "contentType=" + (t.IMAGE)]);
  compareFilter(test, "bla$~image", ["type=filterlist", "text=bla$~image", "regexp=bla", "contentType=" + (defaultTypes & ~t.IMAGE)]);
  compareFilter(test, "bla$~background", ["type=filterlist", "text=bla$~background", "regexp=bla", "contentType=" + (defaultTypes & ~t.IMAGE)]);

  compareFilter(test, "@@bla$~script,~other", ["type=whitelist", "text=@@bla$~script,~other", "regexp=bla", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.OTHER))]);
  compareFilter(test, "@@http://bla$~script,~other", ["type=whitelist", "text=@@http://bla$~script,~other", "regexp=http\\:\\/\\/bla", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.OTHER))]);
  compareFilter(test, "@@|ftp://bla$~script,~other", ["type=whitelist", "text=@@|ftp://bla$~script,~other", "regexp=^ftp\\:\\/\\/bla", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.OTHER))]);
  compareFilter(test, "@@bla$~script,~other,document", ["type=whitelist", "text=@@bla$~script,~other,document", "regexp=bla", "contentType=" +  (defaultTypes & ~(t.SCRIPT | t.OTHER) | t.DOCUMENT)]);
  compareFilter(test, "@@bla$~script,~other,~document", ["type=whitelist", "text=@@bla$~script,~other,~document", "regexp=bla", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.OTHER))]);
  compareFilter(test, "@@bla$document", ["type=whitelist", "text=@@bla$document", "regexp=bla", "contentType=" + t.DOCUMENT]);
  compareFilter(test, "@@bla$~script,~other,elemhide", ["type=whitelist", "text=@@bla$~script,~other,elemhide", "regexp=bla", "contentType=" +  (defaultTypes & ~(t.SCRIPT | t.OTHER) | t.ELEMHIDE)]);
  compareFilter(test, "@@bla$~script,~other,~elemhide", ["type=whitelist", "text=@@bla$~script,~other,~elemhide", "regexp=bla", "contentType=" + (defaultTypes & ~(t.SCRIPT | t.OTHER))]);
  compareFilter(test, "@@bla$elemhide", ["type=whitelist", "text=@@bla$elemhide", "regexp=bla", "contentType=" + t.ELEMHIDE]);

  compareFilter(test, "@@bla$~script,~other,donottrack", ["type=invalid", "text=@@bla$~script,~other,donottrack", "reason=filter_unknown_option"]);
  compareFilter(test, "@@bla$~script,~other,~donottrack", ["type=invalid", "text=@@bla$~script,~other,~donottrack", "reason=filter_unknown_option"]);
  compareFilter(test, "@@bla$donottrack", ["type=invalid", "text=@@bla$donottrack", "reason=filter_unknown_option"]);
  compareFilter(test, "@@bla$foobar", ["type=invalid", "text=@@bla$foobar", "reason=filter_unknown_option"]);
  compareFilter(test, "@@bla$image,foobar", ["type=invalid", "text=@@bla$image,foobar", "reason=filter_unknown_option"]);
  compareFilter(test, "@@bla$foobar,image", ["type=invalid", "text=@@bla$foobar,image", "reason=filter_unknown_option"]);

  test.done();
};

exports.testElementHidingRules = function(test)
{
  compareFilter(test, "#ddd", ["type=elemhide", "text=#ddd", "selector=ddd"]);
  compareFilter(test, "#ddd(fff)", ["type=elemhide", "text=#ddd(fff)", "selector=ddd.fff,ddd#fff"]);
  compareFilter(test, "#ddd(foo=bar)(foo2^=bar2)(foo3*=bar3)(foo4$=bar4)", ["type=elemhide", "text=#ddd(foo=bar)(foo2^=bar2)(foo3*=bar3)(foo4$=bar4)", 'selector=ddd[foo="bar"][foo2^="bar2"][foo3*="bar3"][foo4$="bar4"]']);
  compareFilter(test, "#ddd(fff)(foo=bar)", ["type=elemhide", "text=#ddd(fff)(foo=bar)", 'selector=ddd.fff[foo="bar"],ddd#fff[foo="bar"]']);
  compareFilter(test, "#*(fff)", ["type=elemhide", "text=#*(fff)", "selector=.fff,#fff"]);
  compareFilter(test, "#*(foo=bar)", ["type=elemhide", "text=#*(foo=bar)", 'selector=[foo="bar"]']);
  compareFilter(test, "##body > div:first-child", ["type=elemhide", "text=##body > div:first-child", "selector=body > div:first-child"]);
  compareFilter(test, "foo#ddd", ["type=elemhide", "text=foo#ddd", "selectorDomain=foo", "selector=ddd", "domains=FOO"]);
  compareFilter(test, "foo,bar#ddd", ["type=elemhide", "text=foo,bar#ddd", "selectorDomain=foo,bar", "selector=ddd", "domains=BAR|FOO"]);
  compareFilter(test, "foo,~bar#ddd", ["type=elemhide", "text=foo,~bar#ddd", "selectorDomain=foo", "selector=ddd", "domains=FOO|~BAR"]);
  compareFilter(test, "foo,~baz,bar#ddd", ["type=elemhide", "text=foo,~baz,bar#ddd", "selectorDomain=foo,bar", "selector=ddd", "domains=BAR|FOO|~BAZ"]);

  test.done();
};

exports.testElementHidingExceptions = function(test)
{
  compareFilter(test, "#@ddd", ["type=elemhideexception", "text=#@ddd", "selector=ddd"]);
  compareFilter(test, "#@ddd(fff)", ["type=elemhideexception", "text=#@ddd(fff)", "selector=ddd.fff,ddd#fff"]);
  compareFilter(test, "#@ddd(foo=bar)(foo2^=bar2)(foo3*=bar3)(foo4$=bar4)", ["type=elemhideexception", "text=#@ddd(foo=bar)(foo2^=bar2)(foo3*=bar3)(foo4$=bar4)", 'selector=ddd[foo="bar"][foo2^="bar2"][foo3*="bar3"][foo4$="bar4"]']);
  compareFilter(test, "#@ddd(fff)(foo=bar)", ["type=elemhideexception", "text=#@ddd(fff)(foo=bar)", 'selector=ddd.fff[foo="bar"],ddd#fff[foo="bar"]']);
  compareFilter(test, "#@*(fff)", ["type=elemhideexception", "text=#@*(fff)", "selector=.fff,#fff"]);
  compareFilter(test, "#@*(foo=bar)", ["type=elemhideexception", "text=#@*(foo=bar)", 'selector=[foo="bar"]']);
  compareFilter(test, "#@#body > div:first-child", ["type=elemhideexception", "text=#@#body > div:first-child", "selector=body > div:first-child"]);
  compareFilter(test, "foo#@ddd", ["type=elemhideexception", "text=foo#@ddd", "selectorDomain=foo", "selector=ddd", "domains=FOO"]);
  compareFilter(test, "foo,bar#@ddd", ["type=elemhideexception", "text=foo,bar#@ddd", "selectorDomain=foo,bar", "selector=ddd", "domains=BAR|FOO"]);
  compareFilter(test, "foo,~bar#@ddd", ["type=elemhideexception", "text=foo,~bar#@ddd", "selectorDomain=foo", "selector=ddd", "domains=FOO|~BAR"]);
  compareFilter(test, "foo,~baz,bar#@ddd", ["type=elemhideexception", "text=foo,~baz,bar#@ddd", "selectorDomain=foo,bar", "selector=ddd", "domains=BAR|FOO|~BAZ"]);

  test.done();
};

exports.testElemHideEmulationFilters = function(test)
{
  // Check valid domain combinations
  compareFilter(test, "foo.com##[-abp-properties='abc']", ["type=elemhideemulation", "text=foo.com##[-abp-properties='abc']", "selectorDomain=foo.com", "selector=[-abp-properties='abc']", "domains=FOO.COM"]);
  compareFilter(test, "foo.com,~bar.com##[-abp-properties='abc']", ["type=elemhideemulation", "text=foo.com,~bar.com##[-abp-properties='abc']", "selectorDomain=foo.com", "selector=[-abp-properties='abc']", "domains=FOO.COM|~BAR.COM"]);
  compareFilter(test, "foo.com,~bar##[-abp-properties='abc']", ["type=elemhideemulation", "text=foo.com,~bar##[-abp-properties='abc']", "selectorDomain=foo.com", "selector=[-abp-properties='abc']", "domains=FOO.COM|~BAR"]);
  compareFilter(test, "~foo.com,bar.com##[-abp-properties='abc']", ["type=elemhideemulation", "text=~foo.com,bar.com##[-abp-properties='abc']", "selectorDomain=bar.com", "selector=[-abp-properties='abc']", "domains=BAR.COM|~FOO.COM"]);

  compareFilter(test, "##[-abp-properties='']", ["type=invalid", "text=##[-abp-properties='']", "reason=filter_elemhideemulation_nodomain"]);
  compareFilter(test, "foo.com#@#[-abp-properties='abc']", ["type=elemhideexception", "text=foo.com#@#[-abp-properties='abc']", "selectorDomain=foo.com", "selector=[-abp-properties='abc']", "domains=FOO.COM"]);
  compareFilter(test, "foo.com##aaa [-abp-properties='abc'] bbb", ["type=elemhideemulation", "text=foo.com##aaa [-abp-properties='abc'] bbb", "selectorDomain=foo.com", "selector=aaa [-abp-properties='abc'] bbb", "domains=FOO.COM"]);
  compareFilter(test, "foo.com##[-abp-properties='|background-image: url(data:*)']", ["type=elemhideemulation", "text=foo.com##[-abp-properties='|background-image: url(data:*)']", "selectorDomain=foo.com", "selector=[-abp-properties='|background-image: url(data:*)']", "domains=FOO.COM"]);

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
