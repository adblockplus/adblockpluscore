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

const {createSandbox} = require("./_common");

let Cache = null;

exports.setUp = function(callback)
{
  let sandboxedRequire = createSandbox();
  (
    {Cache} = sandboxedRequire("../lib/caching")
  );

  callback();
};

exports.testCache = function(test)
{
  // A capacity must be specificed and it must be coercable to a positive
  // number greater than or equal to one.
  test.throws(() => { new Cache(); }, "capacity must be a positive number.");
  test.throws(() => { new Cache(0); }, "capacity must be a positive number.");
  test.throws(() => { new Cache(-1); }, "capacity must be a positive number.");
  test.throws(() => { new Cache(0.1); }, "capacity must be a positive number.");
  test.throws(() => { new Cache(Number.MIN_VALUE); },
              "capacity must be a positive number.");
  test.throws(() => { new Cache(-Infinity); },
              "capacity must be a positive number.");
  test.throws(() => { new Cache("ten"); },
              "capacity must be a positive number.");
  test.doesNotThrow(() => { new Cache(1); },
                    "capacity must be a positive number.");
  test.doesNotThrow(() => { new Cache(1.1); },
                    "capacity must be a positive number.");
  test.doesNotThrow(() => { new Cache(10); },
                    "capacity must be a positive number.");
  test.doesNotThrow(() => { new Cache(Number.MAX_VALUE); },
                    "capacity must be a positive number.");
  test.doesNotThrow(() => { new Cache(Infinity); },
                    "capacity must be a positive number.");
  test.doesNotThrow(() => { new Cache("10"); },
                    "capacity must be a positive number.");

  let cache = new Cache(100);

  cache.set("1", "one");
  test.equal(cache.get("1"), "one");

  cache.set(2, "two");
  test.equal(cache.get(2), "two");

  // No type coercion.
  test.equal(cache.get("2"), undefined);

  // Neither key nor value can be undefined.
  test.throws(() => { cache.set(undefined, "three"); },
              "key must not be undefined.");
  test.throws(() => { cache.set(4, undefined); },
              "value must not be undefined.");

  // Keys and values can be null.
  cache.set(null, "five");
  cache.set(5, null);

  cache.clear();

  test.equal(cache.get("1"), undefined);
  test.equal(cache.get(2), undefined);
  test.equal(cache.get(null), undefined);
  test.equal(cache.get(5), undefined);

  // Fill to capacity.
  for (let i = 0; i < 100; i++)
    cache.set(i, i);

  // All entries exist.
  for (let i = 0; i < 100; i++)
    test.equal(cache.get(i), i);

  // Add an existing entry again.
  cache.set(0, 0);

  // All entries still exist.
  for (let i = 0; i < 100; i++)
    test.equal(cache.get(i), i);

  // Exceed capacity.
  cache.set(100, 100);

  // Only the last entry exists.
  for (let i = 0; i <= 100; i++)
    test.equal(cache.get(i), i == 100 ? 100 : undefined);

  test.done();
};
