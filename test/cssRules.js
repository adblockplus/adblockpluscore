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

let CSSPropertyFilter = null;
let CSSRules = null;
let ElemHide = null;
let Filter = null;

exports.setUp = function(callback)
{
  let sandboxedRequire = createSandbox();
  (
    {Filter, CSSPropertyFilter} = sandboxedRequire("../lib/filterClasses"),
    {CSSRules} = sandboxedRequire("../lib/cssRules"),
    {ElemHide} = sandboxedRequire("../lib/elemHide")
  );

  callback();
};

exports.testDomainRestrictions = function(test)
{
  function testSelectorMatches(description, filters, domain, expectedMatches)
  {
    for (let filter of filters)
    {
      filter = Filter.fromText(filter);
      if (filter instanceof CSSPropertyFilter)
        CSSRules.add(filter);
      else
        ElemHide.add(filter);
    }

    let matches = CSSRules.getRulesForDomain(domain).map(filter => filter.text);
    test.deepEqual(matches.sort(), expectedMatches.sort(), description);

    CSSRules.clear();
    ElemHide.clear();
  }

  testSelectorMatches(
    "Ignore generic filters",
    ["##[-abp-properties='foo']", "example.com##[-abp-properties='foo']",
     "~example.com##[-abp-properties='foo']"],
    "example.com",
    ["example.com##[-abp-properties='foo']"]
  );
  testSelectorMatches(
    "Ignore selectors with exceptions",
    ["example.com##[-abp-properties='foo']",
    "example.com##[-abp-properties='bar']",
    "example.com#@#[-abp-properties='foo']"],
    "example.com",
    ["example.com##[-abp-properties='bar']"]
  );
  testSelectorMatches(
    "Ignore filters that include parent domain but exclude subdomain",
    ["~www.example.com,example.com##[-abp-properties='foo']"],
    "www.example.com",
    []
  );
  testSelectorMatches(
    "Ignore filters with parent domain if exception matches subdomain",
    ["www.example.com#@#[-abp-properties='foo']",
     "example.com##[-abp-properties='foo']"],
    "www.example.com",
    []
  );
  testSelectorMatches(
    "Ignore filters for other subdomain",
    ["www.example.com##[-abp-properties='foo']",
    "other.example.com##[-abp-properties='foo']"],
    "other.example.com",
    ["other.example.com##[-abp-properties='foo']"]
  );

  test.done();
};

exports.testCSSPropertyFiltersContainer = function(test)
{
  function compareRules(description, domain, expectedMatches)
  {
    let result = CSSRules.getRulesForDomain(domain)
        .map((filter) => filter.text);
    expectedMatches = expectedMatches.map(filter => filter.text);
    test.deepEqual(result.sort(), expectedMatches.sort(), description);
  }

  let domainFilter = Filter.fromText("example.com##filter1");
  let subdomainFilter = Filter.fromText("www.example.com##filter2");
  let otherDomainFilter = Filter.fromText("other.example.com##filter3");

  CSSRules.add(domainFilter);
  CSSRules.add(subdomainFilter);
  CSSRules.add(otherDomainFilter);
  compareRules(
    "Return all matching filters",
    "www.example.com",
    [domainFilter, subdomainFilter]
  );

  CSSRules.remove(domainFilter);
  compareRules(
    "Return all matching filters after removing one",
    "www.example.com",
    [subdomainFilter]
  );

  CSSRules.clear();
  compareRules(
    "Return no filters after clearing",
    "www.example.com",
    []
  );

  test.done();
};
