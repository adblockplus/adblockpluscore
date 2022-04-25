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

const {
  parseArgs, processFile
} = require("../../scripts/text2dnr.js");

describe("text2dnr script", function() {
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
      path.join(__dirname, "..", "data", "filters.txt"),
      outputFile,
      rule => {
        rule["id"] = ++id;
        return rule;
      }
    );
    await fs.access(outputFile);
    assert.equal(id > 0, true);

    let json = await fs.readFile(outputFile, {encoding: "utf-8"});
    let rules = JSON.parse(json);
    for (let rule of rules)
      assert.equal(typeof rule["id"], "number");
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

      // Checke the ouput is valid JSON.
      let obj = JSON.parse(written);
      assert.ok(obj instanceof Array);

      done();
    });
  });
});
