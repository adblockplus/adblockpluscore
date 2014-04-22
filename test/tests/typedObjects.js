/*
 * This file is part of Adblock Plus <http://adblockplus.org/>,
 * Copyright (C) 2006-2014 Eyeo GmbH
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

(function()
{
  module("Typed objects");

  test("Math utilities", function()
  {
    let {nextPow2, ilog2} = require("typedObjects/utils");

    equal(nextPow2(0), 0, "nextPow2(0)");
    equal(nextPow2(1), 1, "nextPow2(1)");
    equal(nextPow2(2), 2, "nextPow2(2)");
    equal(nextPow2(3), 4, "nextPow2(3)");
    equal(nextPow2(7), 8, "nextPow2(7)");
    equal(nextPow2(8), 8, "nextPow2(8)");
    equal(nextPow2(9), 16, "nextPow2(9)");
    equal(nextPow2(13), 16, "nextPow2(13)");
    equal(nextPow2(1000), 1024, "nextPow2(1000)");
    equal(nextPow2(0x5123), 0x8000, "nextPow2(0x5123)");
    equal(nextPow2(0x31234567), 0x40000000, "nextPow2(0x31234567)");

    equal(ilog2(-1), 0, "ilog2(-1)");
    equal(ilog2(1), 0, "ilog2(1)");
    equal(ilog2(2), 1, "ilog2(2)");
    equal(ilog2(3), 1, "ilog2(3)");
    equal(ilog2(7), 2, "ilog2(7)");
    equal(ilog2(8), 3, "ilog2(8)");
    equal(ilog2(9), 3, "ilog2(9)");
    equal(ilog2(13), 3, "ilog2(13)");
    equal(ilog2(1000), 9, "ilog2(1000)");
    equal(ilog2(0x5123), 14, "ilog2(0x5123)");
    equal(ilog2(0x31234567), 29, "ilog2(0x31234567)");
  });

  test("Object creation and property access", function()
  {
    // Create a type and check its properties
    let {ObjectType, uint8, float32} = require("typedObjects");
    let type = new ObjectType({
      foo: uint8,
      bar: float32,
      mtd: function() {
        return this.foo * 2;
      }
    }, {bufferSize: 8});
    ok(type, "Type created");

    equal(typeof type.typeId, "number");
    equal(typeof type.byteLength, "number");
    equal(type.byteLength, 8);

    // Create an object and check default properties
    let objects = [];
    objects.push(type());
    ok(objects[0], "Object created");

    equal(typeof objects[0].typeId, "number");
    equal(objects[0].typeId, type.typeId);

    equal(typeof objects[0].bufferIndex, "number");
    equal(objects[0].bufferIndex, 0);

    equal(typeof objects[0].byteOffset, "number");
    equal(objects[0].byteOffset, 0);

    // The first 8 objects should go into the same buffer
    for (let i = 1; i < 8; i++)
    {
      objects.push(type());
      equal(objects[i].bufferIndex, 0);
      equal(objects[i].byteOffset, 8 * i);
    }

    // Properties should persist and methods should be able to access them
    for (let i = 0; i < objects.length; i++)
    {
      objects[i].foo = i;
      objects[i].bar = 8.5 - objects[i].foo;
    }
    ok(true, "Setting properties succeeded");

    for (let i = 0; i < objects.length; i++)
    {
      equal(objects[i].foo, i);
      equal(objects[i].bar, 8.5 - objects[i].foo);
      equal(objects[i].mtd(), i * 2);
    }

    // Next objects should go into a new buffer
    let obj = type();
    equal(obj.bufferIndex, 1);
    equal(obj.byteOffset, 0);

    obj = type();
    equal(obj.bufferIndex, 1);
    equal(obj.byteOffset, 8);
  });

  test("Object constructors", function()
  {
    let {ObjectType, uint8, float32} = require("typedObjects");
    let type = new ObjectType({
      foo: uint8,
      bar: float32
    }, {
      constructor: function(a, b)
      {
        this.foo = a;
        this.bar = b;
      }
    });
    ok(type, "Type created");

    let obj = type(4, 12.5);
    equal(obj.foo, 4);
    equal(obj.bar, 12.5);
  });

  test("Object references", function()
  {
    let {ObjectType, uint8} = require("typedObjects");
    let type1 = new ObjectType({
      foo: uint8
    });
    let type2 = new ObjectType({
      bar: type1
    });
    ok(type1 && type2, "Types created");

    let obj1 = type1();
    let obj2 = type2();
    ok(obj1 && obj2, "Objects created");

    obj2.bar = obj1;
    ok(obj2.bar, "Object reference set");
    equal(obj2.bar.typeId, obj1.typeId);
    equal(obj2.bar.bufferIndex, obj1.bufferIndex);
    equal(obj2.bar.byteOffset, obj1.byteOffset);

    obj2.bar = null;
    ok(!obj2.bar, "Object reference unset");

    let obj3 = type2();
    obj3.bar = obj1;
    ok(obj3.bar, "Object reference set on new object");
    equal(obj3.bar.typeId, obj1.typeId);
    equal(obj3.bar.bufferIndex, obj1.bufferIndex);
    equal(obj3.bar.byteOffset, obj1.byteOffset);
    ok(!obj2.bar);
  });
})();
