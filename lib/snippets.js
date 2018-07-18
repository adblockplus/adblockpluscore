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

/**
 * @fileOverview Snippets implementation.
 */

const {Filter} = require("./filterClasses");

const singleCharacterEscapes = new Map([
  ["n", "\n"], ["r", "\r"], ["t", "\t"]
]);

let filters = new Set();

/**
 * Container for snippet filters
 * @class
 */
let Snippets = {
  /**
   * Removes all known filters
   */
  clear()
  {
    filters.clear();
  },

  /**
   * Add a new snippet filter
   * @param {SnippetFilter} filter
   */
  add(filter)
  {
    filters.add(filter.text);
  },

  /**
   * Removes a snippet filter
   * @param {SnippetFilter} filter
   */
  remove(filter)
  {
    filters.delete(filter.text);
  },

  /**
   * Returns a list of all scripts active on a particular domain
   * @param {string} domain
   * @return {string[]}
   */
  getScriptsForDomain(domain)
  {
    let result = [];
    for (let text of filters)
    {
      let filter = Filter.fromText(text);
      if (filter.isActiveOnDomain(domain))
        result.push(filter.script);
    }
    return result;
  }
};

exports.Snippets = Snippets;

/**
 * Parses a script and returns a list of all its commands and their arguments
 * @param {string} script
 * @return {Array.<string[]>}
 */
function parseScript(script)
{
  let tree = [];

  let escape = false;
  let withinQuotes = false;

  let unicodeEscape = null;

  let call = [];
  let argument = "";

  for (let character of script.trim() + ";")
  {
    if (unicodeEscape != null)
    {
      unicodeEscape += character;

      if (unicodeEscape.length == 4)
      {
        let codePoint = parseInt(unicodeEscape, 16);
        if (!isNaN(codePoint))
          argument += String.fromCodePoint(codePoint);

        unicodeEscape = null;
      }
    }
    else if (escape)
    {
      escape = false;

      if (character == "u")
        unicodeEscape = "";
      else
        argument += singleCharacterEscapes.get(character) || character;
    }
    else if (character == "\\")
    {
      escape = true;
    }
    else if (character == "'")
    {
      withinQuotes = !withinQuotes;
    }
    else if (withinQuotes || character != ";" && !/\s/u.test(character))
    {
      argument += character;
    }
    else
    {
      if (argument)
      {
        call.push(argument);
        argument = "";
      }

      if (character == ";" && call.length > 0)
      {
        tree.push(call);
        call = [];
      }
    }
  }

  return tree;
}

exports.parseScript = parseScript;

/**
 * Compiles a script against a given list of libraries into executable code
 * @param {string} script
 * @param {string[]} libraries
 * @return {string}
 */
function compileScript(script, libraries)
{
  return `
    "use strict";
    {
      const libraries = ${JSON.stringify(libraries)};

      const script = ${JSON.stringify(parseScript(script))};

      let imports = Object.create(null);
      for (let library of libraries)
        new Function("exports", library)(imports);

      for (let [name, ...args] of script)
      {
        if (Object.prototype.hasOwnProperty.call(imports, name))
        {
          let value = imports[name];
          if (typeof value == "function")
            value(...args);
        }
      }
    }
  `;
}

exports.compileScript = compileScript;
