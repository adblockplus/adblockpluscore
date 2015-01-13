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

let {uint16} = require("typedObjects/primitiveTypes");

let string = exports.string = uint16.Array({
  toString: function()
  {
    let buffer = this.getArrayBuffer();
    if (!buffer)
      return "";
    let array = new Uint16Array(buffer, this.arrayByteOffset, this.length);
    return String.fromCharCode.apply(null, array);
  }
}, {
  constructor: function(value, offset, length)
  {
    let type = typeof value;
    if (type == "number")
      this.length = value | 0;
    else if (type == "string" || (value && string.isInstance(value)))
    {
      let sourceLength = value.length | 0;
      offset = Math.min(sourceLength, offset | 0)
      length = (typeof length == "number" ? length | 0 : sourceLength);
      length = Math.min(length, sourceLength - offset);
      this.length = length;

      if (length > 0)
      {
        let dest = new Uint16Array(this.getArrayBuffer(), this.arrayByteOffset, length);
        if (type == "string")
        {
          for (let i = 0; i < length; i++, offset++)
            dest[i] = value.charCodeAt(offset);
        }
        else
        {
          let src = new Uint16Array(value.getArrayBuffer(),
              value.arrayByteOffset + offset * (uint16.referenceLength | 0),
              length);
          dest.set(src);
        }
      }
    }
  }
});
