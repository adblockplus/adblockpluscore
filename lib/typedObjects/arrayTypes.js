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

let {ilog2, nextPow2, alloc, dealloc, addBuffer, removeBuffer} = require("typedObjects/utils");

function defaultArrayConstructor()
{
  this.arrayBufferIndex = -1;
};

function defaultArrayDestructor()
{
  this.length = 0;
  this.size = 0;
};

function createGetter(elementGetter, elementShift)
{
  return function(index)
  {
    if (index < 0 || index >= this.length)
      throw new Error("Array index out of bounds");
    return elementGetter.call(this, this.arrayBufferIndex, this.arrayByteOffset + (index << elementShift));
  };
}

function createSetter(elementSetter, elementShift)
{
  return function(index, value)
  {
    if (index < 0 || index >= this.length)
      throw new Error("Array index out of bounds");
    return elementSetter.call(this, this.arrayBufferIndex, this.arrayByteOffset + (index << elementShift), value);
  }
}

function createCombinedConstructor(customConstructor)
{
  return function()
  {
    defaultArrayConstructor.apply(this);
    customConstructor.apply(this, arguments);
  }
}

function createCombinedDestructor(customDestructor)
{
  return function()
  {
    try
    {
      customDestructor.apply(this);
    }
    finally
    {
      defaultArrayDestructor.apply(this);
    }
  }
}

function createLengthWatcher(elementType, elementSetter)
{
  let {STATE_UNINITIALIZED} = require("typedObjects/objectTypes");
  return function lengthWatcher(newLength)
  {
    newLength = newLength | 0;
    if (newLength < 0)
      newLength = 0;
    if (newLength > this.size)
      this.size = newLength;

    let initialValue = elementType.initialValue;
    if (typeof initialValue != "undefined")
    {
      let length = this.length;
      if (newLength > length)
      {
        // We have to call element setter directly here, this.set() will
        // complain because of writing out of bounds (new length isn't set yet).
        // We also need to change state temporarily in order to avoid an attemt
        // to release "existing" values.
        let origState = this._state;
        this._state = STATE_UNINITIALIZED;
        try
        {
          let referenceLength = elementType.referenceLength | 0;
          let bufferIndex = this.arrayBufferIndex | 0;
          for (let i = length, offset = this.arrayByteOffset + length * referenceLength;
              i < newLength;
              i++, offset += referenceLength)
          {
            elementSetter.call(this, bufferIndex, offset, initialValue);
          }
        }
        finally
        {
          this._state = origState;
        }
      }
      else
      {
        for (let i = newLength; i < length; i++)
          this.set(i, initialValue);
      }
    }

    return newLength;
  }
}

function createSizeWatcher(elementType, minElements, bufferSize, buffers, viewTypes, views, firstFree)
{
  let referenceLength = elementType.referenceLength | 0;
  minElements = minElements | 0;
  bufferSize = bufferSize | 0;
  return function sizeWatcher(newSize)
  {
    newSize = newSize | 0;
    let length = this.length | 0;
    if (newSize < length)
      newSize = length;
    if (newSize > 0 && newSize < minElements)
      newSize = minElements;
    newSize = nextPow2(newSize);

    let size = this.size;
    if (size != newSize)
    {
      let origBufferIndex = this.arrayBufferIndex;
      let origByteOffset = this.arrayByteOffset;
      if (newSize > 0)
      {
        // Allocate new buffer
        let bufferIndex, byteOffset;
        let reference = firstFree[newSize];
        if (typeof reference != "undefined")
        {
          [bufferIndex, byteOffset] = alloc(reference,
              referenceLength * newSize, (bufferSize / newSize) | 0,
              buffers, viewTypes, views);
        }
        else
        {
          // This array is too large, it needs an individual buffer
          bufferIndex = addBuffer(referenceLength * newSize, buffers, viewTypes, views);
          bufferOffset = 0;
        }

        if (size > 0)
        {
          let copyBytes = length * referenceLength;
          let src = new Uint8Array(buffers[this.arrayBufferIndex], this.arrayByteOffset, copyBytes);
          let dst = new Uint8Array(buffers[bufferIndex], byteOffset, copyBytes);
          dst.set(src);
        }

        this.arrayBufferIndex = bufferIndex;
        this.arrayByteOffset = byteOffset;
      }
      else
        this.arrayBufferIndex = -1;

      if (size > 0)
      {
        // Release old buffer
        let reference = firstFree[size];
        if (typeof reference != "undefined")
          dealloc(reference, origBufferIndex, origByteOffset);
        else
          removeBuffer(origBufferIndex, buffers, views);
      }
    }

    return newSize;
  }
}

