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

let {fixedPropertyDescriptor, getViewsForType, defineProperties} = require("typedObjects/utils");
let {Reference, TypedReference} = require("typedObjects/references");

/**
 * List of registered types (typeId is the index in that array).
 */
let types = [];

function fromReference(reference)
{
  let typeInfo = reference.typeInfo;
  if (typeInfo)
  {
    return Object.create(typeInfo.proto, {
      typeId: fixedPropertyDescriptor(typeInfo.typeId),
      bufferIndex: fixedPropertyDescriptor(reference.targetBufferIndex),
      byteOffset: fixedPropertyDescriptor(reference.targetByteOffset)
    });
  }
  else
    return null;
}

function create()
{
  let {bufferIndex, byteOffset} = this.firstFree;
  if (bufferIndex >= 0)
  {
    // There is still a free spot, simply move on firstFree reference
    [this.firstFree.bufferIndex, this.firstFree.byteOffset] =
        [this.firstFree.targetBufferIndex, this.firstFree.targetByteOffset];
  }
  else
  {
    let viewTypes = this.viewTypes;
    let views = this.views;
    let byteLength = this.byteLength | 0;
    let bufferSize = this.bufferSize | 0;

    // Create new buffer and use the first element of it
    let buffer = new ArrayBuffer(byteLength * bufferSize);
    bufferIndex = (this.buffers.push(buffer) | 0) - 1;
    byteOffset = 0;
    for (let i = 0, l = viewTypes.length | 0; i < l; i++)
      views[i].push(new viewTypes[i](buffer));

    // Mark last element of the new buffer as the last free spot
    this.firstFree.bufferIndex = bufferIndex;
    this.firstFree.byteOffset = (bufferSize - 1) * byteLength;
    this.firstFree.targetBufferIndex = -1;

    // Make each remaining element of the new buffer point to the next one
    for (let i = bufferSize - 2; i >= 1; i--)
    {
      let nextByteOffset = this.firstFree.byteOffset;
      this.firstFree.byteOffset = nextByteOffset - byteLength;
      this.firstFree.targetBufferIndex = bufferIndex;
      this.firstFree.targetByteOffset = nextByteOffset;
    }
  }

  let result = Object.create(this.proto, {
    typeId: fixedPropertyDescriptor(this.typeId),
    bufferIndex: fixedPropertyDescriptor(bufferIndex),
    byteOffset: fixedPropertyDescriptor(byteOffset)
  });
  if (this.constructor)
    this.constructor.apply(result, arguments);
  return result;
}

function createGetter(offset)
{
  offset = offset | 0;

  let views = Array.prototype.slice.call(arguments, 1);
  let reference = new Reference(types, views);
  return function()
  {
    reference.bufferIndex = this.bufferIndex | 0;
    reference.byteOffset = (this.byteOffset | 0) + offset;
    return fromReference(reference);
  };
}

function createSetter(typeId, offset)
{
  typeId = typeId | 0;
  offset = offset | 0;

  let views = Array.prototype.slice.call(arguments, 2);
  let reference = new Reference(types, views);
  return function(value)
  {
    if (value && value.typeId != typeId)
      throw new Error("Incompatible type");

    reference.bufferIndex = this.bufferIndex | 0;
    reference.byteOffset = (this.byteOffset | 0) + offset;
    if (value)
    {
      reference.typeId = value.typeId;
      reference.targetBufferIndex = value.bufferIndex;
      reference.targetByteOffset = value.byteOffset;
    }
    else
      reference.typeId = -1;
  };
}

function ObjectType(properties, meta)
{
  if (typeof meta != "object" || meta == null)
    meta = {};

  let propList = [];
  let proto = {};
  let maxReferenceLength = TypedReference.byteLength | 0;
  for (let name in properties)
  {
    let type = properties[name];
    if (type && typeof type.referenceLength == "number")
    {
      // Property with type
      propList.push([name, type]);

      let referenceLength = type.referenceLength | 0;
      if (referenceLength > maxReferenceLength)
        maxReferenceLength = referenceLength;
    }
    else if (typeof type == "function")
    {
      // Method
      Object.defineProperty(proto, name, fixedPropertyDescriptor(type));
    }
    else
      throw new Error("Unrecognized type " + type + " given for property " + name);
  }

  let buffers = [];
  let viewTypes = [];
  let views = [];
  let byteLength = defineProperties(proto, propList, viewTypes, views, 0);

  // Round up to be a multiple of the maximal property size
  byteLength = ((byteLength - 1) | (maxReferenceLength - 1)) + 1;

  // We need to be able to store a typed reference in the object's buffer
  byteLength = Math.max(byteLength, TypedReference.byteLength) | 0;
  let typedReferenceViews = getViewsForType(TypedReference, viewTypes, views);

  let typeId = types.length | 0;
  let typeInfo = {
    byteLength: byteLength,
    bufferSize: "bufferSize" in meta ? Math.max(meta.bufferSize | 0, 2) : 128,
    firstFree: new TypedReference(typeId, typedReferenceViews),
    proto: proto,
    buffers: buffers,
    viewTypes: viewTypes,
    views: views,
    typeId: typeId,
    constructor: (meta.hasOwnProperty("constructor") && typeof meta.constructor == "function" ? meta.constructor : null)
  };

  let result = create.bind(typeInfo);
  Object.defineProperties(result, {
    byteLength: fixedPropertyDescriptor(byteLength),

    referenceLength: fixedPropertyDescriptor(Reference.byteLength),
    viewTypes: fixedPropertyDescriptor(Reference.viewTypes),

    typeId: fixedPropertyDescriptor(typeId),

    createGetter: fixedPropertyDescriptor(createGetter),
    createSetter: fixedPropertyDescriptor(createSetter.bind(null, typeId))
  });
  types.push(typeInfo);
  return result;
}
exports.ObjectType = ObjectType;
