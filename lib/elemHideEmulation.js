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

/**
 * {@link elemHideEmulation} implementation.
 */
class ElemHideEmulation
{
  /**
   * @hideconstructor
   */
  constructor()
  {
    /**
     * All known element hiding emulation filters.
     * @type {Set.<ElemHideEmulationFilter>}
     * @private
     */
    this._filters = new Set();
  }

  /**
   * Removes all known element hiding emulation filters.
   */
  clear()
  {
    this._filters.clear();
  }

  /**
   * Adds a new element hiding emulation filter.
   * @param {ElemHideEmulationFilter} filter
   */
  add(filter)
  {
    this._filters.add(filter);
  }

  /**
   * Removes an existing element hiding emulation filter.
   * @param {ElemHideEmulationFilter} filter
   */
  remove(filter)
  {
    this._filters.delete(filter);
  }

  /**
   * Returns a list of all element hiding emulation rules active on the given
   * domain.
   * @param {string} domain
   * @returns {Array.<ElemHideEmulationFilter>}
   */
  getRulesForDomain(domain)
  {
    let result = [];

    for (let filter of this._filters)
    {
      if (filter.isActiveOnDomain(domain) &&
          !ElemHideExceptions.getException(filter.selector, domain))
      {
        result.push(filter);
      }
    }

    return result;
  }
}

/**
 * Container for element hiding emulation filters.
 * @type {ElemHideEmulation}
 */
let elemHideEmulation = new ElemHideEmulation();

exports.elemHideEmulation = elemHideEmulation;
