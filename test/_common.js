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

let fs = require("fs");
let path = require("path");
let SandboxedModule = require("sandboxed-module");

let globals = {
  atob: data => new Buffer(data, "base64").toString("binary"),
  btoa: data => new Buffer(data, "binary").toString("base64"),
  Ci: {
  },
  Cu: {
    import: () => {},
    reportError: e => undefined
  },
  console: {
    log: () => undefined,
    error: () => undefined,
  },
  navigator: {
  },
  onShutdown: {
    add: () =>
    {
    }
  },
  Services: {
    obs: {
      addObserver: () =>
      {
      }
    }
  },
  XPCOMUtils: {
    generateQI: () =>
    {
    }
  }
};

let knownModules = new Map();
for (let dir of [path.join(__dirname, "stub-modules"),
                 path.join(__dirname, "..", "lib")])
  for (let file of fs.readdirSync(path.resolve(dir)))
    if (path.extname(file) == ".js")
      knownModules[path.basename(file, ".js")] = path.resolve(dir, file);

function addExports(exports)
{
  return function(source)
  {
    let extraExports = exports[path.basename(this.filename, ".js")];
    if (extraExports)
      for (let name of extraExports)
        source += `
          Object.defineProperty(exports, "${name}", {get: () => ${name}});`;
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
    if (request in knownModules)
      return prefix + escapeString(knownModules[request]);
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
    sourceTransformers: sourceTransformers
  }).require;
};

exports.require = require;
