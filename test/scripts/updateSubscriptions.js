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
  promises: {readFile, rmdir, mkdtemp}
} = require("fs");
const os = require("os");
const path = require("path");
const nock = require("nock");

const {
  listUrl, urlMapperMv3, update
} = require("../../scripts/updateSubscriptions");

describe("updateSubscriptions script", function() {
  let tmpDir;

  beforeEach(async function() {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "tmp-"));
  });

  afterEach(async function() {
    if (existsSync(tmpDir))
      await rmdir(tmpDir, {recursive: true});
  });

  async function assertSubscriptions(assertCallback) {
    let mockedData = await readFile("test/data/subscriptionlist-master.tar.gz");
    let url = new URL(listUrl);
    nock(url.origin).get(url.pathname).reply(200, mockedData);

    let toFile = path.join(tmpDir, "subscriptions_mv3.json");
    await update(urlMapperMv3, toFile);
    let subscriptionsFileData = await readFile(toFile);
    let subscriptionsJson = JSON.parse(subscriptionsFileData);

    assertCallback(subscriptionsJson);
  }

  it("should provide at least one subscription", async function() {
    await assertSubscriptions(subscriptions => {
      assert.strictEqual(subscriptions.length > 0, true);
    });
  });

  it("should provide the subscriptions having a type", async function() {
    await assertSubscriptions(subscriptions => {
      for (let subscription of subscriptions)
        assert.strictEqual(subscription.type != null, true);
    });
  });

  it("should provide the subscriptions having a title", async function() {
    await assertSubscriptions(subscriptions => {
      for (let subscription of subscriptions)
        assert.strictEqual(subscription.title != null, true);
    });
  });

  it("should provide the subscriptions having a url", async function() {
    await assertSubscriptions(subscriptions => {
      for (let subscription of subscriptions)
        assert.strictEqual(subscription.url != null, true);
    });
  });

  it("should provide the subscriptions having a homepage", async function() {
    await assertSubscriptions(subscriptions => {
      for (let subscription of subscriptions)
        assert.strictEqual(subscription.homepage != null, true);
    });
  });

  it("should provide the ads subscriptions having at least one language", async function() {
    await assertSubscriptions(subscriptions => {
      for (let subscription of subscriptions) {
        if (subscription.type === "ads")
          assert.strictEqual(subscription.languages.length > 0, true);
      }
    });
  });
});
