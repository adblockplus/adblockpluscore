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
