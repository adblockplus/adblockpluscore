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
 * @fileOverview Element hiding implementation.
 */

const {ElemHideExceptions} = require("./elemHideExceptions");
const {filterNotifier} = require("./filterNotifier");

/**
 * The maximum number of selectors in a CSS rule. This is used by
 * <code>{@link createStyleSheet}</code> to split up a long list of selectors
 * into multiple rules.
 * @const {number}
 * @default
 */
const selectorGroupSize = 1024;

/**
 * Lookup table, active flag, by filter by domain.
 * (Only contains filters that aren't unconditionally matched for all domains.)
 * @type {Map.<string,Map.<Filter,boolean>>}
 */
let filtersByDomain = new Map();

/**
 * Lookup table, filter by selector. (Only used for selectors that are
 * unconditionally matched for all domains.)
 * @type {Map.<string,Filter>}
 */
let filterBySelector = new Map();

/**
 * This array caches the keys of filterBySelector table (selectors
 * which unconditionally apply on all domains). It will be null if the
 * cache needs to be rebuilt.
 * @type {?string[]}
 */
let unconditionalSelectors = null;

/**
 * Map to be used instead when a filter has a blank domains property.
 * @type {Map.<string,boolean>}
 * @const
 */
let defaultDomains = new Map([["", true]]);

/**
 * Set containing known element hiding filters
 * @type {Set.<ElemHideFilter>}
 */
let knownFilters = new Set();

/**
 * Adds a filter to the lookup table of filters by domain.
 * @param {Filter} filter
 */
function addToFiltersByDomain(filter)
{
  let domains = filter.domains || defaultDomains;
  for (let [domain, isIncluded] of domains)
  {
    // There's no need to note that a filter is generically disabled.
    if (!isIncluded && domain == "")
      continue;

    let filters = filtersByDomain.get(domain);
    if (!filters)
      filtersByDomain.set(domain, filters = new Map());
    filters.set(filter, isIncluded);
  }
}

/**
 * Returns a list of selectors that apply on each website unconditionally.
 * @returns {string[]}
 */
function getUnconditionalSelectors()
{
  if (!unconditionalSelectors)
    unconditionalSelectors = [...filterBySelector.keys()];

  return unconditionalSelectors;
}

ElemHideExceptions.on("added", ({selector}) =>
{
  // If this is the first exception for a previously unconditionally applied
  // element hiding selector we need to take care to update the lookups.
  let unconditionalFilterForSelector = filterBySelector.get(selector);
  if (unconditionalFilterForSelector)
  {
    addToFiltersByDomain(unconditionalFilterForSelector);
    filterBySelector.delete(selector);
    unconditionalSelectors = null;
  }
});

/**
 * Container for element hiding filters
 * @class
 */
exports.ElemHide = {
  /**
   * Removes all known filters
   */
  clear()
  {
    for (let collection of [filtersByDomain, filterBySelector, knownFilters])
      collection.clear();

    unconditionalSelectors = null;
    filterNotifier.emit("elemhideupdate");
  },

  /**
   * Add a new element hiding filter
   * @param {ElemHideFilter} filter
   */
  add(filter)
  {
    if (knownFilters.has(filter))
      return;

    let {selector} = filter;

    if (!(filter.domains || ElemHideExceptions.hasExceptions(selector)))
    {
      // The new filter's selector is unconditionally applied to all domains
      filterBySelector.set(selector, filter);
      unconditionalSelectors = null;
    }
    else
    {
      // The new filter's selector only applies to some domains
      addToFiltersByDomain(filter);
    }

    knownFilters.add(filter);
    filterNotifier.emit("elemhideupdate");
  },

  /**
   * Removes an element hiding filter
   * @param {ElemHideFilter} filter
   */
  remove(filter)
  {
    if (!knownFilters.has(filter))
      return;

    let {selector} = filter;

    // Unconditially applied element hiding filters
    if (filterBySelector.get(selector) == filter)
    {
      filterBySelector.delete(selector);
      unconditionalSelectors = null;
    }
    // Conditionally applied element hiding filters
    else
    {
      let domains = filter.domains || defaultDomains;
      for (let domain of domains.keys())
      {
        let filters = filtersByDomain.get(domain);
        if (filters)
        {
          filters.delete(filter);

          if (filters.size == 0)
            filtersByDomain.delete(domain);
        }
      }
    }

    knownFilters.delete(filter);
    filterNotifier.emit("elemhideupdate");
  },

  /**
   * Determines from the current filter list which selectors should be applied
   * on a particular host name.
   * @param {string} domain
   * @param {boolean} [specificOnly] true if generic filters should not apply.
   * @returns {string[]} List of selectors.
   */
  getSelectorsForDomain(domain, specificOnly = false)
  {
    let selectors = [];

    let excluded = new Set();
    let currentDomain = domain ? domain.replace(/\.+$/, "").toLowerCase() : "";

    // This code is a performance hot-spot, which is why we've made certain
    // micro-optimisations. Please be careful before making changes.
    while (true)
    {
      if (specificOnly && currentDomain == "")
        break;

      let filters = filtersByDomain.get(currentDomain);
      if (filters)
      {
        for (let [filter, isIncluded] of filters)
        {
          if (!isIncluded)
          {
            excluded.add(filter);
          }
          else
          {
            let {selector} = filter;
            if ((excluded.size == 0 || !excluded.has(filter)) &&
                !ElemHideExceptions.getException(selector, domain))
            {
              selectors.push(selector);
            }
          }
        }
      }

      if (currentDomain == "")
        break;

      let nextDot = currentDomain.indexOf(".");
      currentDomain = nextDot == -1 ? "" : currentDomain.substr(nextDot + 1);
    }

    if (!specificOnly)
      selectors = getUnconditionalSelectors().concat(selectors);

    return selectors;
  }
};

/**
 * Splits a list of selectors into groups determined by the value of
 * <code>{@link selectorGroupSize}</code>.
 *
 * @param {Array.<string>} selectors
 * @yields {Array.<string>}
 */
function* splitSelectors(selectors)
{
  // Chromium's Blink engine supports only up to 8,192 simple selectors, and
  // even fewer compound selectors, in a rule. The exact number of selectors
  // that would work depends on their sizes (e.g. "#foo .bar" has a size of 2).
  // Since we don't know the sizes of the selectors here, we simply split them
  // into groups of 1,024, based on the reasonable assumption that the average
  // selector won't have a size greater than 8. The alternative would be to
  // calculate the sizes of the selectors and divide them up accordingly, but
  // this approach is more efficient and has worked well in practice. In theory
  // this could still lead to some selectors not working on Chromium, but it is
  // highly unlikely.
  // See issue #6298 and https://crbug.com/804179
  for (let i = 0; i < selectors.length; i += selectorGroupSize)
    yield selectors.slice(i, i + selectorGroupSize);
}

/**
 * Creates element hiding CSS rules for a given list of selectors. Each rule
 * contains no more than the maximum number of selectors as determined by the
 * value of <code>{@link selectorGroupSize}</code>.
 *
 * @param {Array.<string>} selectors
 * @yields {string}
 */
function* createRules(selectors)
{
  for (let selectorGroup of splitSelectors(selectors))
    yield selectorGroup.join(", ") + " {display: none !important;}";
}

/**
 * Creates an element hiding CSS style sheet from a given list of selectors.
 * @param {Array.<string>} selectors
 * @returns {string}
 */
function createStyleSheet(selectors)
{
  let styleSheet = "";

  for (let rule of createRules(selectors))
    styleSheet += rule + "\n";

  return styleSheet;
}

exports.createStyleSheet = createStyleSheet;
