/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-2015 Eyeo GmbH
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

/**
 * @fileOverview
 * This is an implementation of typed objects similar to the ECMAScript Harmony
 * proposal (http://wiki.ecmascript.org/doku.php?id=harmony:typed_objects).
 * The main difference is that it allows creating actual objects rather than
 * merely structured data.
 *
 * Defining a type
 * ---------------
 *
 *    const Point2D = new ObjectType({
 *                      x: uint32,
 *                      y: uint32,
 *                      rotate: function() { ... }
 *                    }, {
 *                      constructor: function(x, y) { ... },
 *                      bufferSize: 16
 *                    });
 *
 * The first parameter to ObjectType defines object properties and methods. A
 * name can either be associted with a type (property) or function (method).
 * Numeric value types from the ECMAScript Harmony proposal are predefined as
 * well as "boolean" which is an alias for uint8. In addition to that, already
 * defined object types can be used.
 *
 * The optional second parameter sets type metadata:
 *
 *    constructor: function that will be called whenever an object of the type
 *        is created. Parameters supplied during object creation will be passed
 *        to the constructor.
 *    destructor: function that will be called when an object of the type is
 *        freed.
 *    bufferSize: number of objects that should be placed into a single typed
 *        buffer (by default 128).
 *    watch: a map assigning watcher functions to properties. These functions
 *        are called with the new property value before the property is set.
 *        They have to return the value that should actually be set for the
 *        property, it doesn't necessarily have to be the original value.
 *
 * Creating and releasing an object instance
 * -----------------------------------------
 *
 *    var point = Point2D(5, 10);
 *    point.rotate(10);
 *    console.log(point.x + ", " + point.y);
 *
 * The parameters 5 and 10 will be passed to the constructor function defined
 * for this type.
 *
 * Once the object instance is no longer needed it should be released:
 *
 *    point.release();
 *
 * This will not necessarily free the object but merely decrease its reference
 * count. The object will only be freed when its reference count reaches zero.
 *
 * If you need to hold on to an object that you didn't create (e.g. a function
 * parameter) you have to call object.retain() to increase its reference count.
 * Once the object is no longer needed you should call object.release().
 * However, it is preferable to use references from other typed objects to hold
 * on to an object - the necessary reference count increases and decreases will
 * be performed automatically then.
 *
 * Type inheritance
 * ----------------
 *
 *    var Point3D = Point2D.extend({
 *      z: uint32
 *    }, {
 *      constructor: function(super_, x, y, z)
 *      {
 *        super_(x, y);
 *        ...
 *      }
 *    });
 *
 * Extended types can be used wherever their base type is required. The
 * parameters taken by type.extend() are the same as parameters of
 * new ObjectType(), the only difference is that properties and methods
 * of the original type are taken over. Methods and constructors can be
 * overwritten, they will then get superclass method/constructor as the first
 * parameter and can call it.
 *
 * Common object methods
 * ---------------------
 *
 * All objects inherit from ObjectBase type implicitly and share its methods.
 * In particular, object.equals() can be used to compare objects:
 *
 *    var point1 = Point2D(5, 10);
 *    var point2 = Point2D(6, 12);
 *    console.log(point1.equals(point2)); // false
 *    console.log(point1.equals(point1)); // true
 *
 * Note that JavaScript comparison operators == and != won't always produce
 * correct results for typed objects.
 *
 * Array types
 * -----------
 *
 * An array type can be created with any other type as element type:
 *
 *    var uint8Array = uint8.Array();
 *    var array = uint8Array();
 *    array.length = 2;
 *    array.set(0, 5);
 *    array.set(1, 8);
 *
 *    var Blob = ObjectType({
 *      name: uint8Array,
 *      data: uint8Array
 *    });
 *    var blob = Blob();
 *    blob.data = array;
 *    array.release();
 *
 * Array() function takes the same parameters as ObjectType(), meaning that an
 * array can have a constructor, destructor and custom properties or methods.
 * This also means that there can be multiple array types for each element type,
 * each Array() call will generate a new type that won't be compatible with
 * the other types. The metadata parameter for arrays can have the additional
 * arrayBufferSize property determining the number of array elements stored in
 * a single buffer (not the same as bufferSize property which applies to buffers
 * containing array metadata and custom array properties and determines the
 * number of arrays stored in these buffers).
 *
 * An array is an object meaning that it has the properties common for all
 * objects, in particular retain() and release() determining when the array is
 * garbage collected. In addition, it has the following properties and methods:
 *
 *    get(index): retrieves the array element at specified index.
 *    set(index, value): sets the array element at specified index.
 *    length: number of elements in the array, by default 0. Increase the length
 *        to match your data size.
 *    size: size of the allocated buffer in array elements, will be at least
 *        equal to length. Normally you won't need to set the size explicitly.
 *        However, the size won't decrease automatically if the array gets
 *        smaller so you might want to set it in order to shrink the array.
 *    splice(), push(), pop(), unshift(), shift(): these work the same as the
 *        corresponding methods on JavaScript's Array class. Note however that
 *        using pop() and shift() with arrays of objects is dangerous if you
 *        want to work with their return value: this operation will call
 *        release() on the resulting object before returning which might result
 *        in it being garbage collected. You should call retain() on the array
 *        element before calling pop() or shift().
 *
 * String type
 * -----------
 *
 * There is a special array type called string:
 *
 *    var str1 = string();            // empty string
 *    var str2 = string(2);           // "\0\0"
 *    var str3 = string("foo");       // "foo"
 *    var str4 = string(str3, 1, 2);  // "oo"
 *    str4.get(0);                    // 111 - character code of "o"
 *
 * Without any constructor parameters the string will be empty, a number as
 * parameter will set the initial string length accordingly. A JavaScript string
 * or another string instance as first parameter indicate that the string data
 * should be copied from these. Optionally, a second (offset) and third
 * parameter (length) can be given.
 *
 * To convert a string instance into a JavaScript string you can call the
 * toString() method.
 */

function forwardExports(module)
{
  let moduleExports = require(module);
  for (let key in moduleExports)
    exports[key] = moduleExports[key];
}

forwardExports("typedObjects/primitiveTypes");
forwardExports("typedObjects/objectTypes");
forwardExports("typedObjects/stringType");
