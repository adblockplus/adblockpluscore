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
 * @fileOverview Element hiding exceptions implementation.
 */

const {EventEmitter} = require("./events");
const {filterNotifier} = require("./filterNotifier");

/**
 * Lookup table, lists of element hiding exceptions by selector
 * @type {Map.<string,ElemHideException[]>}
 */
let exceptions = new Map();

/**
 * Set containing known element exceptions
 * @type {Set.<ElemHideException>}
 */
let knownExceptions = new Set();

/**
 * Container for element hiding exceptions
 * @class
 */
exports.ElemHideExceptions = Object.assign(Object.create(new EventEmitter()), {
  /**
   * Removes all known exceptions
   */
  clear()
  {
    exceptions.clear();
    knownExceptions.clear();

    filterNotifier.emit("elemhideupdate");
  },

  /**
   * Add a new element hiding exception
   * @param {ElemHideException} exception
   */
  add(exception)
  {
    if (knownExceptions.has(exception))
      return;

    let {selector} = exception;
    let list = exceptions.get(selector);
    if (list)
      list.push(exception);
    else
      exceptions.set(selector, [exception]);

    knownExceptions.add(exception);

    this.emit("added", exception);

    filterNotifier.emit("elemhideupdate");
  },

  /**
   * Removes an element hiding exception
   * @param {ElemHideException} exception
   */
  remove(exception)
  {
    if (!knownExceptions.has(exception))
      return;

    let list = exceptions.get(exception.selector);
    let index = list.indexOf(exception);
    if (index >= 0)
      list.splice(index, 1);

    knownExceptions.delete(exception);

    this.emit("removed", exception);

    filterNotifier.emit("elemhideupdate");
  },

  /**
   * Checks whether any exception rules are registered for a selector
   * @param {string} selector
   * @returns {boolean}
   */
  hasExceptions(selector)
  {
    return exceptions.has(selector);
  },

  /**
   * Checks whether an exception rule is registered for a selector on a
   * particular domain.
   * @param {string} selector
   * @param {?string} docDomain
   * @return {?ElemHideException}
   */
  getException(selector, docDomain)
  {
    let list = exceptions.get(selector);
    if (!list)
      return null;

    for (let i = list.length - 1; i >= 0; i--)
    {
      if (list[i].isActiveOnDomain(docDomain))
        return list[i];
    }

    return null;
  }
});
