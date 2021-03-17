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
 * @fileOverview Element hiding emulation implementation.
 */

const {elemHideExceptions} = require("./elemHideExceptions");

/**
 * `{@link module:elemHideEmulation.elemHideEmulation elemHideEmulation}`
 * implementation.
 */
class ElemHideEmulation extends Set {
  /**
   * Removes an existing element hiding emulation filter.
   * @param {module:filterClasses.ElemHideEmulationFilter} filter
   *
   * @deprecated Use
   *   <code>ElemHideEmulation#delete</code>
   *   instead.
   */
  remove(filter) {
    this.delete(filter);
  }

  /**
   * Returns a list of all element hiding emulation filters active on the given
   * domain.
   * @param {string} domain The domain.
   * @returns {Array.<module:filterClasses.ElemHideEmulationFilter>} A list of
   *   element hiding emulation filters.
   */
  getFilters(domain) {
    let result = [];

    for (let filter of this) {
      if (filter.isActiveOnDomain(domain) &&
          !elemHideExceptions.getException(filter.selector, domain))
        result.push(filter);
    }

    return result;
  }

  /**
   * Returns a list of all element hiding emulation filters active on the given
   * domain.
   * @param {string} domain The domain.
   * @returns {Array.<module:filterClasses.ElemHideEmulationFilter>} A list of
   *   element hiding emulation filters.
   *
   * @deprecated Use
   *   <code>{@link
   *          module:elemHideEmulation~ElemHideEmulation#getFilters}</code>
   *   instead.
   * @see module:elemHideEmulation~ElemHideEmulation#getFilters
   */
  getRulesForDomain(domain) {
    return this.getFilters(domain);
  }
}

/**
 * Container for element hiding emulation filters.
 * @type {module:elemHideEmulation~ElemHideEmulation}
 */
exports.elemHideEmulation = new ElemHideEmulation();
