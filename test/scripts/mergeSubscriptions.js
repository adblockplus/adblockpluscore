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
  existsSync,
  promises: {readFile, rm, mkdtemp, writeFile}
} = require("fs");
const os = require("os");
const path = require("path");

const {merge} = require("../../scripts/mergeSubscriptions");

describe("mergeSubscriptions script", function() {
  let tmpDir;

  beforeEach(async function() {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "tmp-"));
  });

  afterEach(async function() {
    if (existsSync(tmpDir))
      await rm(tmpDir, {recursive: true});
  });

  function randomTmpFile() {
    return path.join(tmpDir, "inFile-" + (Math.random() + 1).toString(36).substring(7) + ".json");
  }

  async function assertSubscriptionsContent(space, inContents, expectedOutContent) {
    await assertSubscriptions(space, inContents, function(actualOutContent) {
      assert.strictEqual(actualOutContent.toString(), expectedOutContent);
    });
  }

  async function assertSubscriptions(space, inContents, assertCallback) {
    let fromFiles = [];
    for (let inContent of inContents) {
      let fromFile = randomTmpFile();
      fromFiles.push(fromFile);
      await writeFile(fromFile, inContent);
    }
    let toFile = randomTmpFile();
    await merge(fromFiles, toFile, space);
    assertCallback(await readFile(toFile));
  }

  it("should merge empty array files", async function() {
    await assertSubscriptionsContent(null, ["[]", "[]"], "[]");
  });

  it("should process single file", async function() {
    let content = "[{\"title\":\"some_title\"}]";
    await assertSubscriptionsContent(null, [content], content);
  });

  async function assertMultipleSubscriptions(count) {
    let contents = [];
    let fieldName = "title";
    let fieldValue = "value";
    for (let i = 0; i < count; i++)
      contents.push(`[{"${fieldName}${i}": "${fieldValue}${i}"}]`);

    await assertSubscriptions(null, contents, function(actualContent) {
      let obj = JSON.parse(actualContent);
      assert.strictEqual(obj.length, count);
      for (let i = 0; i < count; i++)
        assert.notEqual(obj.find(item => item[fieldName + i] === (fieldValue + i)), -1);
    });
  }

  it("should merge two files", async function() {
    await assertMultipleSubscriptions(2);
  });

  it("should merge three files", async function() {
    await assertMultipleSubscriptions(3);
  });

  it("should use space", async function() {
    let content = "[{\"a\":\"b\"}]";
    await assertSubscriptionsContent(null, [content], content);
    await assertSubscriptionsContent(2, [content], "[\n  {\n    \"a\": \"b\"\n  }\n]");
    await assertSubscriptionsContent(4, [content], "[\n    {\n        \"a\": \"b\"\n    }\n]");
  });

  it("should throw on missing file", async function() {
    let missingInFile = randomTmpFile();
    let outFile = randomTmpFile();
    assert.strictEqual(existsSync(missingInFile), false);
    await assert.rejects(async() => merge([missingInFile], outFile), Error);
  });
});