function createArrayType(elementType, typeDescriptor, meta)
{
  if (typeof meta != "object" || meta == null)
    meta = {};

  // We need to make sure that all buffer chunks are big enough to hold a
  // reference in order to manage the free chunks as a linked list. Each array
  // buffer should be dedicated to arrays of particular size - the number of
  // possible sizes is limited as the sizes can only be powers of two.
  let {TypedReference} = require("typedObjects/references");
  let minElements = nextPow2(Math.max(Math.ceil(TypedReference.byteLength / elementType.referenceLength) | 0, 1));
  let bufferSize = ("arrayBufferSize" in meta ? meta.arrayBufferSize | 0 : 1024);
  bufferSize = nextPow2(Math.max(bufferSize, minElements * 2)) | 0;

  let buffers = [];
  let viewTypes = elementType.viewTypes.slice();
  let views = [];
  for (let i = 0, l = viewTypes.length | 0; i < l; i++)
    views.push([]);

  let elementGetter = elementType.createGetter.apply(elementType, [0].concat(views));
  let elementSetter = elementType.createSetter.apply(elementType, [0].concat(views));

  let typedReferenceTypes = TypedReference.viewTypes;
  let typedReferenceViews = [];
  for (let i = 0, l = typedReferenceTypes.length | 0; i < l; i++)
  {
    let type = typedReferenceTypes[i];
    let index = viewTypes.indexOf(type);
    if (index < 0)
    {
      viewTypes.push(type);
      views.push([]);
      index = viewTypes.length - 1;
    }
    typedReferenceViews.push(views[index]);
  }

  let firstFree = [];
  for (let i = minElements; i < bufferSize; i <<= 1)
    firstFree[i] = new TypedReference(-1, typedReferenceViews);

  let {int16, uint32} = require("typedObjects/primitiveTypes");
  typeDescriptor = Object.create(typeDescriptor || {});
  typeDescriptor.arrayBufferIndex = int16;
  typeDescriptor.arrayByteOffset = uint32;
  typeDescriptor.getArrayBuffer = function()
  {
    return this.arrayBufferIndex >= 0 ? buffers[this.arrayBufferIndex] : null;
  };
  typeDescriptor.length = uint32;
  typeDescriptor.size = uint32;

  let elementShift = ilog2(elementType.referenceLength | 0);
  typeDescriptor.get = createGetter(elementGetter, elementShift);
  typeDescriptor.set = createSetter(elementSetter, elementShift);

  if (meta.hasOwnProperty("constructor") && typeof meta.constructor == "function")
    meta.constructor = createCombinedConstructor(meta.constructor);
  else
    meta.constructor = defaultArrayConstructor;

  if (meta.hasOwnProperty("destructor") && typeof meta.destructor == "function")
    meta.destructor = createCombinedDestructor(meta.destructor);
  else
    meta.destructor = defaultArrayDestructor;

  if (!meta.watch || typeof meta.watch != "object")
    meta.watch = {};

  meta.watch.length = createLengthWatcher(elementType, elementSetter);
  meta.watch.size = createSizeWatcher(elementType, minElements, bufferSize, buffers, viewTypes, views, firstFree);

  let {ObjectBase} = require("typedObjects/objectTypes");
  return ObjectBase.extend(typeDescriptor, meta);
}

exports.createArrayType = createArrayType;
