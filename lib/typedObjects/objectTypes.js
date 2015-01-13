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

let {fixedPropertyDescriptor, getViewsForType, defineProperties, alloc, dealloc} = require("typedObjects/utils");
let {Reference, TypedReference} = require("typedObjects/references");
let {uint8, uint32} = require("typedObjects/primitiveTypes");
let {createArrayType} = require("typedObjects/arrayTypes");

const STATE_UNINITIALIZED = exports.STATE_UNINITIALIZED = 0;
const STATE_CREATED = exports.STATE_CREATED = 1;
const STATE_RELEASING = exports.STATE_RELEASING = 2;

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
  let [bufferIndex, byteOffset] = alloc(this.firstFree, this.byteLength,
      this.bufferSize, this.buffers, this.viewTypes, this.views);

  let result = Object.create(this.proto, {
    typeId: fixedPropertyDescriptor(this.typeId),
    bufferIndex: fixedPropertyDescriptor(bufferIndex),
    byteOffset: fixedPropertyDescriptor(byteOffset)
  });

  result._state = STATE_UNINITIALIZED;
  for (let [prop, value] of this.initialValues)
    result[prop] = value;
  result._state = STATE_CREATED;
  result._refCount = 1;

  if (this.constructor)
    this.constructor.apply(result, arguments);
  return result;
}

function free(obj)
{
  try
  {
    if (this.destructor)
    {
      this.destructor.call(obj);
      if (obj._refCount | 0)
        throw new Error("Reference count is no longer zero after calling the destructor");
    }
  }
  finally
  {
    for (let [prop, value] of this.initialValues)
      obj[prop] = value;

    dealloc(this.firstFree, obj.bufferIndex, obj.byteOffset);
  }
}

function createGetter(offset)
{
  offset = offset | 0;

  let views = Array.prototype.slice.call(arguments, 1);
  let reference = new Reference(types, views);
  return function(bufferIndex, byteOffset)
  {
    reference.bufferIndex = bufferIndex | 0;
    reference.byteOffset = (byteOffset | 0) + offset;
    return fromReference(reference);
  };
}

function createSetter(typeId, offset)
{
  typeId = typeId | 0;
  offset = offset | 0;

  let views = Array.prototype.slice.call(arguments, 2);
  let reference = new Reference(types, views);
  return function(bufferIndex, byteOffset, value)
  {
    if (value && !isInstance(typeId, value))
      throw new Error("Incompatible type");

    reference.bufferIndex = bufferIndex | 0;
    reference.byteOffset = (byteOffset | 0) + offset;

    if ((this._state | 0) > STATE_UNINITIALIZED)
    {
      let oldValue = fromReference(reference);
      if (oldValue)
        oldValue.release();
    }

    if (value)
    {
      reference.typeId = value.typeId;
      reference.targetBufferIndex = value.bufferIndex;
      reference.targetByteOffset = value.byteOffset;
      value.retain();
    }
    else
      reference.typeId = -1;
  };
}

/**
 * Overridden methods get the respective method of the superclass as the first
 * parameter. This function will create a wrapper function for the method that
 * forwards all arguments to the actual methods but also injects super as first
 * parameter.
 */
function createSubclassMethod(method, super_)
{
  return function()
  {
    let args = [].slice.apply(arguments);
    args.unshift(() => super_.apply(this, arguments));
    return method.apply(this, args);
  };
}

