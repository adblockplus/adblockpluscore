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
let InvalidFilter = null;
let CommentFilter = null;
let ActiveFilter = null;
let RegExpFilter = null;
let BlockingFilter = null;
let WhitelistFilter = null;
let ElemHideBase = null;
let ElemHideFilter = null;
let ElemHideException = null;
let CSSPropertyFilter = null;

exports.setUp = function(callback)
{
  let sandboxedRequire = createSandbox();
  (
    {
      Filter, InvalidFilter, CommentFilter, ActiveFilter, RegExpFilter,
      BlockingFilter, WhitelistFilter, ElemHideBase, ElemHideFilter,
      ElemHideException, CSSPropertyFilter
    } = sandboxedRequire("../lib/filterClassesNew")
  );
  callback();
};

exports.testFromText = function(test)
{
  let tests = [
    ["!asdf", CommentFilter, "comment"],
    ["asdf", BlockingFilter, "blocking"],
    ["asdf$image,~collapse", BlockingFilter, "blocking"],
    ["/asdf/", BlockingFilter, "blocking"],
    ["/asdf??+/", InvalidFilter, "invalid"],
    ["@@asdf", WhitelistFilter, "whitelist"],
    ["@@asdf$image,~collapse", WhitelistFilter, "whitelist"],
    ["@@/asdf/", WhitelistFilter, "whitelist"],
    ["@@/asdf??+/", InvalidFilter, "invalid"],
    ["##asdf", ElemHideFilter, "elemhide"],
    ["#@#asdf", ElemHideException, "elemhideexception"],
    ["foobar##asdf", ElemHideFilter, "elemhide"],
    ["foobar#@#asdf", ElemHideException, "elemhideexception"],
    ["foobar##a", ElemHideFilter, "elemhide"],
    ["foobar#@#a", ElemHideException, "elemhideexception"],

    ["foobar#asdf", BlockingFilter, "blocking"],
    ["foobar|foobas##asdf", BlockingFilter, "blocking"],
    ["foobar##asdf{asdf}", BlockingFilter, "blocking"],
    ["foobar##", BlockingFilter, "blocking"],
    ["foobar#@#", BlockingFilter, "blocking"],
    ["asdf$foobar", InvalidFilter, "invalid"],
    ["asdf$image,foobar", InvalidFilter, "invalid"],
    ["asdf$image=foobar", BlockingFilter, "blocking"],
    ["asdf$image=foobar=xyz,~collapse", BlockingFilter, "blocking"],

    ["##foo[-abp-properties='something']bar", InvalidFilter, "invalid"],
    ["#@#foo[-abp-properties='something']bar", ElemHideException, "elemhideexception"],
    ["example.com##foo[-abp-properties='something']bar", CSSPropertyFilter, "cssproperty"],
    ["example.com#@#foo[-abp-properties='something']bar", ElemHideException, "elemhideexception"],
    ["~example.com##foo[-abp-properties='something']bar", InvalidFilter, "invalid"],
    ["~example.com#@#foo[-abp-properties='something']bar", ElemHideException, "elemhideexception"],
    ["~example.com,~example.info##foo[-abp-properties='something']bar", InvalidFilter, "invalid"],
    ["~example.com,~example.info#@#foo[-abp-properties='something']bar", ElemHideException, "elemhideexception"],
    ["~sub.example.com,example.com##foo[-abp-properties='something']bar", CSSPropertyFilter, "cssproperty"],
    ["~sub.example.com,example.com#@#foo[-abp-properties='something']bar", ElemHideException, "elemhideexception"],
    ["example.com,~sub.example.com##foo[-abp-properties='something']bar", CSSPropertyFilter, "cssproperty"],
    ["example.com,~sub.example.com#@#foo[-abp-properties='something']bar", ElemHideException, "elemhideexception"],
    ["example.com##[-abp-properties='something']", CSSPropertyFilter, "cssproperty"],
    ["example.com#@#[-abp-properties='something']", ElemHideException, "elemhideexception"],
    ["example.com##[-abp-properties=\"something\"]", CSSPropertyFilter, "cssproperty"],
    ["example.com#@#[-abp-properties=\"something\"]", ElemHideException, "elemhideexception"],
    ["example.com##[-abp-properties=(something)]", ElemHideFilter, "elemhide"],
    ["example.com#@#[-abp-properties=(something)]", ElemHideException, "elemhideexception"],
  ];
  for (let [text, type, typeName, location] of tests)
  {
    let filter = Filter.fromText(text);
    test.ok(filter instanceof Filter, "Got filter for " + text);
    test.equal(filter.text, text, "Correct filter text for " + text);
    test.ok(filter instanceof type, "Correct filter type for " + text);
    test.equal(filter.type, typeName, "Type name for " + text + " is " + typeName);
    if (type == InvalidFilter)
      test.ok(filter.reason, "Invalid filter " + text + " has a reason set");
    filter.delete();
  }
  test.done();
};

