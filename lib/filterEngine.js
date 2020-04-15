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

const {Filter} = require("./filterClasses");
const {defaultMatcher} = require("./matcher");
const {elemHide} = require("./elemHide");
const {elemHideEmulation} = require("./elemHideEmulation");
const {elemHideExceptions} = require("./elemHideExceptions");
const {snippets} = require("./snippets");

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
   * object with the given filters or filters loaded from disk.
   *
   * @param {Iterable.<string>} [filterSource] An iterable object that yields
   *   the text of the filters with which to initialize the
   *   `{@link module:filterEngine.filterEngine filterEngine}` object. If
   *   omitted, filters are loaded from disk.
   *
   * @returns {Promise} A promise that is fulfilled when the initialization is
   *   complete.
   */
  initialize(filterSource)
  {
    if (!this._initializationPromise)
    {
      if (typeof filterSource == "undefined")
      {
        // Note: filterListener.js must be loaded conditionally here in local
        // scope in order for the engine to be able to work in standalone mode
        // with no disk and network I/O.
        const {filterListener} = require("./filterListener");
        this._initializationPromise = filterListener.initialize(this);
      }
      else
      {
        this._initializationPromise = Promise.resolve().then(() =>
        {
          for (let text of filterSource)
            this.add(Filter.fromText(Filter.normalize(text)));
        });
      }
    }

    return this._initializationPromise;
  }

  /**
   * Adds a new filter.
   * @param {module:filterClasses.ActiveFilter} filter
   * @package
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
   * @package
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
   * @package
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
   * @package
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
 *
 * @type {module:filterEngine~FilterEngine}
 *
 * @example
 *
 * let {elemHide} = require("adblockpluscore/lib/elemHide.js");
 *
 * let filters = ["##.annoying-ad", "example.com##.social-widget"];
 * await filterEngine.initialize(filters);
 *
 * let {code} = elemHide.generateStyleSheetForDomain(location.hostname);
 *
 * let style = document.createElement("style");
 * style.textContent = code;
 * document.head.appendChild(style);
 */
exports.filterEngine = new FilterEngine();
