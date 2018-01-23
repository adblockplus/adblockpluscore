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

const {Filter} = require("filterClasses");

let filters = Object.create(null);

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
    filters = Object.create(null);
  },

  /**
   * Add a new element hiding emulation filter
   * @param {ElemHideEmulationFilter} filter
   */
  add(filter)
  {
    filters[filter.text] = true;
  },

  /**
   * Removes an element hiding emulation filter
   * @param {ElemHideEmulationFilter} filter
   */
  remove(filter)
  {
    delete filters[filter.text];
  },

  /**
   * Returns a list of all rules active on a particular domain
   * @param {string} domain
   * @param {Object} elemHide the ElemHide instance
   * @return {ElemHideEmulationFilter[]}
   */
  getRulesForDomain(domain, elemHide)
  {
    let result = [];
    let keys = Object.getOwnPropertyNames(filters);
    for (let key of keys)
    {
      let filter = Filter.fromText(key);
      if (filter.isActiveOnDomain(domain) &&
          !elemHide.getException(filter, domain))
      {
        result.push(filter);
      }
    }
    return result;
  }
};
exports.ElemHideEmulation = ElemHideEmulation;
