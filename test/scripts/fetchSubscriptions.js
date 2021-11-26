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
  existsSync, writeFileSync, mkdirSync, readdirSync,
  promises: {readFile, rmdir, mkdtemp}
} = require("fs");
const os = require("os");
const path = require("path");
const nock = require("nock");

const {fetchSubscriptions} = require("../../scripts/fetchSubscriptions");

const encoding = "utf-8";

describe("fetchSubscriptions script", function() {
  let tmpDir;
  let outDir;
  let originalConsole;
  let warnings;

  function mockedConsoleWarn(message) {
    warnings.push(message);
  }

  function createFile(dir, data) {
    let file = path.join(dir, "subscriptions.json");
    writeFileSync(file, data);
    return file;
  }

  beforeEach(async function() {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "rules-"));
    outDir = path.join(tmpDir, "outDir");
    originalConsole = console;
    console.warn = mockedConsoleWarn;
    warnings = [];
  });

  afterEach(async function() {
    if (existsSync(tmpDir))
      await rmdir(tmpDir, {recursive: true});
    console = originalConsole;
  });

  it("should throw an error if input file does not exist", async function() {
    let file = path.join(tmpDir, "someNotExistingFile");
    await assert.rejects(async() => fetchSubscriptions(file, outDir), Error);
  });

  it("should create output directory if it does not exist", async function() {
    let subscriptionsFile = createFile(tmpDir, "[]");
    assert.strictEqual(existsSync(outDir), false);
    await fetchSubscriptions(subscriptionsFile, outDir);
    assert.strictEqual(existsSync(outDir), true);
  });

  it("should clean existing output directory", async function() {
    let subscriptionsFile = createFile(tmpDir, "[]");
    mkdirSync(outDir);
    let existingFetchedFile = createFile(outDir, "");
    assert.strictEqual(existsSync(existingFetchedFile), true);
    await fetchSubscriptions(subscriptionsFile, outDir);
    assert.strictEqual(existsSync(existingFetchedFile), false);
  });

  it("should fetch single subscription", async function() {
    const urlPath = "/test_subscription.txt";
    const data = "subscription data";
    const origin = "http://localhost";
    const subscriptionsFile = createFile(tmpDir, "[{\n" +
      "    \"type\": \"ads\",\n" +
      "    \"languages\": [\n" +
      "      \"en\"\n" +
      "    ],\n" +
      "    \"title\": \"Test Subscription\",\n" +
      "    \"url\": \"" + origin + urlPath + "\",\n" +
      "    \"homepage\": \"https://easylist.to/\"\n" +
      "  }]");

    nock(origin).get(urlPath).reply(200, data);

    mkdirSync(outDir);
    await fetchSubscriptions(subscriptionsFile, outDir);
    let files = readdirSync(outDir);
    assert.strictEqual(files.length, 1);
    assert.deepEqual(
      await readFile(path.join(outDir, files[0])),
      Buffer.from(data, encoding));
  });

  it("should fetch multiple subscriptions", async function() {
    const urlPath1 = "/test_subscription1.txt";
    const data1 = "subscription data 1";
    const urlPath2 = "/test_subscription2.txt";
    const data2 = "subscription data 2";
    const origin = "http://localhost";

    const subscriptionsFile = createFile(tmpDir, "[{\n" +
      "    \"type\": \"ads\",\n" +
      "    \"languages\": [\n" +
      "      \"en\"\n" +
      "    ],\n" +
      "    \"title\": \"Test Subscription 1\",\n" +
      "    \"url\": \"" + origin + urlPath1 + "\",\n" +
      "    \"homepage\": \"https://easylist.to/\"\n" +
      "  }, {\n" +
      "    \"type\": \"ads\",\n" +
      "    \"languages\": [\n" +
      "      \"en\"\n" +
      "    ],\n" +
      "    \"title\": \"Test Subscription 2\",\n" +
      "    \"url\": \"" + origin + urlPath2 + "\",\n" +
      "    \"homepage\": \"https://easylist.to/\"\n" +
      "  }]");

    nock(origin).get(urlPath1).reply(200, data1);
    nock(origin).get(urlPath2).reply(200, data2);

    mkdirSync(outDir);
    await fetchSubscriptions(subscriptionsFile, outDir);
    let files = readdirSync(outDir);
    assert.strictEqual(files.length, 2);
    assert.deepEqual(
      await readFile(path.join(outDir, files[0])),
      Buffer.from(data1, encoding));
    assert.deepEqual(
      await readFile(path.join(outDir, files[1])),
      Buffer.from(data2, encoding));
  });

  it("should fail on http error", async function() {
    const origin = "http://localhost";
    const urlPath = "/test_subscription.txt";
    const subscriptionsFile = createFile(tmpDir, "[{\n" +
      "    \"type\": \"ads\",\n" +
      "    \"languages\": [\n" +
      "      \"en\"\n" +
      "    ],\n" +
      "    \"title\": \"Test Subscription\",\n" +
      "    \"url\": \"" + origin + urlPath + "\",\n" +
      "    \"homepage\": \"https://easylist.to/\"\n" +
      "  }]");

    nock(origin).get(urlPath).reply(404); // simulate HTTP error

    mkdirSync(outDir);
    await assert.rejects(async() => fetchSubscriptions(subscriptionsFile, outDir));
  });
});
