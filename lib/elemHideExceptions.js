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
 * @fileOverview Element hiding exceptions implementation.
 */

const {EventEmitter} = require("./events");
const {filterNotifier} = require("./filterNotifier");

/**
 * `{@link module:elemHideExceptions.elemHideExceptions elemHideExceptions}`
 * implementation.
 */
class ElemHideExceptions extends EventEmitter
{
  /**
   * @hideconstructor
   */
  constructor()
  {
    super();

    /**
     * Lookup table, lists of element hiding exceptions by selector
     * @type {Map.<string, Array.<module:filterClasses.ElemHideException>>}
     * @private
     */
    this._exceptionsBySelector = new Map();

    /**
     * Set containing known element hiding exceptions
     * @type {Set.<module:filterClasses.ElemHideException>}
     * @private
     */
    this._exceptions = new Set();
  }

  /**
   * Removes all known element hiding exceptions.
   */
  clear()
  {
    this._exceptionsBySelector.clear();
    this._exceptions.clear();

    filterNotifier.emit("elemhideupdate");
  }

  /**
   * Adds a new element hiding exception.
   * @param {module:filterClasses.ElemHideException} exception
   */
  add(exception)
  {
    if (this._exceptions.has(exception))
      return;

    let {selector} = exception;
    let list = this._exceptionsBySelector.get(selector);
    if (list)
      list.push(exception);
    else
      this._exceptionsBySelector.set(selector, [exception]);

    this._exceptions.add(exception);

    this.emit("added", exception);

    filterNotifier.emit("elemhideupdate");
  }

  /**
   * Removes an existing element hiding exception.
   * @param {module:filterClasses.ElemHideException} exception
   */
  remove(exception)
  {
    if (!this._exceptions.has(exception))
      return;

    let list = this._exceptionsBySelector.get(exception.selector);
    let index = list.indexOf(exception);
    if (index >= 0)
      list.splice(index, 1);

    this._exceptions.delete(exception);

    this.emit("removed", exception);

    filterNotifier.emit("elemhideupdate");
  }

  /**
   * Checks whether an element hiding exception exists.
   * @param {module:filterClasses.ElemHideException} exception
   * @returns {boolean}
   */
  has(exception)
  {
    return this._exceptions.has(exception);
  }

  /**
   * Checks whether any exception rules are registered for a selector.
   * @param {string} selector
   * @returns {boolean}
   */
  hasExceptions(selector)
  {
    return this._exceptionsBySelector.has(selector);
  }

  /**
   * Checks whether an exception rule is registered for a selector on a
   * particular domain.
   * @param {string} selector
   * @param {?string} [domain]
   * @returns {?module:filterClasses.ElemHideException}
   */
  getException(selector, domain)
  {
    let exceptions = this._exceptionsBySelector.get(selector);
    if (exceptions)
    {
      for (let exception of exceptions)
      {
        if (exception.isActiveOnDomain(domain))
          return exception;
      }
    }

    return null;
  }
}

/**
 * Container for element hiding exceptions.
 * @type {module:elemHideExceptions~ElemHideExceptions}
 */
exports.elemHideExceptions = new ElemHideExceptions();
