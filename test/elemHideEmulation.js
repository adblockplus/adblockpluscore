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
const {withNAD} = require("./_test-utils");

let ElemHideEmulationFilter = null;
let ElemHideEmulation = null;
let ElemHide = null;
let Filter = null;

exports.setUp = function(callback)
{
  let sandboxedRequire = createSandbox();
  (
    {Filter,
     ElemHideEmulationFilter} = sandboxedRequire("../lib/filterClasses"),
    {ElemHideEmulation} = sandboxedRequire("../lib/elemHideEmulation"),
    {ElemHide} = sandboxedRequire("../lib/elemHide")
  );

  callback();
};

exports.testElemHideAPI = function(test)
{
  withNAD(0, elemHide =>
  {
    withNAD(0, filter =>
    {
      elemHide.add(filter);
      test.equal(filter.selectorDomain, "");
    })(Filter.fromText("###ads"));

    withNAD(0, unconditionals =>
    {
      test.equal(unconditionals.selectorCount, 1);
      test.equal(unconditionals.selectorAt(0), "#ads");
      test.equal(unconditionals.filterKeyAt(0), "###ads");
    })(elemHide.getUnconditionalSelectors());

    withNAD(0, filter =>
    {
      elemHide.add(filter);
      test.equal(filter.selectorDomain, "example.com");
    })(Filter.fromText("example.com##.foo"));

    withNAD(
      0, unconditionals =>
        test.equal(unconditionals.selectorCount, 1))(elemHide.getUnconditionalSelectors());

    withNAD(0, selectors =>
    {
      test.equal(selectors.selectorCount, 1);
      test.equal(selectors.selectorAt(0), ".foo");
      test.equal(selectors.filterKeyAt(0), "example.com##.foo");
    })(elemHide.getSelectorsForDomain("example.com", 1));

    withNAD(0, selectors =>
    {
      test.equal(selectors.selectorCount, 2);
      test.equal(selectors.selectorAt(0), "#ads");
      test.equal(selectors.filterKeyAt(0), "###ads");
      test.equal(selectors.selectorAt(1), ".foo");
      test.equal(selectors.filterKeyAt(1), "example.com##.foo");
    })(elemHide.getSelectorsForDomain("example.com", 0));

    withNAD(0, filter3 =>
    {
      elemHide.add(filter3);

      withNAD(
        0, selectors =>
          test.equal(selectors.selectorCount, 3))(
        elemHide.getSelectorsForDomain("example.com", 0));

      withNAD(
        0, selectors =>
          test.equal(selectors.selectorCount, 3))(
        elemHide.getSelectorsForDomain("mail.example.com", 0));

      withNAD(0, filter4 =>
      {
        elemHide.add(filter4);
        withNAD(
          0, selectors =>
            test.equal(selectors.selectorCount, 3))(
          elemHide.getSelectorsForDomain("example.com", 0));

        withNAD(
          0, selectors =>
            test.equal(selectors.selectorCount, 2))(
          elemHide.getSelectorsForDomain("mail.example.com", 0));

        withNAD(
          0,
          unconditionals =>
            test.equal(unconditionals.selectorCount, 1))(elemHide.getUnconditionalSelectors());

        elemHide.remove(filter4);
      })(Filter.fromText("mail.example.com#@#.message"));

      withNAD(
        0, selectors =>
          test.equal(selectors.selectorCount, 3))(
        elemHide.getSelectorsForDomain("example.com", 0));

      withNAD(
        0, selectors =>
          test.equal(selectors.selectorCount, 3))(
        elemHide.getSelectorsForDomain("mail.example.com", 0));

      elemHide.remove(filter3);
    })(Filter.fromText("example.com##.message"));

    withNAD(
      0, selectors =>
        test.equal(selectors.selectorCount, 2))(
      elemHide.getSelectorsForDomain("example.com", 0));
  })(ElemHide.create());

  test.done();
};

exports.testDomainRestrictions = function(test)
{
  function testSelectorMatches(description, filters, domain, expectedMatches)
  {
    withNAD([0, 1], (elemHide, elemHideEmulation) =>
    {
      let addFilter = withNAD(0, filter =>
      {
        if (filter instanceof ElemHideEmulationFilter)
          elemHideEmulation.add(filter);
        else
          elemHide.add(filter);
      });

      for (let text of filters)
        addFilter(Filter.fromText(text));

      withNAD(0, rules =>
      {
        let matches = [];
        let push = withNAD(0, filter => matches.push(filter.text));

        for (let i = 0; i < rules.filterCount; i++)
          push(rules.filterAt(i));

        test.deepEqual(matches.sort(), expectedMatches.sort(), description);
      })(elemHideEmulation.getRulesForDomain(elemHide, domain));

      elemHideEmulation.clear();
    })(ElemHide.create(), ElemHideEmulation.create());
  }

  testSelectorMatches(
    "Ignore generic filters",
    [
      "##[-abp-properties='foo']", "example.com##[-abp-properties='foo']",
      "~example.com##[-abp-properties='foo']"
    ],
    "example.com",
    ["example.com##[-abp-properties='foo']"]
  );
  testSelectorMatches(
    "Ignore selectors with exceptions",
    [
      "example.com##[-abp-properties='foo']",
      "example.com##[-abp-properties='bar']",
      "example.com#@#[-abp-properties='foo']"
    ],
    "example.com",
    ["example.com##[-abp-properties='bar']"]
  );
  testSelectorMatches(
    "Ignore filters that include parent domain but exclude subdomain",
    [
      "~www.example.com,example.com##[-abp-properties='foo']"
    ],
    "www.example.com",
    []
  );
  testSelectorMatches(
    "Ignore filters with parent domain if exception matches subdomain",
    [
      "www.example.com#@#[-abp-properties='foo']",
      "example.com##[-abp-properties='foo']"
    ],
    "www.example.com",
    []
  );
  testSelectorMatches(
    "Ignore filters for other subdomain",
    [
      "www.example.com##[-abp-properties='foo']",
      "other.example.com##[-abp-properties='foo']"
    ],
    "other.example.com",
    ["other.example.com##[-abp-properties='foo']"]
  );

  test.done();
};

exports.testElemHideEmulationFiltersContainer = function(test)
{
  withNAD([0, 1], (elemHide, elemHideEmulation) =>
  {
    function compareRules(description, domain, expectedMatches)
    {
      withNAD(0, rules =>
      {
        let result = [];
        for (let i = 0; i < rules.filterCount; i++)
          withNAD(0, filter => result.push(filter.text))(rules.filterAt(i));

        expectedMatches = expectedMatches.map(filter => filter.text);
        test.deepEqual(result.sort(), expectedMatches.sort(), description);
      })(elemHideEmulation.getRulesForDomain(elemHide, domain));
    }

    withNAD([0, 1, 2], (domainFilter, subdomainFilter, otherDomainFilter) =>
    {
      elemHideEmulation.add(domainFilter);
      elemHideEmulation.add(subdomainFilter);
      elemHideEmulation.add(otherDomainFilter);
      compareRules(
        "Return all matching filters",
        "www.example.com",
        [domainFilter, subdomainFilter]
      );

      elemHideEmulation.remove(domainFilter);
      compareRules(
        "Return all matching filters after removing one",
        "www.example.com",
        [subdomainFilter]
      );

      elemHideEmulation.clear();
      compareRules(
        "Return no filters after clearing",
        "www.example.com",
        []
      );
    })(Filter.fromText("example.com##filter1"),
       Filter.fromText("www.example.com##filter2"),
       Filter.fromText("other.example.com##filter3"));
  })(ElemHide.create(), ElemHideEmulation.create());

  test.done();
};
