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

let recommendations = null;
let setRecommendations = null;

describe("Recommendations", function() {
  beforeEach(function() {
    let sandboxedRequire = createSandbox({});
    (
      {recommendations, setRecommendations} = sandboxedRequire(LIB_FOLDER + "/recommendations")
    );
  });

  function checkValidity(recommendation) {
    for (let name of ["type", "title", "url", "homepage"]) {
      let value = recommendation[name];
      assert.ok(typeof value == "string" && value.length > 0);
    }

    for (let name of ["languages"]) {
      let value = recommendation[name];

      assert.ok(Array.isArray(value));

      for (let element of value)
        assert.ok(typeof element == "string" && /^[a-z]{2}$/.test(element));
    }

    for (let name of ["url", "homepage"]) {
      // Make sure the value parses as a URL.
      assert.doesNotThrow(() => new URL(recommendation[name]));
    }

    for (let name of ["url"]) {
      // The URL of a recommended subscription must be HTTPS.
      // https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore/issues/5
      assert.equal(new URL(recommendation[name]).protocol, "https:");
    }
  }

  function checkEquality(recommendation, source) {
    // String values.
    for (let name of ["type", "title", "url", "homepage"])
      assert.equal(recommendation[name], source[name]);

    // Array values.
    for (let name of ["languages"])
      assert.deepEqual(recommendation[name], source[name] || []);
  }

  function checkImmutability(recommendation, source) {
    // No properties can be set.
    for (let name of ["type", "languages", "title", "url", "homepage"])
      assert.throws(() => recommendation[name] = null);

    // Modifying mutable values (arrays) has an effect on neither the
    // recommendation nor the source.
    for (let name of ["languages"]) {
      let value = recommendation[name];

      // Modify an existing element.
      if (value.length > 0) {
        value[Math.floor(Math.random() * value.length)] = null;
        assert.notDeepEqual(value, recommendation[name]);
        assert.notDeepEqual(value, source[name]);
      }

      // Add a new element.
      value.push(null);
      assert.notDeepEqual(value, recommendation[name]);
      assert.notDeepEqual(value, source[name]);
    }
  }

  it("Has built-in recommendations", function() {
    const subscriptionsJson = require("../data/subscriptions.json");
    let index = 0;
    let knownTypes = new Set();

    for (let recommendation of recommendations()) {
      let source = subscriptionsJson[index++];

      checkValidity(recommendation);
      checkEquality(recommendation, source);
      checkImmutability(recommendation, source);

      let {type} = recommendation;

      // For non-ads recommendations, there should be only one per type. This is
      // a requirement of the WebExt UI.
      if (type != "ads")
        assert.equal(knownTypes.has(type), false);

      knownTypes.add(type);
    }

    assert.equal(index, subscriptionsJson.length);
  });

  it("Accept supplied recommendations", function() {
    let _recommendations = require("./data/v3_index.json");

    setRecommendations(_recommendations);

    for (let recommendation of recommendations())

      checkValidity(recommendation);
  });
});
