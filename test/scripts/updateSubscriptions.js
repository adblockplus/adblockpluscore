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
  promises: {readFile, rm, mkdtemp}
} = require("fs");
const os = require("os");
const path = require("path");
const nock = require("nock");

const {
  listUrl, urlMapperMv3, update
} = require("../../scripts/updateSubscriptions");

const exampleSubscription = "subscriptionlist-master";

const url = new URL(listUrl);

describe("updateSubscriptions script", function() {
  let tmpDir;
  let warnings;
  let errors;
  let toFile;

  function mockedConsoleWarn(message) {
    warnings.push(message);
  }

  function mockedConsoleErr(message) {
    errors.push(message);
  }

  beforeEach(async function() {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "tmp-"));
    toFile = path.join(tmpDir, exampleSubscription + ".json");
    console.warn = mockedConsoleWarn;
    console.error = mockedConsoleErr;
    warnings = [];
    errors = [];
  });

  afterEach(async function() {
    if (existsSync(tmpDir))
      await rm(tmpDir, {recursive: true});

    let taredData = path.join("scripts", exampleSubscription + ".tar.gz");
    if (existsSync(taredData))
      await rm(taredData, {recursive: true});

    let untaredData = path.join("scripts/", exampleSubscription);
    if (existsSync(untaredData))
      await rm(untaredData, {recursive: true});
  });

  async function mockData(mockedDataPath) {
    let mockedData = await readFile("test/data/" + mockedDataPath + ".tar.gz");
    nock(url.origin).get(url.pathname).reply(200, mockedData);
  }

  async function performSubscriptionUpdate(mockedDataPath) {
    await mockData(mockedDataPath);
    await update(urlMapperMv3, toFile);
  }

  async function assertSubscriptions(assertCallback) {
    await performSubscriptionUpdate(exampleSubscription);
    let subscriptionsFileData = await readFile(toFile);
    let subscriptionsJson = JSON.parse(subscriptionsFileData);

    assertCallback(subscriptionsJson);
  }

  async function assertFailureWarnings(mockedDataPath, messageToAssert) {
    await performSubscriptionUpdate(mockedDataPath);
    assert.strictEqual(warnings[0].substring(0, messageToAssert.length),
                       messageToAssert);
  }

  it("should handle empty subscription tar file", async function() {
    // In this scenario test checks if code throws error when tar file is
    // empty (has no settings)
    await assertFailureWarnings("noSubscription/" + exampleSubscription,
                                "Settings file doesn't exist");
  });

  it("should handle broken language on subscription", async function() {
    await assertFailureWarnings("subscriptionBrokenLanguage/" + exampleSubscription,
                                "Unknown language code invalid in");
  });

  it("should handle missing value key in subscription", async function() {
    await assertFailureWarnings("subscriptionEmptyKey/" + exampleSubscription,
                                "Empty value given for attribute");
  });

  it("should handle invalid variant in subscription", async function() {
    await assertFailureWarnings("invalidVariant/" + exampleSubscription,
                                "Invalid variant format in");
  });

  it("should handle no list location in subscription", async function() {
    await assertFailureWarnings("noListLocation/" + exampleSubscription,
                                "No list locations given in");
  });

  it("should handle recommendation without language", async function() {
    await assertFailureWarnings("recommendationWithoutLanguage/" + exampleSubscription,
                                "Recommendation without languages in");
  });

  it("should handle variant marked as completed", async function() {
    await assertFailureWarnings("variantMarkedAsComplete/" + exampleSubscription,
                                "Variant marked as complete for non-supplemental");
  });

  it("should handle invalid subscription file", async function() {
    // This scenario checks if code outputs the warning when subscription file
    // has invalid format - in this specific case subscriptionlist_master.tar.gz
    // empty subscription file is included
    await assertFailureWarnings("invalidSubscriptionFile/" + exampleSubscription,
                                "Invalid format of the file");
  });

  it("should handle duplicated key in subscription", async function() {
    await assertFailureWarnings("subscriptionDuplicatedKey/" + exampleSubscription,
                                "Value for attribute maintainer is duplicated in");
  });


  it("should remove invalid key on subscription postprocessing", async function() {
    await performSubscriptionUpdate("invalidKey/" + exampleSubscription);
    let subscriptionsJson = JSON.parse(await readFile(toFile));
    assert.strictEqual(subscriptionsJson["invalidKey"] == null, true);
  });

  it("should add homepage value as key on subscription postprocessing",
     async function() {
       await performSubscriptionUpdate("subscriptionURL/" + exampleSubscription);
       let subscriptionsJson = JSON.parse(await readFile(toFile));
       for (const subscription of subscriptionsJson)
         assert.strictEqual(subscription["homepage"] == "https://easylist.to/", true);
     });

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

  it("should provide no mv3 mapping when no mv3 flag is passed", async function() {
    await mockData(exampleSubscription);
    await update(null, toFile);
    let subscriptions = JSON.parse(await readFile(toFile));
    for (let subscription of subscriptions)
      assert.strictEqual((subscription.url).includes("mv3"), false);
  });

  it("should provide mv3 mapping when urlmapper is passed", async function() {
    await mockData(exampleSubscription);
    await update(urlMapperMv3, toFile);
    let subscriptions = JSON.parse(await readFile(toFile));
    for (let subscription of subscriptions)
      assert.strictEqual((subscription.url).includes("https://release-v3.filter-delivery-staging.eyeo.com/v3"), true);
  });

  for (let statusCode of [400, 401, 404, 422]) {
    it(`should handle request ${statusCode} on download`, async function() {
      nock(url.origin).get(url.pathname).reply(statusCode);
      assert.rejects(update.call(urlMapperMv3, toFile),
                     {
                       name: "Error",
                       message: `Error: HTTPS server response code: ${statusCode}`
                     }
      );
    });
  }
});
