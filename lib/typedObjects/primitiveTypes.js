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

let {ilog2} = require("typedObjects/utils");
let {createArrayType} = require("typedObjects/arrayTypes");

function createGetter(shift, offset, view)
{
  shift = shift | 0;
  offset = offset | 0;
  offset >>= shift;
  return function(bufferIndex, byteOffset)
  {
    bufferIndex = bufferIndex | 0;
    byteOffset = byteOffset | 0;
    return view[bufferIndex][(byteOffset >> shift) + offset];
  };
}

function createSetter(shift, offset, view)
{
  shift = shift | 0;
  offset = offset | 0;
  offset >>= shift;
  return function(bufferIndex, byteOffset, value)
  {
    bufferIndex = bufferIndex | 0;
    byteOffset = byteOffset | 0;
    view[bufferIndex][(byteOffset >> shift) + offset] = value;
  };
}

function PrimitiveType(viewType)
{
  let result = Object.create(PrimitiveType.prototype);
  result.viewTypes = [viewType];
  result.byteLength = result.referenceLength = viewType.BYTES_PER_ELEMENT | 0;

  let offsetShift = ilog2(result.byteLength) | 0;
  result.createGetter = createGetter.bind(null, offsetShift);
  result.createSetter = createSetter.bind(null, offsetShift);
  // Note: this is a pretty inefficient way to zero out initial values. We
  // should consider using ArrayBuffer.fill(0) once it becomes available
  // (https://bugzilla.mozilla.org/show_bug.cgi?id=730880).
  result.initialValue = 0;
  result.Array = createArrayType.bind(null, result);
  Object.freeze(result);
  return result;
}

exports.uint8 = exports.boolean = new PrimitiveType(Uint8Array);
exports.uint8clamped = new PrimitiveType(Uint8ClampedArray);
exports.int8 = new PrimitiveType(Int8Array);
exports.uint16 = new PrimitiveType(Uint16Array);
exports.int16 = new PrimitiveType(Int16Array);
exports.uint32 = new PrimitiveType(Uint32Array);
exports.int32 = new PrimitiveType(Int32Array);
exports.float32 = new PrimitiveType(Float32Array);
exports.float64 = new PrimitiveType(Float64Array);
