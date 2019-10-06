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

const {defaultMatcher} = require("./matcher");
const {elemHide} = require("./elemHide");
const {elemHideEmulation} = require("./elemHideEmulation");
const {elemHideExceptions} = require("./elemHideExceptions");
const {snippets} = require("./snippets");

/**
 * Selects the appropriate module for the given filter type.
 *
 * @param {string} type The type of a filter. This must be one of
 *   <code>"blocking"</code>, <code>"whitelist"</code>,
 *   <code>"elemhide"</code>, <code>"elemhideemulation"</code>,
 *   <code>"elemhideexception"</code>, and <code>"snippet"</code>; otherwise
 *   the function returns <code>null</code>.
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
 * <code>{@link filterEngine}</code> implementation.
 */
class FilterEngine
{
  /**
   * Adds a new filter.
   * @param {ActiveFilter} filter
   */
  add(filter)
  {
    let module = selectModule(filter.type);
    if (module)
      module.add(filter);
  }

  /**
   * Removes an existing filter.
   * @param {ActiveFilter} filter
   */
  remove(filter)
  {
    let module = selectModule(filter.type);
    if (module)
      module.remove(filter);
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
 * The <code>filterEngine</code> object maintains filters for request blocking,
 * element hiding, and snippets.
 * @type {FilterEngine}
 */
let filterEngine = new FilterEngine();

exports.filterEngine = filterEngine;
