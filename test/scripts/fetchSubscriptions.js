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
  promises: {readFile, rm, mkdtemp}
} = require("fs");
const os = require("os");
const path = require("path");
const nock = require("nock");

const {fetchSubscriptions, getSubscriptionFile} =
  require("../../scripts/fetchSubscriptions");

const ENCODING = "utf-8";

describe("fetchSubscriptions script", function() {
  let tmpDir;
  let outDir;
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
    console.warn = mockedConsoleWarn;
    warnings = [];
  });

  afterEach(async function() {
    if (existsSync(tmpDir))
      await rm(tmpDir, {recursive: true});
  });

  it("should throw an error if input file does not exist", async function() {
    let file = path.join(tmpDir, "someNotExistingFile");
    await assert.rejects(async() => fetchSubscriptions(file, outDir));
  });

  it("should create output directory if it does not exist", async function() {
    let subscriptionsFile = createFile(tmpDir, "[]");
    assert.strictEqual(existsSync(outDir), false);
    await fetchSubscriptions(subscriptionsFile, outDir);
    assert.strictEqual(existsSync(outDir), true);
  });

  it("should warn on existing output directory", async function() {
    let subscriptionsFile = createFile(tmpDir, "[]");
    mkdirSync(outDir);
    let existingFetchedFile = createFile(outDir, "");
    assert.strictEqual(existsSync(existingFetchedFile), true);
    assert.strictEqual(warnings.length, 0);
    await fetchSubscriptions(subscriptionsFile, outDir);
    assert.strictEqual(warnings[0], "The output directory exists");
  });

  it("should fetch single subscription", async function() {
    const urlPath = "/test_subscription.txt";
    const data = "subscription data";
    const origin = "http://localhost";
    const subscriptionsFile = createFile(tmpDir,
      `[{
        "type": "ads",
        "languages": [
          "en"
        ],
        "title": "Test Subscription",
        "url": "${origin + urlPath}",
        "homepage": "https://easylist.to/"
      }]`);

    nock(origin).get(urlPath).reply(200, data);

    mkdirSync(outDir);
    await fetchSubscriptions(subscriptionsFile, outDir);
    let files = readdirSync(outDir);
    assert.strictEqual(files.length, 1);
    assert.deepEqual(
      await readFile(path.join(outDir, files[0])),
      Buffer.from(data, ENCODING));
  });

  it("should fetch multiple subscriptions", async function() {
    const urlPath1 = "/test_subscription1.txt";
    const data1 = "subscription data 1";
    const urlPath2 = "/test_subscription2.txt";
    const data2 = "subscription data 2";
    const origin = "http://localhost";

    const subscriptionsFile = createFile(tmpDir,
      `[{
        "type": "ads",
        "languages": [
          "en"
        ],
        "title": "Test Subscription 1",
        "url": "${origin + urlPath1}",
        "homepage": "https://easylist.to/"
      }, {
        "type": "ads",
        "languages": [
          "en"
        ],
        "title": "Test Subscription 2",
        "url": "${origin + urlPath2}",
        "homepage": "https://easylist.to/"
      }]`);

    nock(origin).get(urlPath1).reply(200, data1);
    nock(origin).get(urlPath2).reply(200, data2);

    mkdirSync(outDir);
    await fetchSubscriptions(subscriptionsFile, outDir);
    let files = readdirSync(outDir);
    assert.strictEqual(files.length, 2);
    assert.deepEqual(
      await readFile(path.join(outDir, files[0])),
      Buffer.from(data1, ENCODING));
    assert.deepEqual(
      await readFile(path.join(outDir, files[1])),
      Buffer.from(data2, ENCODING));
  });

  it("should fail on HTTP error", async function() {
    const origin = "http://localhost";
    const urlPath = "/test_subscription.txt";
    const subscriptionsFile = createFile(tmpDir,
      `[{
        "type": "ads",
        "languages": [
          "en"
        ],
        "title": "Test Subscription",
        "url": "${origin + urlPath}",
        "homepage": "https://easylist.to/"
      }]`);

    nock(origin).get(urlPath).reply(404); // simulate HTTP error

    mkdirSync(outDir);
    await assert.rejects(async() => fetchSubscriptions(subscriptionsFile, outDir));
  });

  it("should fail on file error", async function() {
    const origin = "http://localhost";
    const urlPath = "/test_subscription.txt";
    const data1 = "subscription data 1";
    const url = origin + urlPath;
    const subscriptionsFile = createFile(tmpDir,
      `[{
        "type": "ads",
        "languages": [
          "en"
        ],
        "title": "Test Subscription",
        "url": "${url}",
        "homepage": "https://easylist.to/"
      }]`);

    nock(origin).get(urlPath).reply(200, data1);

    mkdirSync(outDir);
    let toFile = getSubscriptionFile({url});
    mkdirSync(path.join(outDir, toFile));
    await assert.rejects(async() => fetchSubscriptions(subscriptionsFile, outDir));
  });

  it("should fail on HTTP error for at least one subscription", async function() {
    const origin = "http://localhost";
    const urlPath1 = "/test_subscription1.txt";
    const urlPath2 = "/test_subscription2.txt";
    const data1 = "subscription data 1";
    const subscriptionsFile = createFile(tmpDir,
      `[{
        "type": "ads",
        "languages": [
          "en"
        ],
        "title": "Test Subscription 1",
        "url": "${origin + urlPath1}",
        "homepage": "https://easylist.to/"
      }, {
        "type": "ads",
        "languages": [
          "en"
        ],
        "title": "Test Subscription 2",
        "url": "${origin + urlPath2}",
        "homepage": "https://easylist.to/"
      }]`);

    nock(origin).get(urlPath1).reply(200, data1); // no HTTP error
    nock(origin).get(urlPath2).reply(404); // simulate HTTP error

    mkdirSync(outDir);
    await assert.rejects(async() => fetchSubscriptions(subscriptionsFile, outDir));
  });

  it("should not create an empty file on HTTP download failure", async function() {
    const origin = "http://localhost";
    const urlPath = "/test_subscription1.txt";
    const subscriptionsFile = createFile(tmpDir,
      `[{
        "type": "ads",
        "languages": [
          "en"
        ],
        "title": "Test Subscription 1",
        "url": "${origin + urlPath}",
        "homepage": "https://easylist.to/"
      }]`);

    nock(origin).get(urlPath).reply(404); // simulate HTTP error

    mkdirSync(outDir);
    await assert.rejects(async() => fetchSubscriptions(subscriptionsFile, outDir));
    let files = readdirSync(outDir);
    assert.strictEqual(files.length, 0);
  });

  it("should not clean an existing file on HTTP download failure", async function() {
    const origin = "http://localhost";
    const urlPath = "/test_subscription1.txt";
    const url = origin + urlPath;
    const subscriptionsFile = createFile(tmpDir,
      `[{
        "type": "ads",
        "languages": [
          "en"
        ],
        "title": "Test Subscription 1",
        "url": "${url}",
        "homepage": "https://easylist.to/"
      }]`);

    nock(origin).get(urlPath).reply(404); // simulate HTTP error

    mkdirSync(outDir);
    let filename = path.join(outDir, getSubscriptionFile({url}));
    const data = "something";
    writeFileSync(filename, data); // existing file with some data

    await assert.rejects(async() => fetchSubscriptions(subscriptionsFile, outDir));
    let files = readdirSync(outDir);
    assert.strictEqual(files.length, 1);
    assert.deepEqual(await readFile(filename), Buffer.from(data, ENCODING));
  });
});
