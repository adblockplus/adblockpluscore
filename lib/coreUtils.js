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

/** @module */

"use strict";

/**
 * Returns all own enumerable property descriptors of a given object.
 *
 * @param {object} obj The object for which to get all own enumerable property
 *   descriptors.
 *
 * @returns {object} All own enumerable property descriptors of the object.
 */
function desc(obj)
{
  // Compatibility note: There is a similar function
  // Object.getOwnPropertyDescriptors() available on Chrome 54 and Firefox 50
  // onwards, with slightly different (but compatible) semantics.
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyDescriptors
  let descriptor = {};

  for (let key of Object.keys(obj))
    descriptor[key] = Object.getOwnPropertyDescriptor(obj, key);

  return descriptor;
}

/**
 * Extends a class.
 *
 * Use this function to subclass a class by using the return value as the
 * {@link https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Objects/Object_prototypes prototype}
 * of the subclass.
 *
 * @param {function} cls The class to extend.
 * @param {object} properties The desired properties of the returned prototype.
 *   Only the {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Enumerability_and_ownership_of_properties own enumerable properties}
 *   of this object are assigned to the returned prototype.
 *
 * @returns {object} An object representing the
 *   {@link https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Objects/Object_prototypes prototype}
 *   of the subclass.
 *
 * @example
 *
 * function Foo() {}
 *
 * Foo.prototype = {
 *   a: 1
 * };
 *
 * function Bar() {}
 *
 * Bar.prototype = extend(Foo, {
 *   b: 2
 * });
 *
 * let bar = new Bar();
 *
 * assert.ok(bar instanceof Foo);
 * assert.equal(bar.a, 1);
 */
exports.extend = function extend(cls, properties)
{
  return Object.create(cls.prototype, desc(properties));
};
