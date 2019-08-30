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
const {createSandbox} = require("./_common");

let Cache = null;

describe("Caching", function()
{
  beforeEach(function()
  {
    let sandboxedRequire = createSandbox();
    (
      {Cache} = sandboxedRequire("../lib/caching")
    );
  });

  it("Cache", function()
  {
    // A capacity must be specificed and it must be coercable to a positive
    // number greater than or equal to one.
    assert.throws(() => { new Cache(); }, Error,
                  "Should have thrown capacity must be a positive number.");
    assert.throws(() => { new Cache(0); }, Error,
                  "Should have thrown capacity must be a positive number.");
    assert.throws(() => { new Cache(-1); }, Error,
                  "Should have thrown capacity must be a positive number.");
    assert.throws(() => { new Cache(0.1); }, Error,
                  "Should have thrown capacity must be a positive number.");
    assert.throws(() => { new Cache(Number.MIN_VALUE); }, Error,
                  "Should have thrown capacity must be a positive number.");
    assert.throws(() => { new Cache(-Infinity); }, Error,
                  "Should have thrown capacity must be a positive number.");
    assert.throws(() => { new Cache("ten"); }, Error,
                  "Should have thrown capacity must be a positive number.");
    assert.doesNotThrow(() => { new Cache(1); }, Error,
                        "Should not have thrown.");
    assert.doesNotThrow(() => { new Cache(1.1); }, Error,
                        "Should not have thrown.");
    assert.doesNotThrow(() => { new Cache(10); }, Error,
                        "Should not have thrown.");
    assert.doesNotThrow(() => { new Cache(Number.MAX_VALUE); }, Error,
                        "Should not have thrown.");
    assert.doesNotThrow(() => { new Cache(Infinity); }, Error,
                        "Should not have thrown.");
    assert.doesNotThrow(() => { new Cache("10"); }, Error,
                        "Should not have thrown.");

    let cache = new Cache(100);

    cache.set("1", "one");
    assert.equal(cache.get("1"), "one");

    cache.set(2, "two");
    assert.equal(cache.get(2), "two");

    // No type coercion.
    assert.equal(cache.get("2"), undefined);

    // Neither key nor value can be undefined.
    assert.throws(() => { cache.set(undefined, "three"); },
                  Error, "Should have thrown key must not be undefined.");
    assert.throws(() => { cache.set(4, undefined); },
                  Error, "Should have thrown value must not be undefined.");

    // Keys and values can be null.
    cache.set(null, "five");
    cache.set(5, null);

    cache.clear();

    assert.equal(cache.get("1"), undefined);
    assert.equal(cache.get(2), undefined);
    assert.equal(cache.get(null), undefined);
    assert.equal(cache.get(5), undefined);

    // Fill to capacity.
    for (let i = 0; i < 100; i++)
      cache.set(i, i);

    // All entries exist.
    for (let i = 0; i < 100; i++)
      assert.equal(cache.get(i), i);

    // Add an existing entry again.
    cache.set(0, 0);

    // All entries still exist.
    for (let i = 0; i < 100; i++)
      assert.equal(cache.get(i), i);

    // Exceed capacity.
    cache.set(100, 100);

    // Only the last entry exists.
    for (let i = 0; i <= 100; i++)
      assert.equal(cache.get(i), i == 100 ? 100 : undefined);
  });
});
