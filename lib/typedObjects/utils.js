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

"use strict";

/**
 * Calculates the binary logarithm (position of highest bit) of an integer.
 * Source: http://graphics.stanford.edu/~seander/bithacks.html#IntegerLogObvious
 */
exports.ilog2 = function ilog2(/**Integer*/ num) /**Integer*/
{
  num = num | 0;
  let result = 0;
  while ((num >>= 1) > 0)
    result++;
  return result;
};

/**
 * Round up a 32-bit integer to the next power of two.
 * Source: See http://graphics.stanford.edu/~seander/bithacks.html#RoundUpPowerOf2
 */
exports.nextPow2 = function nextPow2(/**Integer*/ num) /**Integer*/
{
  num = num | 0;
  num--;
  num |= num >> 1;
  num |= num >> 2;
  num |= num >> 4;
  num |= num >> 8;
  num |= num >> 16;
  return num + 1;
};

/**
 * Returns a property descriptor for an immutable property with given value.
 */
exports.fixedPropertyDescriptor = function fixedPropertyDescriptor(value) /**Object*/
{
  return {
    value: value,
    writable: false,
    configurable: false,
    enumerable: true
  };
};

/**
 * Generates the array of views that need to be passed as parameters for getters
 * and setters of a given type.
 *
 * @param type
 * @param viewTypes array of existing view types (will be extended if necessary)
 * @param views array containing a views arrays for each view type (will be
 *              extended if necessary)
 * @return array of views required for the given type
 */
let getViewsForType = exports.getViewsForType = function getViewsForType(type, viewTypes, views)
{
  let requiredViews = type.viewTypes;
  let result = [];
  for (let i = 0, l = requiredViews.length | 0; i < l; i++)
  {
    let viewType = requiredViews[i];
    let index = viewTypes.indexOf(viewType) | 0;
    if (index < 0)
    {
      index = (viewTypes.push(viewType) | 0) - 1;
      views.push([]);
    }
    result.push(views[index]);
  }
  return result;
};

/**
 * Defines properties with given name and type on an object.
 *
 * @param obj object to define properties on
 * @param properties object mapping property names to their respective types
 * @param viewTypes see getViewsForType()
 * @param views see getViewsForType()
 * @param [offset] byte array offset at which the properties should start
 * @param [cleanupValues] array of property/value combinations to be set when the object is created or destroyed
 * @return new start offset for additional properties
 */
exports.defineProperties = function defineProperties(obj, properties, viewTypes, views, offset, cleanupValues)
{
  offset = offset | 0;

  let propList = [];
  for (let name in properties)
    propList.push([name, properties[name]]);

  // Put larger properties first to make sure alignment requirements are met.
  propList.sort(function(a, b)
  {
    return b[1].referenceLength - a[1].referenceLength;
  });

  // Generates getters and setters for each property.
  let descriptors = {};
  for (let i = 0, l = propList.length | 0; i < l; i++)
  {
    let [name, type] = propList[i];

    let viewParams = getViewsForType(type, viewTypes, views);
    descriptors[name] = {
      get: type.createGetter.apply(type, [offset].concat(viewParams)),
      set: type.createSetter.apply(type, [offset].concat(viewParams)),
      configurable: false,
      enumerable: true
    };
    offset += type.referenceLength;
    if (cleanupValues && typeof type.cleanupValue != "undefined")
      cleanupValues.push([name, type.cleanupValue]);
  }

  // Define properties
  Object.defineProperties(obj, descriptors);

  return offset;
};
