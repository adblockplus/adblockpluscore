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

"use strict";

/**
 * @fileOverview Snippets implementation.
 */

const {EventEmitter} = require("./events");

let singleCharacterEscapes = new Map([
  ["n", "\n"], ["r", "\r"], ["t", "\t"]
]);

/**
 * `{@link module:snippets.snippets snippets}` implementation.
 */
class Snippets extends EventEmitter {
  /**
   * @hideconstructor
   */
  constructor() {
    super();

    /**
     * All known snippet filters.
     * @type {Set.<module:filterClasses.SnippetFilter>}
     * @private
     */
    this._filters = new Set();
  }

  /**
   * Removes all known snippet filters.
   */
  clear() {
    let {_filters} = this;

    if (_filters.size == 0)
      return;

    _filters.clear();

    this.emit("snippets.filtersCleared");
  }

  /**
   * Adds a new snippet filter.
   * @param {module:filterClasses.SnippetFilter} filter
   */
  add(filter) {
    let {_filters} = this;
    let {size} = _filters;

    _filters.add(filter);

    if (size != _filters.size)
      this.emit("snippets.filterAdded", filter);
  }

  /**
   * Removes an existing snippet filter.
   * @param {module:filterClasses.SnippetFilter} filter
   */
  remove(filter) {
    let {_filters} = this;
    let {size} = _filters;

    _filters.delete(filter);

    if (size != _filters.size)
      this.emit("snippets.filterRemoved", filter);
  }

  /**
   * Checks whether a snippet filter exists.
   * @param {module:filterClasses.SnippetFilter} filter
   * @returns {boolean}
   */
  has(filter) {
    return this._filters.has(filter);
  }

  /**
   * Returns a list of all snippet filters active on the given domain.
   * @param {string} domain The domain.
   * @returns {Array.<module:filterClasses.SnippetFilter>} A list of snippet
   *   filters.
   */
  getFilters(domain) {
    let result = [];

    for (let filter of this._filters) {
      if (filter.isActiveOnDomain(domain))
        result.push(filter);
    }

    return result;
  }

  /**
   * Returns a list of all snippet filters active on the given domain.
   * @param {string} domain The domain.
   * @returns {Array.<module:filterClasses.SnippetFilter>} A list of snippet
   *   filters.
   *
   * @deprecated Use <code>{@link module:snippets~Snippets#getFilters}</code>
   *   instead.
   * @see module:snippets~Snippets#getFilters
   */
  getFiltersForDomain(domain) {
    return this.getFilters(domain);
  }
}

/**
 * Container for snippet filters.
 * @type {module:snippets~Snippets}
 */
exports.snippets = new Snippets();

let parseScript =
/**
 * Parses a script and returns a list of all its commands and their arguments.
 * @param {string} script The script.
 * @returns {Array.<string[]>} A list of commands and their arguments.
 * @package
 */
exports.parseScript = function parseScript(script) {
  let tree = [];

  let escape = false;
  let withinQuotes = false;

  let unicodeEscape = null;

  let quotesClosed = false;

  let call = [];
  let argument = "";

  for (let character of script.trim() + ";") {
    let afterQuotesClosed = quotesClosed;
    quotesClosed = false;

    if (unicodeEscape != null) {
      unicodeEscape += character;

      if (unicodeEscape.length == 4) {
        let codePoint = parseInt(unicodeEscape, 16);
        if (!isNaN(codePoint))
          argument += String.fromCodePoint(codePoint);

        unicodeEscape = null;
      }
    }
    else if (escape) {
      escape = false;

      if (character == "u")
        unicodeEscape = "";
      else
        argument += singleCharacterEscapes.get(character) || character;
    }
    else if (character == "\\") {
      escape = true;
    }
    else if (character == "'") {
      withinQuotes = !withinQuotes;

      if (!withinQuotes)
        quotesClosed = true;
    }
    else if (withinQuotes || character != ";" && !/\s/.test(character)) {
      argument += character;
    }
    else {
      if (argument || afterQuotesClosed) {
        call.push(argument);
        argument = "";
      }

      if (character == ";" && call.length > 0) {
        tree.push(call);
        call = [];
      }
    }
  }

  return tree;
};

/**
 * Compiles a script against a given list of libraries, passed as JSON
 * serialized string, or a an array of strings, into executable code.
 * @param {string|Array.<string>} scripts One or more scripts to convert into
 *  executable code.
 * @param {string} isolatedSnippetsLibrary The stringified bundle to be executed
 * in the isolated content script context.
 * @param {string} injectedSnippetsLibrary The stringified bundle to be injected
 * and executed in the main context.
 * @param {string|Array.<string>} injectedSnippetsList An array containing the
 * available injectable snippets.
 * @param {object} [environment] An object containing environment variables.
 * @returns {string} Executable code.
 */
exports.compileScript = function compileScript(scripts,
                                               isolatedSnippetsLibrary,
                                               injectedSnippetsLibrary,
                                               injectedSnippetsList,
                                               environment = {}) {
  let isolatedLib = JSON.stringify(isolatedSnippetsLibrary);
  let injectedLib = JSON.stringify(injectedSnippetsLibrary);
  return `
    "use strict";
    (() => 
    {
      let scripts = ${JSON.stringify([].concat(scripts).map(parseScript))};

      let isolatedLib = ${isolatedLib};
      let imports = Object.create(null);
      let injectedSnippetsCount = 0;
      let loadLibrary = new Function("exports", "environment", isolatedLib);
      loadLibrary(imports, ${JSON.stringify(environment)});
      const isolatedSnippets = imports.snippets;

      let injectedLib = ${injectedLib};
      let injectedSnippetsList = ${JSON.stringify(injectedSnippetsList)};
      let executable = "(() => {";
      executable += 'let environment = ${JSON.stringify(environment)};';
      executable += injectedLib;

      let {hasOwnProperty} = Object.prototype;
      for (let script of scripts)
      {
        for (let [name, ...args] of script)
        {
          if (hasOwnProperty.call(isolatedSnippets, name))
          {
            let value = isolatedSnippets[name];
            if (typeof value == "function")
              value(...args);
          }
          if (injectedSnippetsList.includes(name))
          {
            executable += stringifyFunctionCall(name, ...args);
            injectedSnippetsCount++;
          }
        }
      }

      executable += "})();";

      if (injectedSnippetsCount > 0)
        injectSnippetsInMainContext(executable);

      function stringifyFunctionCall(func, ...params)
      {
        // Call JSON.stringify on the arguments to avoid any arbitrary code
        // execution.
        const f = "snippets['" + func + "']";
        const parameters = params.map(JSON.stringify).join(",");
        return f + "(" + parameters + ");";
      }

      function injectSnippetsInMainContext(exec)
      {
        // injecting phase
        let script = document.createElement("script");
        script.type = "application/javascript";
        script.async = false;

        // Firefox 58 only bypasses site CSPs when assigning to 'src',
        // while Chrome 67 and Microsoft Edge (tested on 44.17763.1.0)
        // only bypass site CSPs when using 'textContent'.
        if (typeof netscape != "undefined" && typeof browser != "undefined")
        {
          let url = URL.createObjectURL(new Blob([executable]));
          script.src = url;
          document.documentElement.appendChild(script);
          URL.revokeObjectURL(url);
        }
        else
        {
          script.textContent = executable;
          document.documentElement.appendChild(script);
        }

        document.documentElement.removeChild(script);
      }
    })();
  `;
};
