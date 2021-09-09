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

const assert = require("assert");
const {createSandbox} = require("./_common");

let snippets = null;
let parseScript = null;
let compileScript = null;
let Filter = null;
let SnippetFilter = null;

describe("Snippets", function() {
  beforeEach(function() {
    let sandboxedRequire = createSandbox();
    (
      {Filter, SnippetFilter} = sandboxedRequire("../lib/filterClasses"),
      {snippets, parseScript, compileScript} = sandboxedRequire("../lib/snippets")
    );
  });

  it("Domain restrictions", function() {
    function testScriptMatches(description, filters, domain, expectedMatches) {
      for (let filter of filters.map(Filter.fromText)) {
        if (filter instanceof SnippetFilter)
          snippets.add(filter);
      }

      let matches = snippets.getFilters(domain).map(filter => filter.script);
      assert.deepEqual(matches.sort(), expectedMatches.sort(), description);

      snippets.clear();
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
  });

  it("Filters container", function() {
    let events = [];

    function eventHandler(...args) {
      events.push([...args]);
    }

    function compareRules(description, domain, expectedMatches) {
      let result = snippets.getFilters(domain);
      assert.deepEqual(result.sort(), expectedMatches.sort(), description);
    }

    snippets.on("snippets.filterAdded",
                eventHandler.bind(null, "snippets.filterAdded"));
    snippets.on("snippets.filterRemoved",
                eventHandler.bind(null, "snippets.filterRemoved"));
    snippets.on("snippets.filtersCleared",
                eventHandler.bind(null, "snippets.filtersCleared"));

    let domainFilter = Filter.fromText("example.com#$#filter1");
    let subdomainFilter = Filter.fromText("www.example.com#$#filter2");
    let otherDomainFilter = Filter.fromText("other.example.com#$#filter3");

    snippets.add(domainFilter);
    snippets.add(subdomainFilter);
    snippets.add(otherDomainFilter);
    compareRules(
      "Return all matching filters",
      "www.example.com",
      [domainFilter, subdomainFilter]
    );

    snippets.remove(domainFilter);
    compareRules(
      "Return all matching filters after removing one",
      "www.example.com",
      [subdomainFilter]
    );

    snippets.clear();
    compareRules(
      "Return no filters after clearing",
      "www.example.com",
      []
    );

    assert.deepEqual(
      events, [
        ["snippets.filterAdded", domainFilter],
        ["snippets.filterAdded", subdomainFilter],
        ["snippets.filterAdded", otherDomainFilter],
        ["snippets.filterRemoved", domainFilter],
        ["snippets.filtersCleared"]
      ], "Event log"
    );
  });

  it("Script parsing", function() {
    function checkParsedScript(description, script, expectedTree) {
      let tree = parseScript(script);
      assert.deepEqual(tree, expectedTree, description);
    }

    checkParsedScript("Script with no arguments", "foo", [["foo"]]);
    checkParsedScript("Script with one argument", "foo 1", [["foo", "1"]]);
    checkParsedScript("Script with two arguments", "foo 1 Hello", [["foo", "1", "Hello"]]);
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
                      "'l\\ud83d\\ude02mbd\\ud83d\\ude02'",
                      [
                        ["foo", "b\ud83d\ude42r", "l\ud83d\ude02mbd\ud83d\ude02"]
                      ]);
    checkParsedScript("Script with multiple commands", "foo; bar", [["foo"], ["bar"]]);
    checkParsedScript("Script with multiple commands and multiple arguments each",
                      "foo 1 Hello; bar world! #",
                      [["foo", "1", "Hello"], ["bar", "world!", "#"]]);
    checkParsedScript("Script with multiple commands and multiple " +
                      "escaped and quoted arguments each",
                      "foo 1 'Hello, \\'Tommy\\'!' ;" +
                      "bar Hi!\\ How\\ are\\ you? http://example.com",
                      [
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
    checkParsedScript("Script with no-op commands", "foo; ;;; ;  ; bar 1", [["foo"], ["bar", "1"]]);
    checkParsedScript("Script with blank argument in the middle", "foo '' Hello", [["foo", "", "Hello"]]);
    checkParsedScript("Script with blank argument at the end", "foo Hello ''", [["foo", "Hello", ""]]);
    checkParsedScript("Script with consecutive blank arguments", "foo '' ''", [["foo", "", ""]]);

    // Undocumented quirks (#6853).
    checkParsedScript("Script with quotes within an argument", "foo Hello''world", [["foo", "Helloworld"]]);
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

    checkParsedScript("Script with closing quote missing", "foo 'Hello, world", []);
    checkParsedScript("Script with closing quote missing in last command",
                      "foo Hello; bar 'How are you?",
                      [["foo", "Hello"]]);
    checkParsedScript("Script ending with a backslash",
                      "foo Hello; bar 'How are you?' \\",
                      [["foo", "Hello"]]);
  });

  it("Script compilation", function() {
    let environment = {tricky: "'", condition: "\"\n"};

    let isolatedLib = `
      let foo = "foo" in environment ? environment.foo : 0;
      let snippets = {};

      snippets.setFoo = function(value)
      {
        foo = value;
      };

      snippets.assertFoo = function(expected)
      {
        if (foo != expected)
          throw new Error("Value mismatch");
      };

      exports.snippets = snippets;
    `;

    let injectedLib = `
      let foo = "foo" in environment ? environment.foo : 0;
      let snippets = {};

      snippets.injectedSetFoo = function(value)
      {
        foo = value;
      };

      snippets.injectedAssertFoo = function(expected)
      {
        if (foo != expected)
          throw new Error("Value mismatch");
      };
    `;
    let injectedSnippetsList = ["injectedSetFoo", "injectedAssertFoo"];

    let template = `
    "use strict";
    (() => 
    {
      let scripts = {{{script}}};

      let isolatedLib = ${JSON.stringify(isolatedLib)};
      let imports = Object.create(null);
      let injectedSnippetsCount = 0;
      let loadLibrary = new Function("exports", "environment", isolatedLib);
      loadLibrary(imports, ${JSON.stringify(environment)});
      const isolatedSnippets = imports.snippets;

      let injectedLib = ${JSON.stringify(injectedLib)};
      let injectedSnippetsList = ${JSON.stringify(injectedSnippetsList)};
      let executable = "(() => {";
      executable += "let environment = {\\"tricky\\":\\"'\\",\\"condition\\":\\"\\\\\\"\\\\n\\"};";
      executable += injectedLib;

      let {hasOwnProperty} = Object.prototype;
      for (let script of scripts)
      {
        for (let [name, ...args] of script)
        {
          if (hasOwnProperty.call(isolatedSnippets, name))
          {
            let value = isolatedSnippets[name];
            if (typeof value == "function")
              value(...args);
          }
          if (injectedSnippetsList.includes(name))
          {
            executable += stringifyFunctionCall(name, ...args);
            injectedSnippetsCount++;
          }
        }
      }

      executable += "})();";

      if (injectedSnippetsCount > 0)
        injectSnippetsInMainContext(executable);

      function stringifyFunctionCall(func, ...params)
      {
        // Call JSON.stringify on the arguments to avoid any arbitrary code
        // execution.
        const f = "snippets['" + func + "']";
        const parameters = params.map(JSON.stringify).join(",");
        return f + "(" + parameters + ");";
      }

      function injectSnippetsInMainContext(exec)
      {
        // injecting phase
        let script = document.createElement("script");
        script.type = "application/javascript";
        script.async = false;

        // Firefox 58 only bypasses site CSPs when assigning to 'src',
        // while Chrome 67 and Microsoft Edge (tested on 44.17763.1.0)
        // only bypass site CSPs when using 'textContent'.
        if (typeof netscape != "undefined" && typeof browser != "undefined")
        {
          let url = URL.createObjectURL(new Blob([executable]));
          script.src = url;
          document.documentElement.appendChild(script);
          URL.revokeObjectURL(url);
        }
        else
        {
          script.textContent = executable;
          document.documentElement.appendChild(script);
        }

        document.documentElement.removeChild(script);
      }
    })();
  `;

    function verifyExecutable(script) {
      let actual = compileScript(script, isolatedLib, injectedLib, injectedSnippetsList, environment);
      let parsed = [].concat(script).map(parseScript);
      let expected = template.replace("{{{script}}}", JSON.stringify(parsed));

      assert.equal(expected, actual);
    }

    verifyExecutable(["hello 'How are you?'", "hello 'Fine, thanks!'"]);

    // Test script execution.
    new Function(compileScript("assertFoo 0", isolatedLib, injectedLib, injectedSnippetsList, environment))();
    new Function(compileScript("setFoo 123; assertFoo 123", isolatedLib, injectedLib, injectedSnippetsList, environment))();

    new Function(compileScript("assertFoo 123", isolatedLib, injectedLib, injectedSnippetsList, {foo: 123}))();
  });
});
