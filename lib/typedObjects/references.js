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

let {nextPow2, defineProperties} = require("typedObjects/utils");
let {uint16, int16, uint32} = require("typedObjects/primitiveTypes");
let {fixedPropertyDescriptor} = require("typedObjects/utils");

function calculateSize(properties)
{
  let result = 0;
  for (let name in properties)
    result += properties[name].referenceLength | 0;
  return nextPow2(result) | 0;
}

function getViewTypes(properties)
{
  let result = [];
  for (let name in properties)
  {
    let requiredViews = properties[name].viewTypes;
    for (let i = 0, l = requiredViews.length | 0; i < l; i++)
      if (result.indexOf(requiredViews[i]) < 0)
        result.push(requiredViews[i]);
  }
  return result;
}

let TypedReference_properties = {
  targetBufferIndex: int16,
  targetByteOffset: uint32
};

let Reference_properties = {
  __proto__: TypedReference_properties,
  typeId: int16
};

/**
 * Helper class to read/write properties referencing other objects. bufferIndex
 * and byteOffset properties of the reference need to be set in order to use it.
 *
 * @param types list of registered object types used to resolve typeId
 * @param views list of views corresponding to Reference.viewTypes
 */
function Reference(types, views)
{
  let result = Object.create(Reference.prototype, {
    types: fixedPropertyDescriptor(types)
  });
  defineProperties(result, Reference_properties, Reference.viewTypes, views, 0);
  return result;
}
Reference.prototype = {
  get typeInfo()
  {
    let typeId = this.typeId | 0;
    if (this.typeId >= 0)
      return this.types[this.typeId];
    else
      return null;
  },
  bufferIndex: -1,
  byteOffset: 0
}
Reference.byteLength = calculateSize(Reference_properties);
Reference.viewTypes = Object.freeze(getViewTypes(Reference_properties));
exports.Reference = Reference;

/**
 * Helper class to read/write references to a fixed type, this is useful for
 * references to free buffer elements. bufferIndex and byteOffset properites
 * of the reference need to be set in order to use it.
 *
 * @param typeInfo metadata of the type that this reference should be used for
 * @param views list of views corresponding to TypedReference.viewTypes
 */
function TypedReference(typeInfo, views)
{
  let result = Object.create(Reference.prototype, {
    typeInfo: fixedPropertyDescriptor(typeInfo),
  });
  defineProperties(result, TypedReference_properties, TypedReference.viewTypes, views, 0);
  return result;
}
TypedReference.byteLength = calculateSize(TypedReference_properties);
TypedReference.viewTypes = Object.freeze(getViewTypes(TypedReference_properties));
exports.TypedReference = TypedReference;
