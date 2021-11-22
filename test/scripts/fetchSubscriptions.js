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
const http = require("http");

const {fetchSubscriptions} = require("../../scripts/fetchSubscriptions");

const port = 5555;
const encoding = "utf8";

describe("fetchSubscriptions script", function() {
  let tmpDir;
  let outDir;
  let originalConsole;
  let warnings;
  let serverConfig;
  let server;

  function mockedConsoleWarn(message) {
    warnings.push(message);
  }

  function createFile(dir, data) {
    let file = path.join(dir, "subscriptions.json");
    writeFileSync(file, data);
    return file;
  }

  function configureHttpServer(urlPath, buffer) {
    serverConfig[urlPath] = buffer;
  }

  const requestListener = function(req, res) {
    let data = serverConfig[req.url];
    if (data != null) {
      res.writeHead(200);
      res.end(data);
    }
    else {
      res.writeHead(404);
      res.end();
    }
  };

  async function startHttpServer() {
    server = http.createServer(requestListener);
    return new Promise((resolve, reject) => {
      server.listen(port, "localhost", () => {
        console.trace(`Server is running on port ${port}`);
        resolve();
      });
    });
  }

  async function stopHttpServer() {
    if (server != null)
      server.close();
  }

  beforeEach(async function() {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "rules-"));
    outDir = path.join(tmpDir, "outDir");
    originalConsole = console;
    console.warn = mockedConsoleWarn;
    warnings = [];
    serverConfig = {};
  });

  afterEach(async function() {
    if (existsSync(tmpDir))
      await rmdir(tmpDir, {recursive: true});
    console = originalConsole;
    await stopHttpServer();
  });

  it("should throw an error if input file does not exist", async function() {
    let file = path.join(tmpDir, "someNotExistingFile");
    try {
      await fetchSubscriptions(file, outDir);
      assert.fail("Error is expected to be thrown");
    }
    catch (e) {
      assert.equal(e instanceof Error, true);
    }
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
    const subscriptionsFile = createFile(tmpDir, "[{\n" +
      "    \"type\": \"ads\",\n" +
      "    \"languages\": [\n" +
      "      \"en\"\n" +
      "    ],\n" +
      "    \"title\": \"Test Subscription\",\n" +
      "    \"url\": \"http://localhost:" + port + urlPath + "\",\n" +
      "    \"homepage\": \"https://easylist.to/\"\n" +
      "  }]");

    configureHttpServer(urlPath, Buffer.from(data, encoding));
    await startHttpServer();

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

    const subscriptionsFile = createFile(tmpDir, "[{\n" +
      "    \"type\": \"ads\",\n" +
      "    \"languages\": [\n" +
      "      \"en\"\n" +
      "    ],\n" +
      "    \"title\": \"Test Subscription 1\",\n" +
      "    \"url\": \"http://localhost:" + port + urlPath1 + "\",\n" +
      "    \"homepage\": \"https://easylist.to/\"\n" +
      "  }, {\n" +
      "    \"type\": \"ads\",\n" +
      "    \"languages\": [\n" +
      "      \"en\"\n" +
      "    ],\n" +
      "    \"title\": \"Test Subscription 2\",\n" +
      "    \"url\": \"http://localhost:" + port + urlPath2 + "\",\n" +
      "    \"homepage\": \"https://easylist.to/\"\n" +
      "  }]");

    configureHttpServer(urlPath1, Buffer.from(data1, encoding));
    configureHttpServer(urlPath2, Buffer.from(data2, encoding));
    await startHttpServer();

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
    const urlPath = "/test_subscription.txt";
    const subscriptionsFile = createFile(tmpDir, "[{\n" +
      "    \"type\": \"ads\",\n" +
      "    \"languages\": [\n" +
      "      \"en\"\n" +
      "    ],\n" +
      "    \"title\": \"Test Subscription\",\n" +
      "    \"url\": \"http://localhost:" + port + urlPath + "\",\n" +
      "    \"homepage\": \"https://easylist.to/\"\n" +
      "  }]");

    // configureHttpServer(urlPath, data); // simulate HTTP error
    await startHttpServer();

    mkdirSync(outDir);
    try {
      await fetchSubscriptions(subscriptionsFile, outDir);
      assert.fail("Error is expected to be thrown");
    }
    catch (e) {
      assert.strictEqual(e instanceof Error, true);
    }
  });
});
