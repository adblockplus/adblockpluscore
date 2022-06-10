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

require("./polyfill");
const {parseURL} = require("./url");
const {Filter} = require("./filterClasses");
const {newDefaultMatcher} = require("./matcher");
const {ElemHide} = require("./elemHide");
const {ElemHideEmulation} = require("./elemHideEmulation");
const {ElemHideExceptions} = require("./elemHideExceptions");
const {Snippets} = require("./snippets");
const {profiler} = require("./profiler");

/**
 * Filter engine.
 */
class FilterEngine {
  /**
   * Creates a `{@link module:filterEngine.FilterEngine FilterEngine}`
   * object.
   */
  constructor() {
    this.p = profiler("FilterEngine");

    this.p.start();

    /** The `{@link module:elemHideExceptions.ElemHideExceptions}` for
     *    the engine.
     * @type {module:elemHideExceptions.ElemHideExceptions}
     */
    this.elemHideExceptions = new ElemHideExceptions();
    /** The `{@link module:elemHide.ElemHide}` for the engine.
     * @type {module:elemHide.ElemHide}
     */
    this.elemHide = new ElemHide(this.elemHideExceptions);
    /** The `{@link module:elemHideEmulation.ElemHideEmulation}` for
     *    the engine.
     * @type {module:elemHideEmulation.ElemHideEmulation}
     */
    this.elemHideEmulation = new ElemHideEmulation(this.elemHideExceptions);
    /** The `{@link module:snippets.Snippets}` for the engine.
     * @type {module:snippets.Snippets}
     */
    this.snippets = new Snippets();
    /** The `{@link module:matcher.CombinedMatcher}` to use with the engine.
     * @type {module:matcher.CombinedMatcher}
     */
    this.defaultMatcher = newDefaultMatcher();

    /** The `{@link module:filterListener.FilterListener}` to use.
     * @type {?module:filterListener.FilterListener}
     */
    this._filterListener = null;
    /** The `{@link module:filterStorage.FilterStorage}` to use.
     * @type {?module:filterStorage.FilterStorage}
     */
    this._filterStorage = null;

    /**
     * The promise returned by
     * `{@link module:filterEngine.FilterEngine#initialize}`.
     * @type {?Promise}
     * @private
     */
    this._initializationPromise = null;
  }

  /**
   * Initializes a `{@link module:filterEngine.FilterEngine FilterEngine}`
   * object with the given filters or filters loaded from disk.
   *
   * @param {Iterable.<string>} [filterSource] An iterable object that yields
   *   the text of the filters with which to initialize the
   *   `{@link module:filterEngine.FilterEngine FilterEngine}` object. If
   *   omitted, filters are loaded from disk.
   *
   * @returns {Promise} A promise that is fulfilled when the initialization is
   *   complete.
   *
   * @public
   */
  initialize(filterSource) {
    this.p.mark("initialize");
    if (!this._initializationPromise) {
      if (typeof filterSource == "undefined") {
        // Note: filterListener.js and filterStorage.js must be loaded
        // conditionally here in local scope in order for the engine
        // to be able to work in standalone mode with no disk and
        // network I/O.
        const {FilterStorage} = require("./filterStorage");
        const {FilterListener} = require("./filterListener");
        this._filterStorage = new FilterStorage();
        this._filterListener = new FilterListener();
        this._initializationPromise = this._filterListener.initialize(
          this, this._filterStorage
        );
      }
      else {
        this._initializationPromise = Promise.resolve().then(() => {
          for (let text of filterSource) {
            text = Filter.normalize(text, true);
            if (text) {
              let filter = Filter.fromText(text);
              if (filter.type !== "invalid")
                this.add(filter);
            }
          }
        }).finally(() => {
          this.p.mark("download_done");
        });
      }
    }

    return this._initializationPromise;
  }

  get filterStorage() {
    return this._filterStorage;
  }

  /**
   * Selects the appropriate module for the given filter type.
   *
   * @param {string} type The type of a filter. This must be one of
   *   `"blocking"`, `"allowing"`, `"elemhide"`, `"elemhideemulation"`,
   *   `"elemhideexception"`, and `"snippet"`; otherwise the function returns
   *   `null`.
   *
   * @returns {?object} The appropriate module for the given filter type.
   */
  selectModule(type) {
    switch (type) {
      case "blocking":
      case "allowing":
        return this.defaultMatcher;
      case "elemhide":
        return this.elemHide;
      case "elemhideemulation":
        return this.elemHideEmulation;
      case "elemhideexception":
        return this.elemHideExceptions;
      case "snippet":
        return this.snippets;
    }

    return null;
  }

  /**
   * Adds a new filter.
   * @param {module:filterClasses.ActiveFilter} filter
   * @package
   */
  add(filter) {
    let module = this.selectModule(filter.type);
    if (module)
      module.add(filter);
  }

  /**
   * Removes an existing filter.
   * @param {module:filterClasses.ActiveFilter} filter
   * @package
   */
  remove(filter) {
    let module = this.selectModule(filter.type);
    if (module)
      module.remove(filter);
  }

  /**
   * Checks whether a filter exists.
   * @param {module:filterClasses.ActiveFilter} filter
   * @returns {boolean}
   * @package
   */
  has(filter) {
    let module = this.selectModule(filter.type);
    if (module)
      return module.has(filter);
    return false;
  }

  /**
   * Clears all filters.
   * @package
   */
  clear() {
    this.defaultMatcher.clear();
    this.elemHide.clear();
    this.elemHideEmulation.clear();
    this.elemHideExceptions.clear();
    this.snippets.clear();
  }

  /**
   * Matches existing URL filters against a web resource
   * (HTML document, CSS style sheet, PNG image, etc.) and returns the matching
   * filter if there's a match.
   *
   * @param {string|URL|module:url~URLInfo} url The URL of the resource.
   * @param {number} typeMask The
   *   {@link module:contentTypes.contentTypes content types} associated with
   *   the resource.
   * @param {string} documentHostname The hostname of the document of the
   *   resource.
   * @param {?string} [sitekey] An optional public key associated with the
   *   document of the resource.
   * @param {boolean} [specificOnly] Whether to ignore any generic filters.
   *
   * @returns {?string} A URL filter if there's a match; otherwise `null`.
   *
   * @public
   */
  match(url, typeMask, documentHostname, sitekey = null, specificOnly = false) {
    if (typeof url == "string")
      url = parseURL(url);

    let filter = this.defaultMatcher.match(
      url, typeMask, documentHostname, sitekey, specificOnly
    );
    return filter ? filter.text : null;
  }
}

/**
 * The `FilterEngine` class maintains filters for request blocking, element
 * hiding, and snippets.
 *
 * @public
 *
 * @example
 *
 * let {contentTypes, FilterEngine} = require("adblockpluscore");
 *
 * let filterEnginer = new FilterEngine();
 * await filterEngine.initialize(
 *   [
 *     "/annoying-ad^$image",
 *     "||example.com/social-widget.html^"
 *   ]
 * );
 *
 * let resource = {
 *   url: "https://ad-server.example.net/annoying-ad.png",
 *   documentURL: "https://news.example.com/world.html"
 * };
 *
 * let filter = filterEngine.match(resource.url, contentTypes.IMAGE,
 *                                 new URL(resource.documentURL).hostname);
 * console.log(filter); // prints "/annoying-ad^$image"
 */
exports.FilterEngine = FilterEngine;
