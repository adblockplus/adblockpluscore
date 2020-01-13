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

describe("extend()", function()
{
  let extend = null;

  let Foo = null;

  beforeEach(function()
  {
    let sandboxedRequire = createSandbox();
    (
      {extend} = sandboxedRequire("../lib/coreUtils")
    );

    Foo = function() {};
    Foo.prototype = {a: 1};
  });

  it("should throw when cls is undefined", function()
  {
    assert.throws(() => extend(undefined, {}));
  });

  it("should throw when cls is null", function()
  {
    assert.throws(() => extend(null, {}));
  });

  it("should throw when properties is undefined", function()
  {
    assert.throws(() => extend(function() {}, undefined));
  });

  it("should throw when properties is null", function()
  {
    assert.throws(() => extend(function() {}, null));
  });

  it("should extend with empty prototype", function()
  {
    function Bar() {}
    Bar.prototype = extend(Foo, {});

    let bar = new Bar();

    assert.ok(bar instanceof Foo);
    assert.strictEqual(bar.a, Foo.prototype.a);
  });

  it("should extend with prototype containing one property", function()
  {
    function Bar() {}
    Bar.prototype = extend(Foo, {b: 2});

    let bar = new Bar();

    assert.ok(bar instanceof Foo);
    assert.strictEqual(bar.a, Foo.prototype.a);
    assert.strictEqual(bar.b, 2);
  });

  it("should extend with prototype containing multiple properties", function()
  {
    function Bar() {}
    Bar.prototype = extend(Foo, {b: 2, c: 3});

    let bar = new Bar();

    assert.ok(bar instanceof Foo);
    assert.strictEqual(bar.a, Foo.prototype.a);
    assert.strictEqual(bar.b, 2);
    assert.strictEqual(bar.c, 3);
  });

  it("should not copy non-enumerable properties from prototype", function()
  {
    let properties = {b: 2};
    Object.defineProperty(properties, "c", {value: 3});

    function Bar() {}
    Bar.prototype = extend(Foo, properties);

    let bar = new Bar();

    assert.ok(bar instanceof Foo);
    assert.strictEqual(bar.a, Foo.prototype.a);
    assert.strictEqual(bar.b, 2);
    assert.ok(!("c" in bar));
  });

  it("should not copy inherited properties from prototype", function()
  {
    let properties = Object.create({c: 3});
    properties.b = 2;

    function Bar() {}
    Bar.prototype = extend(Foo, properties);

    let bar = new Bar();

    assert.ok(bar instanceof Foo);
    assert.strictEqual(bar.a, Foo.prototype.a);
    assert.strictEqual(bar.b, 2);
    assert.ok(!("c" in bar));
  });

  it("should copy function property from prototype", function()
  {
    function Bar() {}
    Bar.prototype = extend(Foo, {b() {}});

    let bar = new Bar();

    assert.ok(bar instanceof Foo);
    assert.strictEqual(bar.a, Foo.prototype.a);
    assert.equal(typeof bar.b, "function");
  });

  it("should copy getter-only property from prototype", function()
  {
    function Bar() {}
    Bar.prototype = extend(Foo, {
      get b()
      {
        return 2;
      }
    });

    let bar = new Bar();

    assert.ok(bar instanceof Foo);
    assert.strictEqual(bar.a, Foo.prototype.a);
    assert.strictEqual(bar.b, 2);
    assert.throws(() => bar.b++);
  });

  it("should copy setter-only property from prototype", function()
  {
    function Bar() {}
    Bar.prototype = extend(Foo, {
      set b(value)
      {
      }
    });

    let bar = new Bar();
    bar.b = 2;
    bar.c = 3;

    assert.ok(bar instanceof Foo);
    assert.strictEqual(bar.a, Foo.prototype.a);
    assert.strictEqual(bar.b, undefined);
    assert.strictEqual(bar.c, 3);
  });

  it("should copy getter-setter property from prototype", function()
  {
    function Bar()
    {
      this._b = 2;
    }

    Bar.prototype = extend(Foo, {
      get b()
      {
        return this._b;
      },
      set b(value)
      {
        this._b = value;
      }
    });

    let bar = new Bar();

    assert.ok(bar instanceof Foo);
    assert.strictEqual(bar.a, Foo.prototype.a);
    assert.strictEqual(bar.b, 2);

    bar.b++;

    assert.strictEqual(bar.b, 3);
  });
});