exports.testClassHierarchy = function(test)
{
  let allClasses = ["Filter", "InvalidFilter", "CommentFilter", "ActiveFilter",
    "RegExpFilter", "BlockingFilter", "WhitelistFilter", "ElemHideBase",
    "ElemHideFilter", "ElemHideException", "CSSPropertyFilter"];
  let tests = [
    ["/asdf??+/", "Filter", "InvalidFilter"],
    ["!asdf", "Filter", "CommentFilter"],
    ["asdf", "Filter", "ActiveFilter", "RegExpFilter", "BlockingFilter"],
    ["@@asdf", "Filter", "ActiveFilter", "RegExpFilter", "WhitelistFilter"],
    ["##asdf", "Filter", "ActiveFilter", "ElemHideBase", "ElemHideFilter"],
    ["#@#asdf", "Filter", "ActiveFilter", "ElemHideBase", "ElemHideException"],
    ["example.com##[-abp-properties='something']", "Filter", "ActiveFilter", "ElemHideBase", "CSSPropertyFilter"],
  ];

  for (let list of tests)
  {
    let filter = Filter.fromText(list.shift());
    for (let cls of list)
    {
      test.ok(filter instanceof eval(cls),
          "Filter " + filter.text + " is an instance of " + cls);
    }

    for (let cls of allClasses)
    {
      if (list.indexOf(cls) < 0)
      {
        test.ok(!(filter instanceof eval(cls)),
            "Filter " + filter.text + " isn't an instance of " + cls);
      }
    }
    filter.delete();
  }

  test.done();
};

exports.testGC = function(test)
{
  let filter1 = Filter.fromText("someknownfilter");
  test.equal(filter1.hitCount, 0, "Initial hit count");

  filter1.hitCount = 432;

  let filter2 = Filter.fromText("someknownfilter");
  test.equal(filter2.hitCount, 432, "Known filter returned");

  filter2.hitCount = 234;
  test.equal(filter1.hitCount, 234, "Changing second wrapper modifies original as well");

  filter1.delete();
  filter2.delete();

  let filter3 = Filter.fromText("someknownfilter");
  test.equal(filter3.hitCount, 0, "Filter data has been reset once previous instances have been released");
  filter3.delete();

  test.done();
};

