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

/* eslint no-new-func: "off" */

"use strict";

const {createSandbox} = require("./_common");

let Snippets = null;
let parseScript = null;
let compileScript = null;
let Filter = null;
let SnippetFilter = null;

exports.setUp = function(callback)
{
  let sandboxedRequire = createSandbox();
  (
    {Filter, SnippetFilter} = sandboxedRequire("../lib/filterClasses"),
    {Snippets, parseScript, compileScript} = sandboxedRequire("../lib/snippets")
  );

  callback();
};

exports.testDomainRestrictions = function(test)
{
  function testScriptMatches(description, filters, domain, expectedMatches)
  {
    for (let filter of filters.map(Filter.fromText))
    {
      if (filter instanceof SnippetFilter)
        Snippets.add(filter);
    }

    let matches = Snippets.getFiltersForDomain(domain).map(
      filter => filter.script
    );
    test.deepEqual(matches.sort(), expectedMatches.sort(), description);

    Snippets.clear();
  }

  testScriptMatches(
    "Ignore generic filters",
    [
      "#$#foo-1", "example.com#$#foo-2",
      "~example.com#$#foo-3"
    ],
    "example.com",
    ["foo-2"]
  );
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
      "www.example.com#$#foo-1",
      "other.example.com#$#foo-2"
    ],
    "other.example.com",
    ["foo-2"]
  );

  test.done();
};

exports.testSnippetFiltersContainer = function(test)
{
  function compareRules(description, domain, expectedMatches)
  {
    let result = Snippets.getFiltersForDomain(domain);
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
  checkParsedScript("Script with blank argument in the middle", "foo '' Hello",
                    [["foo", "", "Hello"]]);
  checkParsedScript("Script with blank argument at the end", "foo Hello ''",
                    [["foo", "Hello", ""]]);
  checkParsedScript("Script with consecutive blank arguments", "foo '' ''",
                    [["foo", "", ""]]);

  // Undocumented quirks (#6853).
  checkParsedScript("Script with quotes within an argument", "foo Hello''world",
                    [["foo", "Helloworld"]]);
  checkParsedScript("Script with quotes within an argument containing whitespace",
                    "foo Hello' 'world",
                    [["foo", "Hello world"]]);
  checkParsedScript("Script with quotes within an argument containing non-whitespace",
                    "foo Hello','world",
                    [["foo", "Hello,world"]]);
  checkParsedScript("Script with quotes within an argument containing whitespace and non-whitespace",
                    "foo Hello', 'world",
                    [["foo", "Hello, world"]]);
  checkParsedScript("Script with opening quote at the beginning of an argument",
                    "foo 'Hello, 'world",
                    [["foo", "Hello, world"]]);
  checkParsedScript("Script with closing quote at the end of an argument",
                    "foo Hello,' world'",
                    [["foo", "Hello, world"]]);

  checkParsedScript("Script with closing quote missing", "foo 'Hello, world",
                    []);
  checkParsedScript("Script with closing quote missing in last command",
                    "foo Hello; bar 'How are you?",
                    [["foo", "Hello"]]);
  checkParsedScript("Script ending with a backslash",
                    "foo Hello; bar 'How are you?' \\",
                    [["foo", "Hello"]]);

  test.done();
};

exports.testScriptCompilation = function(test)
{
  let libraries = [
    `
      let foo = 0;

      exports.setFoo = function(value)
      {
        foo = value;
      };

      exports.assertFoo = function(expected)
      {
        if (foo != expected)
          throw new Error("Value mismatch");
      };
    `
  ];

  let template = `
    "use strict";
    {
      const libraries = ${JSON.stringify(libraries)};

      const script = {{{script}}};

      let imports = Object.create(null);
      for (let library of libraries)
        new Function("exports", library)(imports);

      for (let [name, ...args] of script)
      {
        if (Object.prototype.hasOwnProperty.call(imports, name))
        {
          let value = imports[name];
          if (typeof value == "function")
            value(...args);
        }
      }
    }
  `;

  function verifyExecutable(script)
  {
    let actual = compileScript(script, libraries);
    let expected = template.replace("{{{script}}}",
                                    JSON.stringify(parseScript(script)));

    test.equal(expected, actual);
  }

  verifyExecutable("hello 'How are you?'");

  // Test script execution.
  new Function(compileScript("setFoo 123; assertFoo 123", libraries))();

  // Override setFoo in a second library, without overriding assertFoo. A
  // couple of things to note here: (1) each library has its own variables;
  // (2) script execution is stateless, i.e. the values are not retained
  // between executions. In the example below, assertFoo does not find 456 but
  // it doesn't find 123 either. It's the initial value 0.
  new Function(
    compileScript("setFoo 456; assertFoo 0", [
      ...libraries, "let foo = 1; exports.setFoo = value => { foo = value; };"
    ])
  )();

  test.done();
};
