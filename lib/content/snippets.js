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

/** @module */

/* global environment */
/* eslint-env webextensions */
/* eslint no-console: "off" */

"use strict";

/**
 * @type {Array.<string>}
 * @private
 */
let injectionCode = [];

/**
 * @type {Set.<function>}
 * @private
 */
let injectionDependencies = new Set();

/**
 * Prepare injection transaction by resetting code and dependencies.
 *
 * @private
 */
exports.prepareInjection = () =>
{
  injectionCode.splice(0);
  injectionDependencies.clear();
};

/**
 * Commit JavaScript code injection into the document using a temporary
 * `script` element.
 *
 * @private
 */
exports.commitInjection = () =>
{
  if (injectionCode.length < 1)
    return;

  // retrieve code and dependencies while cleaning up all related data
  let code = injectionCode.splice(0);
  let dependencies = [...injectionDependencies];
  injectionDependencies.clear();

  let executable = `
    (function()
    {
      "use strict";
      ${dependencies.join("\n")}
      ${code.join("\n")}
    })();
  `;

  let script = document.createElement("script");
  script.type = "application/javascript";
  script.async = false;
  script.textContent = executable;
  document.documentElement.appendChild(script);
  document.documentElement.removeChild(script);
};

/**
 * Converts a function and an optional list of arguments into a string of code
 * containing a function call.
 *
 * The function is converted to its string representation using the
 * `Function.prototype.toString` method. Each argument is stringified using
 * `JSON.stringify`.
 *
 * @param {function} func The function to convert.
 * @param {...*} [params] The arguments to convert.
 *
 * @returns {string} The generated code containing the function call.
 * @private
 */
function stringifyFunctionCall(func, ...params)
{
  // Call JSON.stringify on the arguments to avoid any arbitrary code
  // execution.
  return `${func.name}(${params.map(JSON.stringify).join(",")});`;
}

/**
 * Wraps a function into an injector.
 *
 * The injector, when called with zero or more arguments, generates code that
 * calls the function, with the given arguments, if any, and injects the code
 * into the document using a temporary `script`
 * element.
 *
 * @param {function} injectable The function to wrap into an injector.
 *
 * @returns {function} The generated injector.
 * @private
 */
function makeInjector(injectable)
{
  return (...args) =>
  {
    injectionDependencies.add(injectable);
    injectionCode.push(stringifyFunctionCall(injectable, ...args));
  };
}

/**
 * Sets a global property to `true`.
 *
 * @alias module:content/snippets.content-script-snippet
 *
 * @param {...*} prop The property to set to `true`.
 *
 * @since Adblock Plus 3.11.1
 */
function contentScriptSnippet(prop)
{
  window[prop] = true;
}

exports["content-script-snippet"] = contentScriptSnippet;

/**
 * Sets a global property to `true`.
 *
 * This snippet is used to test the injection mechanism.
 *
 * @alias module:content/snippets.injected-snippet
 *
 * @param {...*} prop The property to set to `true`.
 *
 * @since Adblock Plus 3.11.1
 */
function injectedSnippet(prop)
{
  window[prop] = true;
}

exports["injected-snippet"] = makeInjector(injectedSnippet);
