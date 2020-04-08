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

const {defaultMatcher} = require("./matcher");
const {elemHide} = require("./elemHide");
const {elemHideEmulation} = require("./elemHideEmulation");
const {elemHideExceptions} = require("./elemHideExceptions");
const {snippets} = require("./snippets");
const {filterListener} = require("./filterListener");

/**
 * Selects the appropriate module for the given filter type.
 *
 * @param {string} type The type of a filter. This must be one of
 *   `"blocking"`, `"whitelist"`, `"elemhide"`, `"elemhideemulation"`,
 *   `"elemhideexception"`, and `"snippet"`; otherwise the function returns
 *   `null`.
 *
 * @returns {?object} The appropriate module for the given filter type.
 */
function selectModule(type)
{
  switch (type)
  {
    case "blocking":
    case "whitelist":
      return defaultMatcher;
    case "elemhide":
      return elemHide;
    case "elemhideemulation":
      return elemHideEmulation;
    case "elemhideexception":
      return elemHideExceptions;
    case "snippet":
      return snippets;
  }

  return null;
}

/**
 * `{@link module:filterEngine.filterEngine filterEngine}` implementation.
 */
class FilterEngine
{
  /**
   * Creates the `{@link module:filterEngine.filterEngine filterEngine}`
   * object.
   * @private
   */
  constructor()
  {
    /**
     * The promise returned by
     * `{@link module:filterEngine~FilterEngine#initialize}`.
     * @type {?Promise}
     * @private
     */
    this._initializationPromise = null;
  }

  /**
   * Initializes the `{@link module:filterEngine.filterEngine filterEngine}`
   * object with filters loaded from disk.
   * @returns {Promise} A promise that is fulfilled when the initialization is
   *   complete.
   */
  initialize()
  {
    if (!this._initializationPromise)
      this._initializationPromise = filterListener.initialize(this);

    return this._initializationPromise;
  }

  /**
   * Adds a new filter.
   * @param {module:filterClasses.ActiveFilter} filter
   */
  add(filter)
  {
    let module = selectModule(filter.type);
    if (module)
      module.add(filter);
  }

  /**
   * Removes an existing filter.
   * @param {module:filterClasses.ActiveFilter} filter
   */
  remove(filter)
  {
    let module = selectModule(filter.type);
    if (module)
      module.remove(filter);
  }

  /**
   * Checks whether a filter exists.
   * @param {module:filterClasses.ActiveFilter} filter
   * @returns {boolean}
   */
  has(filter)
  {
    let module = selectModule(filter.type);
    if (module)
      return module.has(filter);
    return false;
  }

  /**
   * Clears all filters.
   */
  clear()
  {
    defaultMatcher.clear();
    elemHide.clear();
    elemHideEmulation.clear();
    elemHideExceptions.clear();
    snippets.clear();
  }
}

/**
 * The `filterEngine` object maintains filters for request blocking, element
 * hiding, and snippets.
 * @type {module:filterEngine~FilterEngine}
 */
exports.filterEngine = new FilterEngine();
