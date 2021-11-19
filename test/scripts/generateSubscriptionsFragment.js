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
const {
  existsSync, openSync,
  promises: {rmdir, mkdtemp}
} = require("fs");
const os = require("os");
const path = require("path");

const {generateFragment} = require("../../scripts/generateSubscriptionsFragment");

describe("Script", function() {
  let tmpDir;
  let originalConsole;
  let warnings;

  function mockedConsoleWarn(message) {
    warnings.push(message);
  }

  beforeEach(async function() {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "rules-"));
    originalConsole = console;
    console.warn = mockedConsoleWarn;
    warnings = [];
  });

  afterEach(async function() {
    if (existsSync(tmpDir))
      await rmdir(tmpDir, {recursive: true});
    console = originalConsole;
  });

  function createRuleFile(filename) {
    openSync(path.join(tmpDir, filename), "w");
  }

  function getRulesArrayFrom(dir) {
    return JSON.parse(generateFragment(dir, null)).rule_resources;
  }

  it("should throw an error if rules directory does not exist", async function() {
    await rmdir(tmpDir, {recursive: true});
    assert.throws(() => generateFragment(tmpDir), Error);
  });

  it("should return empty array for empty dir", async function() {
    assert.strictEqual(
      generateFragment(tmpDir, null),
      "{\"rule_resources\":[]}");
  });

  it("should warn on empty dir", async function() {
    assert.strictEqual(warnings.length, 0);
    assert.strictEqual(
      generateFragment(tmpDir, null),
      "{\"rule_resources\":[]}");
    assert.strictEqual(warnings.length, 1);
  });

  it("should return ignore not .json files", async function() {
    createRuleFile("jsfile.js");
    assert.strictEqual(
      generateFragment(tmpDir, null),
      "{\"rule_resources\":[]}");
  });

  it("should warn on not .json files", async function() {
    assert.strictEqual(warnings.length, 0);
    createRuleFile("jsfile.js");
    createRuleFile("file.json");
    generateFragment(tmpDir, null);
    assert.strictEqual(warnings.length, 1);
  });

  it("should return single rule", async function() {
    createRuleFile("singleFile.json");
    assert.strictEqual(
      generateFragment(tmpDir, null),
      "{\"rule_resources\":[{\"id\":\"singleFile\",\"enabled\":false,\"path\":\"singleFile.json\"}]}");
  });

  it("should return valid rule id", async function() {
    // assuming file name without extension is taken as rule id
    const baseFilename = "singleFile";
    createRuleFile(baseFilename + ".json");
    assert.strictEqual(getRulesArrayFrom(tmpDir)[0].id, baseFilename);
  });

  it("should return rules disabled by default", async function() {
    createRuleFile("singleFile.json");
    assert.strictEqual(getRulesArrayFrom(tmpDir)[0].enabled, false);
  });

  it("should return proper file path", async function() {
    const filename = "singleFile.json";
    createRuleFile(filename);
    assert.strictEqual(getRulesArrayFrom(tmpDir)[0].path, filename);
  });

  it("should return multiple rules", async function() {
    createRuleFile("multipleFile1.json");
    createRuleFile("multipleFile2.json");
    assert.strictEqual(getRulesArrayFrom(tmpDir).length, 2);
  });

  it("should prettify JSON if space is passed", async function() {
    createRuleFile("file.json");
    assert.strictEqual(
      generateFragment(tmpDir, null),
      "{\"rule_resources\":[{\"id\":\"file\",\"enabled\":false,\"path\":\"file.json\"}]}");
    assert.strictEqual(
      generateFragment(tmpDir, 2),
      "{\n" +
      "  \"rule_resources\": [\n" +
      "    {\n" +
      "      \"id\": \"file\",\n" +
      "      \"enabled\": false,\n" +
      "      \"path\": \"file.json\"\n" +
      "    }\n" +
      "  ]\n" +
      "}");
    assert.strictEqual(
      generateFragment(tmpDir, "\t"),
      "{\n" +
      "\t\"rule_resources\": [\n" +
      "\t\t{\n" +
      "\t\t\t\"id\": \"file\",\n" +
      "\t\t\t\"enabled\": false,\n" +
      "\t\t\t\"path\": \"file.json\"\n" +
      "\t\t}\n" +
      "\t]\n" +
      "}");
  });
});
