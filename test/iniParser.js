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
const {LIB_FOLDER, createSandbox} = require("./_common");

describe("INIParser", function() {
  let iniParser = null;
  let Subscription = null;
  let filterState = null;

  beforeEach(function() {
    let sandboxedRequire = createSandbox();
    (
      {Subscription} = sandboxedRequire(LIB_FOLDER + "/subscriptionClasses")
    );
    let {FilterState} = sandboxedRequire(LIB_FOLDER + "/filterState");
    filterState = new FilterState();
    let {INIParser} = sandboxedRequire(LIB_FOLDER + "/iniParser");
    iniParser = new INIParser(filterState);
  });

  afterEach(function() {
    filterState = null;
  });

  describe("#constructor()", function() {
    it("should start with no data", function() {
      assert.deepEqual(iniParser.fileProperties, {});
      assert.deepEqual(iniParser.subscriptions, []);
    });
  });

  describe("#process()", function() {
    it("should read properties before the first header as fileProperties", function() {
      iniParser.process("foo=bar");
      iniParser.process(null);

      assert.deepEqual(iniParser.fileProperties, {foo: "bar"});
    });

    it("should read properties that end with [] as arrays", function() {
      iniParser.process("foo[]=one");
      iniParser.process("bar[]=two");
      iniParser.process("foo[]=three");
      iniParser.process(null);

      assert.deepEqual(iniParser.fileProperties, {foo: ["one", "three"], bar: ["two"]});
    });

    it("should ignore empty lines", function() {
      iniParser.process("");
      iniParser.process("foo=bar");
      iniParser.process("\t\n");
      iniParser.process("   ");
      iniParser.process("bar=baz");
      iniParser.process(null);

      assert.deepEqual(iniParser.fileProperties, {foo: "bar", bar: "baz"});
    });

    it("should ignore invalid ini lines", function() {
      iniParser.process("][");
      iniParser.process("## [subscription] ##");
      iniParser.process("foo=bar");
      iniParser.process("key without value");
      iniParser.process(null);

      assert.deepEqual(iniParser.fileProperties, {foo: "bar"});
    });

    it("should take the last value if a non-array property is defined twice", function() {
      iniParser.process("foo=bar");
      iniParser.process("foo=baz");
      iniParser.process(null);

      assert.deepEqual(iniParser.fileProperties, {foo: "baz"});
    });

    it("should parse a valid subscription section", function() {
      iniParser.process("[subscription]");
      iniParser.process("url=~user~1234");
      iniParser.process(null);

      assert.deepEqual(iniParser.subscriptions, [Subscription.fromObject({url: "~user~1234"})]);
    });

    it("should allow whitespace padding around a section header", function() {
      iniParser.process(" [subscription]  ");
      iniParser.process("url=~user~1234");
      iniParser.process(null);

      assert.deepEqual(iniParser.subscriptions, [Subscription.fromObject({url: "~user~1234"})]);
    });

    it("should parse multiple valid subscription sections", function() {
      iniParser.process("[subscription]");
      iniParser.process("url=~user~1234");
      iniParser.process("[subscription]");
      iniParser.process("url=~user~2345");
      iniParser.process(null);

      assert.deepEqual(iniParser.subscriptions, [
        Subscription.fromObject({url: "~user~1234"}),
        Subscription.fromObject({url: "~user~2345"})
      ]);
    });

    it("should parse valid subscription filters section", function() {
      iniParser.process("[subscription]");
      iniParser.process("url=~user~1234");
      iniParser.process("[subscription filters]");
      iniParser.process("/ads");
      iniParser.process("/marketing");
      iniParser.process("/track");
      iniParser.process(null);

      let expectedSubscription = Subscription.fromObject({url: "~user~1234"});
      expectedSubscription.updateFilterText(["/ads", "/marketing", "/track"]);

      assert.deepEqual(iniParser.subscriptions, [expectedSubscription]);
    });

    it("should ignore subscription filters are provided without a subscription", function() {
      iniParser.process("[subscription filters]");
      iniParser.process("/ads");
      iniParser.process("/marketing");
      iniParser.process("/track");
      iniParser.process(null);

      assert.deepEqual(iniParser.subscriptions, []);
    });

    it("should take the last subscription filters if multiple are provided", function() {
      iniParser.process("[subscription]");
      iniParser.process("url=~user~1234");
      iniParser.process("[subscription filters]");
      iniParser.process("/ads");
      iniParser.process("/marketing");
      iniParser.process("[subscription filters]");
      iniParser.process("/track");
      iniParser.process(null);

      let expectedSubscription = Subscription.fromObject({url: "~user~1234"});
      expectedSubscription.updateFilterText(["/track"]);

      assert.deepEqual(iniParser.subscriptions, [expectedSubscription]);
    });

    it("should allocate subscription filters to the last subscription", function() {
      iniParser.process("[subscription]");
      iniParser.process("url=~user~1234");
      iniParser.process("[subscription filters]");
      iniParser.process("/ads");
      iniParser.process("/marketing");
      iniParser.process("[subscription]");
      iniParser.process("url=~user~5678");
      iniParser.process("[subscription filters]");
      iniParser.process("/track");
      iniParser.process(null);

      let expectedSubscription1 = Subscription.fromObject({url: "~user~1234"});
      expectedSubscription1.updateFilterText(["/ads", "/marketing"]);
      let expectedSubscription2 = Subscription.fromObject({url: "~user~5678"});
      expectedSubscription2.updateFilterText(["/track"]);

      assert.deepEqual(iniParser.subscriptions, [
        expectedSubscription1, expectedSubscription2
      ]);
    });

    it("should add filter sections to filterState", function() {
      iniParser.process("[filter]");
      iniParser.process("text=/ads");
      iniParser.process("hitCount=5");
      iniParser.process(null);

      assert.equal(filterState.getHitCount("/ads"), 5);
    });
  });
});
