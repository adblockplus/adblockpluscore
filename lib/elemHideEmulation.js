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
 * @fileOverview Element hiding emulation implementation.
 */

const {ElemHideExceptions} = require("./elemHideExceptions");
const {Filter} = require("./filterClasses");

let filters = new Set();

/**
 * Container for element hiding emulation filters
 * @class
 */
let ElemHideEmulation = {
  /**
   * Removes all known filters
   */
  clear()
  {
    filters.clear();
  },

  /**
   * Add a new element hiding emulation filter
   * @param {ElemHideEmulationFilter} filter
   */
  add(filter)
  {
    filters.add(filter.text);
  },

  /**
   * Removes an element hiding emulation filter
   * @param {ElemHideEmulationFilter} filter
   */
  remove(filter)
  {
    filters.delete(filter.text);
  },

  /**
   * Returns a list of all rules active on a particular domain
   * @param {string} domain
   * @return {ElemHideEmulationFilter[]}
   */
  getRulesForDomain(domain)
  {
    let result = [];
    for (let text of filters.values())
    {
      let filter = Filter.fromText(text);
      if (filter.isActiveOnDomain(domain) &&
          !ElemHideExceptions.getException(filter.selector, domain))
      {
        result.push(filter);
      }
    }
    return result;
  }
};
exports.ElemHideEmulation = ElemHideEmulation;
