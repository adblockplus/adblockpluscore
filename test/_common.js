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
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const SandboxedModule = require("sandboxed-module");

const MILLIS_IN_SECOND = exports.MILLIS_IN_SECOND = 1000;
const MILLIS_IN_MINUTE = exports.MILLIS_IN_MINUTE = 60 * MILLIS_IN_SECOND;
const MILLIS_IN_HOUR = exports.MILLIS_IN_HOUR = 60 * MILLIS_IN_MINUTE;

let Services = {
  obs: {
    addObserver() {}
  }
};
let XPCOMUtils = {
  generateQI() {}
};
let FileUtils = {};
let resources = {Services, XPCOMUtils, FileUtils};

let globals = {
  atob: data => Buffer.from(data, "base64").toString("binary"),
  btoa: data => Buffer.from(data, "binary").toString("base64"),
  Ci: {
  },
  Cu: {
    import(resource)
    {
      let match = /^resource:\/\/gre\/modules\/(.+)\.jsm$/.exec(resource);
      let resourceName = match && match[1];
      if (resourceName && resources.hasOwnProperty(resourceName))
        return {[resourceName]: resources[resourceName]};

      throw new Error(
        "Attempt to import unknown JavaScript module " + resource
      );
    },
    reportError(e) {}
  },
  console: {
    log() {},
    error() {}
  },
  navigator: {
  },
  onShutdown: {
    add() {}
  },
  // URL is global in Node 10. In Node 7+ it must be imported.
  URL: typeof URL == "undefined" ? require("url").URL : URL
};

let knownModules = new Map();
for (let dir of [path.join(__dirname, "stub-modules"),
                 path.join(__dirname, "..", "lib")])
{
  for (let file of fs.readdirSync(path.resolve(dir)))
  {
    if (path.extname(file) == ".js")
      knownModules.set(path.basename(file, ".js"), path.resolve(dir, file));
  }
}

function addExports(exports)
{
  return function(source)
  {
    let extraExports = exports[path.basename(this.filename, ".js")];
    if (extraExports)
    {
      for (let name of extraExports)
      {
        source += `
          Object.defineProperty(exports, "${name}", {get: () => ${name}});`;
      }
    }
    return source;
  };
}

