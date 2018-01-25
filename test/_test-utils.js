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
 * along with Adblock Plus. If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

/**
 * Short from withNativeArgumentDeletion - wraps the function with the code
 * deleting native arguments at nativeArgPosition position(s).
 * Be careful, if an exception is thrown while construction of arguments, they
 * are not deleted.
 *
 * @param {(number|number[])} nativeArgPosition
 * @param {Function} fn - original function which should be wrapped
 * @param {Object=} thisObj - 'this' Object to which apply the function fn.
 * @return {Function} a new function object.
 */
exports.withNAD = function(nativeArgPosition, fn, thisObj)
{
  return function(...args)
  {
    try
    {
      fn.apply(thisObj ? thisObj : this, args);
    }
    finally
    {
      for (let i of Array.isArray(nativeArgPosition) ? nativeArgPosition : [nativeArgPosition])
        if (args[i])
          args[i].delete();
    }
  };
};
