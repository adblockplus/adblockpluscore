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

let Snippets = null;
let Filter = null;

exports.setUp = function(callback)
{
  let sandboxedRequire = createSandbox();
  (
    {Filter} = sandboxedRequire("../lib/filterClasses"),
    {Snippets} = sandboxedRequire("../lib/snippets")
  );

  callback();
};

exports.testDomainRestrictions = function(test)
{
  function testScriptMatches(description, filters, domain, expectedMatches)
  {
    for (let filter of filters)
      Snippets.add(Filter.fromText(filter));

    let matches = Snippets.getScriptsForDomain(domain);
    test.deepEqual(matches.sort(), expectedMatches.sort(), description);

    Snippets.clear();
  }

  testScriptMatches(
    "Ignore filters that include parent domain but exclude subdomain",
    [
      "~www.example.com,example.com#$#foo"
    ],
    "www.example.com",
    []
  );
  testScriptMatches(
    "Ignore filters for other subdomain",
    [
      "www.example.com#$#foo",
      "other.example.com#$#foo"
    ],
    "other.example.com",
    ["foo"]
  );

  test.done();
};

exports.testSnippetFiltersContainer = function(test)
{
  function compareRules(description, domain, expectedMatches)
  {
    let result = Snippets.getScriptsForDomain(domain);
    expectedMatches = expectedMatches.map(filter => filter.script);
    test.deepEqual(result.sort(), expectedMatches.sort(), description);
  }

  let domainFilter = Filter.fromText("example.com#$#filter1");
  let subdomainFilter = Filter.fromText("www.example.com#$#filter2");
  let otherDomainFilter = Filter.fromText("other.example.com#$#filter3");

  Snippets.add(domainFilter);
  Snippets.add(subdomainFilter);
  Snippets.add(otherDomainFilter);
  compareRules(
    "Return all matching filters",
    "www.example.com",
    [domainFilter, subdomainFilter]
  );

  Snippets.remove(domainFilter);
  compareRules(
    "Return all matching filters after removing one",
    "www.example.com",
    [subdomainFilter]
  );

  Snippets.clear();
  compareRules(
    "Return no filters after clearing",
    "www.example.com",
    []
  );

  test.done();
};