exports.testNormalize = function(test)
{
  let tests = [
    [" !  comment something ", "!  comment something"],
    [" ! \n comment something ", "!  comment something"],
    ["  foo bar ", "foobar"],
    [" foo , bar #  # foo > bar ", "foo,bar##foo > bar", "foo,bar", "foo > bar"],
    [" foo , bar # @   # foo > bar ", "foo,bar#@#foo > bar", "foo,bar", "foo > bar"],
    ["foOBar"],
    ["foOBar#xyz"],
    ["foOBar$iMaGe,object_subrequest,~coLLapse", "foOBar$image,object-subrequest,~collapse"],
    ["foOBar$doMain=EXample.COM|~exAMPLE.РФ", "foOBar$domain=example.com|~example.рф"],
    ["foOBar$sitekeY=SiteKey", "foOBar$sitekey=SiteKey"],
    ["exampLE.com##fooBAr", "example.com##fooBAr"],
    ["exampLE.com#@#fooBAr", "example.com#@#fooBAr"],
    ["exampLE.РФ#@#fooBAr", "example.рф#@#fooBAr"],
  ];

  for (let [text, expected, selectorDomain, selector] of tests)
  {
    if (!expected)
      expected = text;

    let filter1 = Filter.fromText(text);
    let filter2 = Filter.fromText(expected);

    test.equal(filter1.text, expected, "Filter text " + text + " got normalized");
    test.equal(filter2.text, expected, "Already normalized text " + expected + " didn't change");

    if (filter1 instanceof ActiveFilter)
    {
      filter1.hitCount = 567;
      test.equal(filter1.hitCount, filter2.hitCount, "Property changes on filter " + text + " get reflected on filter " + expected);
    }

    if (selectorDomain)
    {
      let expectedDomains = selectorDomain.split(",").sort().join(",");
      let actualDomains1 = filter1.selectorDomain.split(",").sort().join(",");
      let actualDomains2 = filter2.selectorDomain.split(",").sort().join(",");
      test.equal(actualDomains1, expectedDomains, "Correct selector domain for filter " + text);
      test.equal(actualDomains1, expectedDomains, "Correct selector domain for filter " + expected);

      test.equal(filter1.selector, selector, "Correct selector for filter " + text);
      test.equal(filter2.selector, selector, "Correct selector for filter " + expected);
    }

    filter1.delete();
    filter2.delete();
  }

  test.done();
};

exports.testSerialize = function(test)
{
  // Comment
  let filter = Filter.fromText("! serialize");
  test.equal(filter.serialize(), "[Filter]\ntext=! serialize\n");
  filter.delete();

  // Blocking filter
  filter = Filter.fromText("serialize");
  test.equal(filter.serialize(), "[Filter]\ntext=serialize\n");
  filter.disabled = true;
  test.equal(filter.serialize(), "[Filter]\ntext=serialize\ndisabled=true\n");
  filter.disabled = false;
  filter.hitCount = 10;
  filter.lastHit = 12;
  test.equal(filter.serialize(), "[Filter]\ntext=serialize\nhitCount=10\nlastHit=12\n");
  filter.delete();

  // Invalid filter
  filter = Filter.fromText("serialize$foobar");
  test.equal(filter.serialize(), "[Filter]\ntext=serialize$foobar\n");
  filter.delete();

  // Element hiding filter
  filter = Filter.fromText("example.com##serialize");
  test.equal(filter.serialize(), "[Filter]\ntext=example.com##serialize\n");
  filter.disabled = true;
  filter.lastHit = 5;
  test.equal(filter.serialize(), "[Filter]\ntext=example.com##serialize\ndisabled=true\nlastHit=5\n");
  filter.delete();

  test.done();
};

exports.testInvalidReasons = function(test)
{
  let tests = [
    ["/??/", "filter_invalid_regexp"],
    ["asd$foobar", "filter_unknown_option"],
    ["~foo.com##[-abp-properties='abc']", "filter_cssproperty_nodomain"],
  ];

  for (let [text, reason] of tests)
  {
    let filter = Filter.fromText(text);
    test.equals(filter.reason, reason, "Reason why filter " + text + " is invalid");
    filter.delete();
  }

  test.done();
};

exports.testActiveFilter = function(test)
{
  let filter1 = Filter.fromText("asdf");
  let filter1copy = Filter.fromText("asdf");
  let filter2 = Filter.fromText("##foobar");

  test.ok(!filter1.disabled && !filter1copy.disabled && !filter2.disabled, "Filters are initially enabled");
  filter1.disabled = true;
  test.ok(filter1.disabled, "Disabling filter works");
  test.ok(filter1copy.disabled, "Filter copies are also disabled");
  test.ok(!filter2.disabled, "Disabling one filter doesn't disable others");

  test.ok(filter1.hitCount === 0 && filter1copy.hitCount === 0 && filter2.hitCount === 0, "Filters have no hit initially");
  filter1.hitCount = 5;
  test.equal(filter1.hitCount, 5, "Changing hit count works");
  test.equal(filter1copy.hitCount, 5, "Hit count of filter copies is also changed");
  test.equal(filter2.hitCount, 0, "Hit count of other filters isn't affected");

  test.ok(filter1.lastHit === 0 && filter1copy.lastHit === 0 && filter2.lastHit === 0, "Filters have no last hit time initially");
  filter1.lastHit = 10;
  test.equal(filter1.lastHit, 10, "Changing last hit time works");
  test.equal(filter1copy.lastHit, 10, "Last hit time of filter copies is also changed");
  test.equal(filter2.lastHit, 0, "Last hit time of other filters isn't affected");

  filter1.delete();
  filter1copy.delete();
  filter2.delete();

  test.done();
};

