/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-2017 eyeo GmbH
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

"Compiled from https://hg.adblockplus.org/adblockplus/ with Emscripten {{{EMSCRIPTEN_VERSION}}}";

var FilterNotifier = require("filterNotifier").FilterNotifier;

var regexps =
{
  _data: Object.create(null),
  _counter: 0,

  create: function(source, matchCase)
  {
    var id = ++this._counter;
    try
    {
      this._data[id] = new RegExp(readString(source), matchCase ? "" : "i");
      return id;
    }
    catch (e)
    {
      return -1;
    }
  },

  delete: function(id)
  {
    delete this._data[id];
  },

  test: function(id, str)
  {
    return this._data[id].test(readString(str));
  }
};

var Module =
{
  preRun: [],
  postRun: [],
  print: console.log.bind(console),
  printErr: console.error.bind(console),

  getMemoryLayout: function()
  {
    return {
      'static_base':  STATIC_BASE,
      'static_top':   STATICTOP,
      'stack_base':   STACK_BASE,
      'stack_top':    STACKTOP,
      'stack_max':    STACK_MAX,
      'dynamic_base': DYNAMIC_BASE,
      'dynamic_top':  DYNAMICTOP,
      'total_memory': TOTAL_MEMORY
    };
  }
};
var ENVIRONMENT_IS_WEB = false, ENVIRONMENT_IS_NODE = false,
    ENVIRONMENT_IS_WORKER = false, ENVIRONMENT_IS_SHELL = true;

{{BODY}}

Object.assign(exports, Module);
