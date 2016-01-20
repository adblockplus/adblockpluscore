/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-2016 Eyeo GmbH
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
 * Creates a wrapper function for a setter that will call the watcher function
 * with the new value of the property before executing the actual setter.
 */
function watchSetter(/**Function*/ setter, /**Function*/ watcher) /**Function*/
{
  return function(value)
  {
    setter.call(this, watcher.call(this, value));
  };
}

/**
 * Creates a parameter-less wrapper function around a getter that will get
 * bufferIndex and byteOffset parameters from object properties.
 */
function wrapGetter(/**Function*/ getter) /**Function*/
{
  return function()
  {
    return getter.call(this, this.bufferIndex, this.byteOffset);
  };
}

/**
 * Creates a wrapper function around a setter with value as the only parameter,
 * the bufferIndex and byteOffset parameters will be retrieved from object
 * properties.
 */
function wrapSetter(/**Function*/ setter) /**Function*/
{
  return function(value)
  {
    return setter.call(this, this.bufferIndex, this.byteOffset, value);
  };
}

/**
 * Defines properties with given name and type on an object.
 *
 * @param obj object to define properties on
 * @param properties object mapping property names to their respective types
 * @param viewTypes see getViewsForType()
 * @param views see getViewsForType()
 * @param [offset] byte array offset at which the properties should start
 * @param [watchers] map of watcher functions to be called when a particular property is being set
 * @param [initialValues] array of property/value combinations to be set when the object is created or destroyed
 * @return new start offset for additional properties
 */
exports.defineProperties = function defineProperties(obj, properties, viewTypes, views, offset, watchers, initialValues)
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
      get: wrapGetter(type.createGetter.apply(type, [offset].concat(viewParams))),
      set: wrapSetter(type.createSetter.apply(type, [offset].concat(viewParams))),
      configurable: false,
      enumerable: true
    };

    if (watchers && typeof watchers[name] == "function")
      descriptors[name].set = watchSetter(descriptors[name].set, watchers[name]);

    offset += type.referenceLength;
    if (initialValues && typeof type.initialValue != "undefined")
      initialValues.push([name, type.initialValue]);
  }

  // Define properties
  Object.defineProperties(obj, descriptors);

  return offset;
};

/**
 * Creates a new array buffer and adds the necessary views.
 *
 * @param {Integer} byteSize  bytes to allocate for the buffer
 * @param {Array} buffers  existing buffers (will be modified)
 * @param {Array} viewTypes  view types for the buffers
 * @param {Array} views  existing buffer views (will be modified)
 * @result {Integer} index of the buffer created
 */
let addBuffer = exports.addBuffer = function(byteSize, buffers, viewTypes, views)
{
  let buffer = new ArrayBuffer(byteSize | 0);
  buffers.push(buffer);
  for (let i = 0, l = viewTypes.length | 0; i < l; i++)
    views[i].push(new viewTypes[i](buffer));
  return (buffers.length | 0) - 1;
};

/**
 * Releases an array buffer.
 *
 * @param {Integer} bufferIndex  index of the buffer to be released.
 * @param {Array} buffers  existing buffers (will be modified)
 * @param {Array} views  existing buffer views (will be modified)
 */
exports.removeBuffer = function(bufferIndex, buffers, views)
{
  delete buffers[bufferIndex];
  for (let i = 0, l = views.length | 0; i < l; i++)
    delete views[i][bufferIndex];
};

/**
 * Allocates a new fixed-size element. It will return the first available free
 * block or create a new buffer if the existing ones have no space left.
 *
 * @param {TypedReference} firstFree  head of the linked list pointing to unallocated elements
 * @param {Integer} byteLength  size of an element
 * @param {Integer} bufferSize  number of elements in a buffer
 * @param {Array} buffers  existing buffers (might be modified in necessary)
 * @param {Array} viewTypes  view types for the buffers
 * @param {Array} views  existing buffer views (might be modified if necessary)
 * @result {Array} [bufferIndex, byteOffset] parameters of the newly allocated block
 */
exports.alloc = function(firstFree, byteLength, bufferSize, buffers, viewTypes, views)
{
  let bufferIndex = firstFree.bufferIndex | 0;
  let byteOffset = firstFree.byteOffset | 0;
  if (bufferIndex >= 0)
  {
    // There is still a free spot, simply move on firstFree reference
    [firstFree.bufferIndex, firstFree.byteOffset] =
        [firstFree.targetBufferIndex, firstFree.targetByteOffset];
  }
  else
  {
    byteLength = byteLength | 0;
    bufferSize = bufferSize | 0;

    // Create new buffer and use the first element of it
    bufferIndex = addBuffer(byteLength * bufferSize, buffers, viewTypes, views);
    byteOffset = 0;

    // Mark last element of the new buffer as the last free spot
    firstFree.bufferIndex = bufferIndex;
    firstFree.byteOffset = (bufferSize - 1) * byteLength;
    firstFree.targetBufferIndex = -1;

    // Make each remaining element of the new buffer point to the next one
    for (let i = bufferSize - 2; i >= 1; i--)
    {
      let nextByteOffset = firstFree.byteOffset;
      firstFree.byteOffset = nextByteOffset - byteLength;
      firstFree.targetBufferIndex = bufferIndex;
      firstFree.targetByteOffset = nextByteOffset;
    }
  }
  return [bufferIndex, byteOffset];
};

/**
 * Releases the block at given offset so that it can be allocated again.
 *
 * @param {TypedReference} firstFree  head of the linked list pointing to unallocated elements
 * @param {Integer} bufferIndex  buffer index of the block to be released
 * @param {Integer} byteOffset  byte offset o fthe block to be released
 */
exports.dealloc = function(firstFree, bufferIndex, byteOffset)
{
  let oldFreeBufferIndex = firstFree.bufferIndex | 0;
  let oldFreeByteOffset = firstFree.byteOffset | 0;

  firstFree.bufferIndex = bufferIndex | 0;
  firstFree.byteOffset = byteOffset | 0;
  firstFree.targetBufferIndex = oldFreeBufferIndex;
  firstFree.targetByteOffset = oldFreeByteOffset;
};