function rewriteRequires(source)
{
  function escapeString(str)
  {
    return str.replace(/(["'\\])/g, "\\$1");
  }

  return source.replace(/(\brequire\(["'])([^"']+)/g, (match, prefix, request) =>
  {
    if (knownModules.has(request))
      return prefix + escapeString(knownModules.get(request));
    return match;
  });
}

exports.createSandbox = function(options)
{
  if (!options)
    options = {};

  let sourceTransformers = [rewriteRequires];
  if (options.extraExports)
    sourceTransformers.push(addExports(options.extraExports));

  // This module loads itself into a sandbox, keeping track of the require
  // function which can be used to load further modules into the sandbox.
  return SandboxedModule.require("./_common", {
    globals: Object.assign({}, globals, options.globals),
    sourceTransformers
  }).require;
};

exports.require = require;

exports.setupTimerAndXMLHttp = function()
{
  let currentTime = 100000 * MILLIS_IN_HOUR;
  let startTime = currentTime;

  let fakeTimer = {
    callback: null,
    delay: -1,
    nextExecution: 0,

    initWithCallback(callback, delay, type)
    {
      if (this.callback)
        throw new Error("Only one timer instance supported");
      if (type != 1)
        throw new Error("Only TYPE_REPEATING_SLACK timers supported");

      this.callback = callback;
      this.delay = delay;
      this.nextExecution = currentTime + delay;
    },

    trigger()
    {
      if (currentTime < this.nextExecution)
        currentTime = this.nextExecution;
      try
      {
        this.callback();
      }
      finally
      {
        this.nextExecution = currentTime + this.delay;
      }
    },

    cancel()
    {
      this.nextExecution = -1;
    }
  };

  let requests = [];
  function XMLHttpRequest()
  {
    this._host = "http://example.com";
    this._loadHandlers = [];
    this._errorHandlers = [];
  }
  XMLHttpRequest.prototype = {
    _path: null,
    _data: null,
    _queryString: null,
    _loadHandlers: null,
    _errorHandlers: null,
    status: 0,
    readyState: 0,
    responseText: null,

    addEventListener(eventName, handler, capture)
    {
      let list;
      if (eventName == "load")
        list = this._loadHandlers;
      else if (eventName == "error")
        list = this._errorHandlers;
      else
        throw new Error("Event type " + eventName + " not supported");

      if (list.indexOf(handler) < 0)
        list.push(handler);
    },

    removeEventListener(eventName, handler, capture)
    {
      let list;
      if (eventName == "load")
        list = this._loadHandlers;
      else if (eventName == "error")
        list = this._errorHandlers;
      else
        throw new Error("Event type " + eventName + " not supported");

      let index = list.indexOf(handler);
      if (index >= 0)
        list.splice(index, 1);
    },

    open(method, url, async, user, password)
    {
      if (method != "GET")
        throw new Error("Only GET requests are supported");
      if (typeof async != "undefined" && !async)
        throw new Error("Sync requests are not supported");
      if (typeof user != "undefined" || typeof password != "undefined")
        throw new Error("User authentification is not supported");

      let match = /^data:[^,]+,/.exec(url);
      if (match)
      {
        this._data = decodeURIComponent(url.substring(match[0].length));
        return;
      }

      if (url.substring(0, this._host.length + 1) != this._host + "/")
        throw new Error("Unexpected URL: " + url + " (URL starting with " + this._host + "expected)");

      this._path = url.substring(this._host.length);

      let queryIndex = this._path.indexOf("?");
      this._queryString = "";
      if (queryIndex >= 0)
      {
        this._queryString = this._path.substring(queryIndex + 1);
        this._path = this._path.substring(0, queryIndex);
      }
    },

    send(data)
    {
      if (!this._data && !this._path)
        throw new Error("No request path set");
      if (typeof data != "undefined" && data)
        throw new Error("Sending data to server is not supported");

      requests.push(Promise.resolve().then(() =>
      {
        let result = [404, ""];
        if (this._data)
          result = [200, this._data];
        else if (this._path in XMLHttpRequest.requestHandlers)
        {
          result = XMLHttpRequest.requestHandlers[this._path]({
            method: "GET",
            path: this._path,
            queryString: this._queryString
          });
        }

        [this.status, this.responseText] = result;

        let eventName = (this.status > 0 ? "load" : "error");
        let event = {type: eventName};
        for (let handler of this["_" + eventName + "Handlers"])
          handler.call(this, event);
      }));
    },

    overrideMimeType(mime)
    {
    }
  };

  XMLHttpRequest.requestHandlers = {};
  this.registerHandler = (requestPath, handler) =>
  {
    XMLHttpRequest.requestHandlers[requestPath] = handler;
  };

  async function waitForRequests()
  {
    if (requests.length == 0)
      return;

    let result = Promise.all(requests);
    requests = [];

    try
    {
      await result;
    }
    catch (error)
    {
      console.error(error);
    }

    await waitForRequests();
  }

  async function runScheduledTasks(maxMillis)
  {
    let endTime = currentTime + maxMillis;

    if (fakeTimer.nextExecution < 0 || fakeTimer.nextExecution > endTime)
    {
      currentTime = endTime;
      return;
    }

    fakeTimer.trigger();

    await waitForRequests();
    await runScheduledTasks(endTime - currentTime);
  }

  this.runScheduledTasks = async(maxHours, initial = 0, skip = 0) =>
  {
    if (typeof maxHours != "number")
      throw new Error("Numerical parameter expected");

    startTime = currentTime;

    if (initial >= 0)
    {
      maxHours -= initial;
      await runScheduledTasks(initial * MILLIS_IN_HOUR);
    }

    if (skip >= 0)
    {
      maxHours -= skip;
      currentTime += skip * MILLIS_IN_HOUR;
    }

    await runScheduledTasks(maxHours * MILLIS_IN_HOUR);
  };

  this.getTimeOffset = () => (currentTime - startTime) / MILLIS_IN_HOUR;
  Object.defineProperty(this, "currentTime", {
    get: () => currentTime
  });

  return {
    Cc: {
      "@mozilla.org/timer;1": {
        createInstance: () => fakeTimer
      }
    },
    Ci: {
      nsITimer:
      {
        TYPE_ONE_SHOT: 0,
        TYPE_REPEATING_SLACK: 1,
        TYPE_REPEATING_PRECISE: 2
      }
    },
    XMLHttpRequest,
    Date: {
      now: () => currentTime
    }
  };
};

console.warn = console.log;

exports.setupRandomResult = function()
{
  let randomResult = 0.5;
  Object.defineProperty(this, "randomResult", {
    get: () => randomResult,
    set: value => randomResult = value
  });

  return {
    Math: Object.create(Math, {
      random: {
        value: () => randomResult
      }
    })
  };
};

exports.unexpectedError = function(error)
{
  console.error(error);
  this.ok(false, "Unexpected error: " + error);
};
