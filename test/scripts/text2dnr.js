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
const path = require("path");
const fs = require("fs/promises");
const {spawn} = require("child_process");
const {createConverter} = require("../../lib/dnr/index.js");
const {validRuleOrError, validateIsAsciiOnly} = require("../../lib/dnr/rules.js");

const {
  parseArgs, processFile
} = require("../../scripts/text2dnr.js");

describe("text2dnr script", function() {
  function assertIsInvalid(rule, str) {
    assert.deepEqual(validRuleOrError(rule), Error(`non_ascii_characters in "${str}"`));
  }

  function assertIsValid(rule) {
    assert.equal(validRuleOrError(rule), rule);
  }

  it("Parses the command line", function() {
    let result = parseArgs(["node", "text2dnr", "-o", "foo.json", "filters.txt"]);
    assert.equal(result.outputfile, "foo.json");
    assert.equal(result.filename, "filters.txt");

    result = parseArgs(["node", "text2dnr", "filters.txt"]);
    assert(typeof result.outputfile == "undefined");
    assert.equal(result.filename, "filters.txt");
  });

  it("Error on incorrect argument", function() {
    // Since we are testing the command line parsing and `yarg` will
    // output text in the console, we disable the console.
    let oldConsole = console;
    // eslint-disable-next-line no-global-assign
    console = {};

    assert.throws(() => parseArgs(["node", "text2dnr"]));
    assert.throws(() => parseArgs(["node", "text2dnr", "-o", "foo.json"]), Error);
    // eslint-disable-next-line no-global-assign
    console = oldConsole;
  });

  it("Error with missing filter file", async function() {
    await assert.rejects(async() => await processFile(path.join(__dirname, "..", "data", "filters2.txt"), "foo.json"));
  });

  it("Produces the JSON file", async function() {
    let outputfile = "foo.json";
    await processFile(
      createConverter({}),
      path.join(__dirname, "..", "data", "filters.txt"),
      outputfile
    );
    await fs.access(outputfile);
    await fs.rm(outputfile);
  });

  it("Uses rule modify callback", async function() {
    let outputFile = "foo2.json";
    let id = 0;
    await processFile(
      createConverter({
        modifyRule(rule) {
          rule["id"] = ++id;
          return rule;
        }
      }),
      path.join(__dirname, "..", "data", "filters.txt"),
      outputFile
    );
    await fs.access(outputFile);
    assert.equal(id > 0, true);

    let json = await fs.readFile(outputFile, {encoding: "utf-8"});
    let rules = JSON.parse(json);
    let actualId = 0;
    for (let rule of rules) {
      assert.equal(typeof rule["id"], "number");
      assert.equal(rule["id"], ++actualId);
    }
    await fs.rm(outputFile);
  });

  it("Uses regex rule validate callback", async function() {
    let outputFile = "foo2.json";
    let validatorCalled = false;
    let converter = createConverter({
      isRegexSupported(rule) {
        validatorCalled = true;
        return false;
      }
    });
    await processFile(
      converter,
      path.join(__dirname, "..", "data", "regex_filters.txt"),
      outputFile
    );
    await fs.access(outputFile);
    assert.equal(validatorCalled, true);

    let json = await fs.readFile(outputFile, {encoding: "utf-8"});
    let rules = JSON.parse(json);
    assert.equal(rules.length, 0);
    await fs.rm(outputFile);
  });

  it("filters invalid rules internally", async function() {
    let outputFile = "foo3.json";
    let validatorCalled = false;
    let converter = createConverter({
      isRegexSupported(rule) {
        validatorCalled = true;
        return false;
      }
    });
    await processFile(
      converter,
      path.join(__dirname, "..", "data", "invalid_filters.txt"),
      outputFile
    );
    await fs.access(outputFile);
    assert.equal(validatorCalled, true);

    let json = await fs.readFile(outputFile, {encoding: "utf-8"});
    let rules = JSON.parse(json);
    assert.deepEqual(rules, [{
      action: {
        type: "block"
      },
      condition: {
        urlFilter: "https://www.abc.com"
      },
      priority: 1000
    }]);
    await fs.rm(outputFile);
  });

  it("Produces the JSON on stdout", function(done) {
    // We'll use a child_process.
    let written = "";
    let proc = spawn("node", [
      path.join(__dirname, "..", "..", "scripts", "text2dnr.js"),
      path.join(__dirname, "..", "data", "filters.txt")
    ]);

    proc.stdout.on("data", chunk => {
      written += chunk.toString();
    });

    proc.on("error", err => {
      assert.ok(false, `Raised an error: ${err}`);
    });

    proc.on("exit", code => {
      assert.equal(code, 0);
      assert.ok(written.length > 0);

      // Check the output is valid JSON.
      let obj = JSON.parse(written);
      assert.ok(obj instanceof Array);

      done();
    });
  });

  it("Treats domains encoding properly", function() {
    validateIsAsciiOnly("http://abc.com");
    validateIsAsciiOnly("http://abc.xn--p1ai/?q=%D1%84"); // punycode;
    assert.throws(() => validateIsAsciiOnly("http://abc.рф"), Error); // national character in domain
    assert.throws(() => validateIsAsciiOnly("http://abc.com?q=ф"), Error); // national character in path
  });

  it("Filters invalid rules", function() {
    const NON_ASCII_DOMAIN = "abc.рф";
    assertIsInvalid({
      condition: {
        urlFilter: `||${NON_ASCII_DOMAIN}/adsman/`
      }
    }, `||${NON_ASCII_DOMAIN}/adsman/`);
    assertIsInvalid({
      condition: {
        regexFilter: NON_ASCII_DOMAIN
      }
    }, NON_ASCII_DOMAIN);
    assertIsInvalid({
      condition: {
        initiatorDomains: [NON_ASCII_DOMAIN]
      }
    }, NON_ASCII_DOMAIN);
    assertIsInvalid({
      condition: {
        requestDomains: [NON_ASCII_DOMAIN]
      }
    }, NON_ASCII_DOMAIN);
    assertIsInvalid({
      condition: {
        domains: [NON_ASCII_DOMAIN]
      }
    }, NON_ASCII_DOMAIN);
    assertIsInvalid({
      condition: {
        excludedDomains: [NON_ASCII_DOMAIN]
      }
    }, NON_ASCII_DOMAIN);
    assertIsInvalid({
      condition: {
        excludedInitiatorDomains: [NON_ASCII_DOMAIN]
      }
    }, NON_ASCII_DOMAIN);
    assertIsInvalid({
      condition: {
        excludedRequestDomains: [NON_ASCII_DOMAIN]
      }
    }, NON_ASCII_DOMAIN);
  });

  it("Does not filter valid rules", function() {
    assertIsValid({
      "priority": 1001,
      "condition": {
        "urlFilter": "http://abc.com",
        "isUrlFilterCaseSensitive": false
      },
      "action": {
        "type": "block"
      },
      "id": 2
    });
    assertIsValid({
      "priority": 1001,
      "condition": {
        "regexFilter": "http://abc.com",
        "isUrlFilterCaseSensitive": false
      },
      "action": {
        "type": "block"
      },
      "id": 2
    });
    assertIsValid({
      "priority": 1000,
      "condition": {
        "urlFilter": "http://abc.xn--?q=-zedud", // punycode
        "isUrlFilterCaseSensitive": false
      },
      "action": {
        "type": "block"
      },
      "id": 1
    });
    assertIsValid({
      "priority": 1000,
      "condition": {
        "regexFilter": "http://abc.xn--?q=-zedud", // punycode
        "isUrlFilterCaseSensitive": false
      },
      "action": {
        "type": "block"
      },
      "id": 1
    });
  });
});