function extend(parentTypeInfo, typeDescriptor, meta)
{
  if (typeof meta != "object" || meta == null)
    meta = {};

  let properties = Object.create(parentTypeInfo && parentTypeInfo.properties);

  // Methods have to be actually copied here, prototypes won't work correctly
  // with Object.defineProperties().
  let methods = Object.create(null);
  if (parentTypeInfo)
    for (let key in parentTypeInfo.methods)
      methods[key] = parentTypeInfo.methods[key];

  let maxReferenceLength = TypedReference.byteLength | 0;
  for (let name in typeDescriptor)
  {
    let type = typeDescriptor[name];
    if (type && typeof type.referenceLength == "number")
    {
      if (name in methods)
        throw new Error("Property " + name + " masks a method with the same name");
      if (name in properties)
      {
        if (properties[name] == type)
          continue;
        else
          throw new Error("Cannot redefine type of property " + name + " in subclass");
      }

      // Property with type
      properties[name] = type;

      let referenceLength = type.referenceLength | 0;
      if (referenceLength > maxReferenceLength)
        maxReferenceLength = referenceLength;
    }
    else if (typeof type == "function")
    {
      // Method
      if (name in properties)
        throw new Error("Method " + name + " masks a property with the same name");

      if (name in methods)
        type = createSubclassMethod(type, methods[name].value);
      methods[name] = fixedPropertyDescriptor(type);
    }
    else
      throw new Error("Unrecognized type " + type + " given for property " + name);
  }

  // Combine inherited watchers with the ones specified for this object
  let watchers = parentTypeInfo && parentTypeInfo.watchers;
  if (meta.watch)
  {
    watchers = Object.create(watchers);
    for (let key in meta.watch)
      watchers[key] = meta.watch[key];
  }

  let proto = {};
  let buffers = [];
  let viewTypes = [];
  let views = [];
  let initialValues = [];
  let byteLength = defineProperties(proto, properties, viewTypes, views, 0, watchers, initialValues);
  Object.defineProperties(proto, methods);

  // Round up to be a multiple of the maximal property size
  byteLength = ((byteLength - 1) | (maxReferenceLength - 1)) + 1;

  // We need to be able to store a typed reference in the object's buffer
  byteLength = Math.max(byteLength, TypedReference.byteLength) | 0;
  let typedReferenceViews = getViewsForType(TypedReference, viewTypes, views);

  // Take constructor and destructor from meta parameters, allow calling
  // superclass constructor/destructor.
  let constructor = parentTypeInfo && parentTypeInfo.constructor;
  if (meta.hasOwnProperty("constructor") && typeof meta.constructor == "function")
  {
    if (constructor)
      constructor = createSubclassMethod(meta.constructor, constructor);
    else
      constructor = meta.constructor;
  }

  let destructor = parentTypeInfo && parentTypeInfo.destructor;
  if (meta.hasOwnProperty("destructor") && typeof meta.destructor == "function")
  {
    if (destructor)
      destructor = createSubclassMethod(meta.destructor, destructor);
    else
      destructor = meta.destructor;
  }

  let typeId = types.length | 0;
  let typeInfo = {
    byteLength: byteLength,
    bufferSize: "bufferSize" in meta ? Math.max(meta.bufferSize | 0, 2) : 128,
    firstFree: new TypedReference(typeId, typedReferenceViews),
    proto: proto,
    properties: properties,
    methods: methods,
    watchers: watchers,
    buffers: buffers,
    viewTypes: viewTypes,
    views: views,
    initialValues: initialValues,
    typeId: typeId,
    parentTypeInfo: parentTypeInfo,
    constructor: constructor,
    destructor: destructor
  };

  let result = create.bind(typeInfo);
  Object.defineProperties(result, {
    byteLength: fixedPropertyDescriptor(byteLength),

    referenceLength: fixedPropertyDescriptor(Reference.byteLength),
    viewTypes: fixedPropertyDescriptor(Reference.viewTypes),
    initialValue: fixedPropertyDescriptor(null),

    typeId: fixedPropertyDescriptor(typeId),
    extend: fixedPropertyDescriptor(extend.bind(null, typeInfo)),
    isInstance: fixedPropertyDescriptor(isInstance.bind(null, typeId)),
    Array: fixedPropertyDescriptor(createArrayType.bind(null, result)),

    createGetter: fixedPropertyDescriptor(createGetter),
    createSetter: fixedPropertyDescriptor(createSetter.bind(null, typeId))
  });
  types.push(typeInfo);
  return result;
}

function isInstance(typeId, obj)
{
  typeId = typeId | 0;

  // TODO: This could be optimized by compiling the list of all subclasses for
  // each type up front. Question is whether this is worth it.
  let typeInfo = types[obj.typeId | 0];
  while (typeInfo)
  {
    if ((typeInfo.typeId | 0) == typeId)
      return true;
    typeInfo = typeInfo.parentTypeInfo;
  }
  return false;
}

let ObjectBase = exports.ObjectBase = extend(null, {
  _state: uint8,
  _refCount: uint32,

  equals: function(obj)
  {
    if (!obj)
      return false;
    return this.typeId == obj.typeId && this.bufferIndex == obj.bufferIndex && this.byteOffset == obj.byteOffset;
  },

  retain: function()
  {
    this._refCount++;
  },

  release: function()
  {
    this._refCount--;
    if (this._refCount == 0 && this._state < STATE_RELEASING)
    {
      this._state = STATE_RELEASING;
      free.call(types[this.typeId | 0], this);
    }
  }
}, null);

exports.ObjectType = ObjectBase.extend;
