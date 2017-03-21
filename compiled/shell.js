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
