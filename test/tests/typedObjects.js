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
      equal(objects[i].byteOffset, type.byteLength * i);
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
    equal(obj.byteOffset, type.byteLength);
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
    let {ObjectType, ObjectBase, uint8} = require("typedObjects");
    let type1 = new ObjectType({
      foo: uint8
    });
    let type2 = new ObjectType({
      bar: type1
    });

    let obj1 = type1();
    let obj2 = type2();

    obj2.bar = obj1;
    ok(obj1.equals(obj2.bar), "Object reference set");

    let type3 = type1.extend({
      anyref: ObjectBase
    });
    let obj3 = type3();
    obj2.bar = obj3;
    ok(obj3.equals(obj2.bar), "Object reference set to a subclass");

    throws(function()
    {
      obj2.bar = obj2;
    }, "Object reference cannot be set to an unrelated class");
    ok(obj3.equals(obj2.bar), "Object reference keeps value after unsuccessful assignment");

    obj3.anyref = obj3;
    ok(obj3.anyref.equals(obj3), "Assigned object itself to ObjectBase-typed reference");

    obj3.anyref = obj2;
    ok(obj3.anyref.equals(obj2), "Assigned object of unrelated type to ObjectBase-typed reference");

    obj2.bar = null;
    ok(!obj2.bar, "Object reference unset");

    let obj4 = type2();
    obj4.bar = obj1;
    ok(obj1.equals(obj4.bar), "Object reference set on new object");
    ok(!obj2.bar, "Reference on original object still unset");
  });

  test("Object equality", function()
  {
    let {ObjectType, uint8, float32} = require("typedObjects");

    let type1 = new ObjectType({
      foo: uint8
    }, {bufferSize: 2});
    let type2 = new ObjectType({
      bar: type1
    });

    let obj1 = type1();
    let obj2 = type2();
    ok(obj1.equals(obj1), "Object equal to itself");
    ok(obj2.equals(obj2), "Object equal to itself");
    ok(!obj1.equals(obj2), "Object not equal to object of another type");
    ok(!obj2.equals(obj1), "Object not equal to object of another type");

    let obj3 = type1();
    ok(!obj1.equals(obj3), "Object not equal to another object of same type in same buffer");
    ok(!obj3.equals(obj1), "Object not equal to another object of same type in same buffer");

    let obj4 = type1();
    ok(!obj1.equals(obj4), "Object not equal to another object of same type at same offset");
    ok(!obj4.equals(obj1), "Object not equal to another object of same type at same offset");

    obj2.bar = obj1;
    ok(obj1.equals(obj2.bar), "Object equal to reference to itself");
    ok(obj2.bar.equals(obj1), "Object equal to reference to itself");
    ok(obj2.bar.equals(obj2.bar), "Object reference equals to itself");

    let obj5 = type2();
    obj5.bar = null;
    ok(!obj2.bar.equals(obj5.bar), "Object reference not equal to null reference");

    obj5.bar = obj3;
    ok(!obj2.bar.equals(obj5.bar), "Object reference not equal to reference to another object")
    ok(!obj5.bar.equals(obj2.bar), "Object reference not equal to reference to another object")
  });

  test("Object inheritance", function()
  {
    let {ObjectType, uint8, float32} = require("typedObjects");

    // Property inheritance
    let type1 = new ObjectType({
      foo: uint8
    });
    let type2 = type1.extend({
      bar: float32
    });

    let obj1 = type1();
    let obj2 = type2();
    ok("foo" in obj1, "Superclass property exists in superclass");
    ok(!("bar" in obj1), "Subclass property doesn't exist in superclass");
    ok("foo" in obj2, "Superclass property exists in subclass");
    ok("bar" in obj2, "Subclass property exists in subclass");

    ok(type1.isInstance(obj1), "Object is recognized as instance of its class");
    ok(type1.isInstance(obj2), "Object is recognized as instance of its superclass");
    ok(!type2.isInstance(obj1), "Object isn't an instance of its subclass");
    ok(type2.isInstance(obj2), "Object is recognized as instance of its class");

    // Method and constructor inheritance
    let type3 = new ObjectType({
      x: uint8,
      foo: function(n) {return this.x * n;}
    }, {
      constructor: function(x)
      {
        this.x = x;
      }
    });
    let type4 = type3.extend({
      foo: function(super_, n) {return super_(n + 1);},
      bar: function() {return 4;}
    }, {
      constructor: function(super_, x)
      {
        super_(x);
        this.x *= 3;
      }
    });

    let obj3 = type3(2);
    let obj4 = type4(2);
    equal(obj3.x, 2, "Superclass constructor executed correctly");
    equal(obj4.x, 6, "Subclass constructor executed correctly");

    equal(typeof obj3.foo, "function", "Superclass method exists in superclass");
    equal(typeof obj3.bar, "undefined", "Subclass method doesn't exist in superclass");
    equal(typeof obj4.foo, "function", "Superclass method exists in subclass");
    equal(typeof obj4.bar, "function", "Subclass method exists in subclass");

    equal(obj3.foo(4), 8, "Superclass method executed correctly");
    equal(obj4.foo(4), 30, "Overridden superclass method executed correctly")

    let type5 = type3.extend({
      y: uint8
    });
    let obj5 = type5(4);
    equal(obj5.x, 4, "Superclass constructor is called even if subclass has no constructor");

    // Untypical overrides
    type3.extend({x: uint8});
    ok(true, "Overriding property without changing type");

    throws(function()
    {
      type3.extend({x: float32});
    }, "Override changes property type");

    throws(function()
    {
      type3.extend({foo: uint8});
    }, "Property masks method");

    throws(function()
    {
      type3.extend({x: function() {}});
    }, "Method masks property");
  });

  test("Garbage collection", function()
  {
    let {ObjectType, uint8, float32} = require("typedObjects");

    let destroyed;

    let type1 = new ObjectType({
      foo: uint8
    }, {
      constructor: function(foo)
      {
        this.foo = foo;
      },
      destructor: function()
      {
        destroyed.push(["type1", this.foo]);
      }
    });

    // Single release() call
    destroyed = [];
    type1(1).release();
    deepEqual(destroyed, [["type1", 1]], "Destructor called after release()");

    // retain() and multiple release() calls
    destroyed = [];
    let obj2 = type1(2);
    equal(obj2.bufferIndex, 0, "New object replaces the destroyed one");
    equal(obj2.byteOffset, 0, "New object replaces the destroyed one");

    obj2.retain();
    obj2.release();
    deepEqual(destroyed, [], "Destructor not called after release() if retain() was called");
    obj2.release();
    deepEqual(destroyed, [["type1", 2]], "Destructor called after second release()");

    // References holding object
    let type2 = type1.extend({
      bar: type1
    }, {
      destructor: function(super_)
      {
        super_();
        destroyed.push(["type2", this.foo]);
      }
    });

    destroyed = [];
    let obj3 = type1(3);
    let obj4 = type2(4);
    obj4.bar = obj3;
    obj3.release();
    deepEqual(destroyed, [], "Destructor not called if references to object exist");
    obj4.bar = null;
    deepEqual(destroyed, [["type1", 3]], "Destructor called after reference is cleared");

    // Recursive destruction
    destroyed = [];
    let obj5 = type1(5);
    obj4.bar = obj5;
    obj5.release();
    deepEqual(destroyed, [], "Destructor not called if references to object exist");
    obj4.release();
    deepEqual(destroyed, [["type1", 4], ["type2", 4], ["type1", 5]], "Destroying an object released its references");

    // Misbehaving destructors
    let type3 = type1.extend({}, {
      destructor: function(super_)
      {
        this.retain();
      }
    });
    throws(function()
    {
      type3(0).release();
    }, "Retaining reference in destructor is prohibited");

    let type4 = type1.extend({}, {
      destructor: function(super_)
      {
        this.release();
      }
    });
    throws(function()
    {
      type4(0).release();
    }, "Releasing reference in destructor is prohibited");

    let type5 = type1.extend({}, {
      destructor: function(super_)
      {
        this.retain();
        this.release();
      }
    });
    type5(0).release();
    ok(true, "Temporarily retaining reference in destructor is allowed");
  });
})();
