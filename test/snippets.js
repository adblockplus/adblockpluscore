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
let parseScript = null;
let Filter = null;

exports.setUp = function(callback)
{
  let sandboxedRequire = createSandbox();
  (
    {Filter} = sandboxedRequire("../lib/filterClasses"),
    {Snippets, parseScript} = sandboxedRequire("../lib/snippets")
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

exports.testScriptParsing = function(test)
{
  function checkParsedScript(description, script, expectedTree)
  {
    let tree = parseScript(script);
    test.deepEqual(tree, expectedTree, description);
  }

  checkParsedScript("Script with no arguments", "foo", [["foo"]]);
  checkParsedScript("Script with one argument", "foo 1", [["foo", "1"]]);
  checkParsedScript("Script with two arguments", "foo 1 Hello",
                    [["foo", "1", "Hello"]]);
  checkParsedScript("Script with argument containing an escaped space",
                    "foo Hello\\ world",
                    [["foo", "Hello world"]]);
  checkParsedScript("Script with argument containing a quoted space",
                    "foo 'Hello world'",
                    [["foo", "Hello world"]]);
  checkParsedScript("Script with argument containing a quoted escaped quote",
                    "foo 'Hello \\'world\\''",
                    [["foo", "Hello 'world'"]]);
  checkParsedScript("Script with argument containing an escaped semicolon",
                    "foo TL\\;DR",
                    [["foo", "TL;DR"]]);
  checkParsedScript("Script with argument containing a quoted semicolon",
                    "foo 'TL;DR'",
                    [["foo", "TL;DR"]]);
  checkParsedScript("Script with argument containing single character " +
                    "escape sequences",
                    "foo yin\\tyang\\n",
                    [["foo", "yin\tyang\n"]]);
  checkParsedScript("Script with argument containing Unicode escape sequences",
                    "foo \\u0062\\ud83d\\ude42r " +
                    "'l\\ud83d\\ude02mbd\\ud83d\\ude02'", [
                      ["foo", "b\ud83d\ude42r", "l\ud83d\ude02mbd\ud83d\ude02"]
                    ]);
  checkParsedScript("Script with multiple commands", "foo; bar",
                    [["foo"], ["bar"]]);
  checkParsedScript("Script with multiple commands and multiple arguments each",
                    "foo 1 Hello; bar world! #",
                    [["foo", "1", "Hello"], ["bar", "world!", "#"]]);
  checkParsedScript("Script with multiple commands and multiple " +
                    "escaped and quoted arguments each",
                    "foo 1 'Hello, \\'Tommy\\'!' ;" +
                    "bar Hi!\\ How\\ are\\ you? http://example.com", [
                      ["foo", "1", "Hello, 'Tommy'!"],
                      ["bar", "Hi! How are you?", "http://example.com"]
                    ]);
  checkParsedScript("Script with command names containing " +
                    "whitespace (spaces, tabs, newlines, etc.), " +
                    "quotes, and semicolons",
                    "fo\\'\\ \\ \\\t\\\n\\;o 1 2 3; 'b a  r' 1 2",
                    [["fo'  \t\n;o", "1", "2", "3"], ["b a  r", "1", "2"]]);
  checkParsedScript("Script containing Unicode composite characters",
                    "f\ud83d\ude42\ud83d\ude42 b\ud83d\ude02r",
                    [["f\ud83d\ude42\ud83d\ude42", "b\ud83d\ude02r"]]);
  checkParsedScript("Script with no-op commands", "foo; ;;; ;  ; bar 1",
                    [["foo"], ["bar", "1"]]);

  test.done();
};