exports.testIsGeneric = function(test)
{
  let tests = [
    ["asfd", true],
    ["|http://example.com/asdf", true],
    ["||example.com/asdf", true],
    ["asfd$third-party", true],
    ["asdf$domain=com", false],
    ["asdf$domain=example.com", false],
    ["asdf$image,domain=example.com", false],
    ["asdf$~image,domain=example.com", false],
    ["asdf$third-party,domain=example.com", false],
    ["||example.com/asdf$~coLLapse,domain=example.com", false],
    ["||example.com/asdf$domain=~example.com", true],
    ["||example.com/asdf$third-party,domain=~example.com", true],
    ["asdf$domain=foo.example.com|~example.com", false],
    ["asdf$domain=foo.com|~example.com", false],
    ["asdf$domain=~foo.com|~example.com", true],
  ];

  for (let [text, generic] of tests)
  {
    let filter = Filter.fromText(text);
    test.equal(filter.isGeneric(), generic, "Filter " + text + " is generic");
    filter.delete();
  }

  test.done();
}

exports.testElemHideSelector = function(test)
{
  function doTest(text, selector, selectorDomain)
  {
    let filter = Filter.fromText(text);
    test.equal(filter.selector, selector, "Correct selector for " + text);

    let actualDomains = filter.selectorDomain.split(",").sort().join(",");
    let expectedDomains = selectorDomain.split(",").sort().join(",");
    test.equal(actualDomains, expectedDomains, "Correct domains list for " + text);

    filter.delete();
  }

  let tests = [
    ["##foobar", "foobar", ""],
    ["~example.com##foobar", "foobar", ""],
    ["example.com##body > div:first-child", "body > div:first-child", "example.com"],
    ["xYz,~example.com##foobar:not(whatever)", "foobar:not(whatever)","xyz"],
    ["~xyz,com,~abc.com,example.info##foobar", "foobar", "com,example.info"],
    ["foo,bar,bas,bam##foobar", "foobar", "foo,bar,bas,bam"],

    // Good idea to test this? Maybe consider behavior undefined in this case.
    ["foo,bar,bas,~bar##foobar", "foobar", "foo,bas"],
  ];

  for (let [text, selector, selectorDomain] of tests)
  {
    doTest(text, selector, selectorDomain);
    doTest(text.replace("##", "#@#"), selector, selectorDomain);
  }

  test.done();
};

exports.testCSSRules = function(test)
{
  let tests = [
    ["foo.com##[-abp-properties='abc']", "abc", "", ""],
    ["foo.com##[-abp-properties='a\"bc']", "a\\\"bc", "", ""],
    ["foo.com##[-abp-properties=\"abc\"]", "abc", "", ""],
    ["foo.com##[-abp-properties=\"a'bc\"]", "a\\'bc", "", ""],
    ["foo.com##aaa [-abp-properties='abc'] bbb", "abc", "aaa ", " bbb"],
    ["foo.com##[-abp-properties='|background-image: url(data:*)']", "^background\\-image\\:\\ url\\(data\\:.*\\)", "", ""],
  ];

  for (let [text, regexp, prefix, suffix] of tests)
  {
    let filter = Filter.fromText(text);
    test.equal(filter.regexpString, regexp, "Regular expression of " + text);
    test.equal(filter.selectorPrefix, prefix, "Selector prefix of " + text);
    test.equal(filter.selectorSuffix, suffix, "Selector suffix of " + text);
    filter.delete();
  }

  test.done();
};
