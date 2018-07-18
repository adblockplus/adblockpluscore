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

/* eslint-env webextensions */
/* eslint no-console: "off" */

"use strict";

/**
 * Injects JavaScript code into the document using a temporary
 * <code>script</code> element.
 *
 * @param {string} code The code to inject.
 * @param {Array.<function|string>} [dependencies] A list of dependencies
 *   to inject along with the code. A dependency may be either a function or a
 *   string containing some executable code.
 */
function injectCode(code, dependencies = [])
{
  for (let dependency of dependencies)
    code += dependency;

  let script = document.createElement("script");

  script.type = "application/javascript";
  script.async = false;

  // Firefox 58 only bypasses site CSPs when assigning to 'src',
  // while Chrome 67 only bypasses site CSPs when using 'textContent'.
  if (browser.runtime.getURL("").startsWith("chrome-extension://"))
  {
    script.textContent = code;
    document.documentElement.appendChild(script);
  }
  else
  {
    let url = URL.createObjectURL(new Blob([code]));
    script.src = url;
    document.documentElement.appendChild(script);
    URL.revokeObjectURL(url);
  }

  document.documentElement.removeChild(script);
}

/**
 * Converts a function and an optional list of arguments into a string of code
 * containing a function call. The function is converted to its string
 * representation using the <code>Function.prototype.toString</code> method.
 * Each argument is stringified using <code>JSON.stringify</code>. The
 * generated code begins with the <code>"use strict"</code> directive.
 *
 * @param {function} func The function to convert.
 * @param {...*} [params] The arguments to convert.
 *
 * @returns {string} The generated code containing the function call.
 */
function stringifyFunctionCall(func, ...params)
{
  // Call JSON.stringify on the arguments to avoid any arbitrary code
  // execution.
  return `"use strict";(${func})(${params.map(JSON.stringify).join(",")});`;
}

/**
 * Wraps a function and its dependencies into an injector. The injector, when
 * called with zero or more arguments, generates code that calls the function,
 * with the given arguments, if any, and injects the code, along with any
 * dependencies, into the document using a temporary <code>script</code>
 * element.
 *
 * @param {function} injectable The function to wrap into an injector.
 * @param {...(function|string)} [dependencies] Any dependencies of the
 *   function. A dependency may be either a function or a string containing
 *   some executable code.
 *
 * @returns {function} The generated injector.
 */
function makeInjector(injectable, ...dependencies)
{
  return (...args) => injectCode(stringifyFunctionCall(injectable, ...args),
                                 dependencies);
}

/**
 * Logs its arguments to the console. This may be used for testing and
 * debugging.
 *
 * @param {...*} [args] The arguments to log.
 */
function log(...args)
{
  console.log(...args);
}

exports.log = log;

/**
 * Similar to {@link log}, but does the logging in the context of the document
 * rather than the content script. This may be used for testing and debugging,
 * especially to verify that the injection of snippets into the document is
 * working without any errors.
 *
 * @param {...*} [args] The arguments to log.
 */
function trace(...args)
{
  // We could simply use console.log here, but the goal is to demonstrate the
  // usage of snippet dependencies.
  log(...args);
}

exports.trace = makeInjector(trace, log);
