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

const {ElemHideException} = require("./filterClasses");
const {FilterNotifier} = require("./filterNotifier");

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
 * Set containing known element hiding and exception filters
 * @type {Set.<ElemHideBase>}
 */
let knownFilters = new Set();

/**
 * Lookup table, lists of element hiding exceptions by selector
 * @type {Map.<string,Filter>}
 */
let exceptions = new Map();

/**
 * Container for element hiding filters
 * @class
 */
let ElemHide = exports.ElemHide = {
  /**
   * Removes all known filters
   */
  clear()
  {
    for (let collection of [filtersByDomain, filterBySelector,
                            knownFilters, exceptions])
    {
      collection.clear();
    }
    unconditionalSelectors = null;
    FilterNotifier.emit("elemhideupdate");
  },

  _addToFiltersByDomain(filter)
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
  },

  /**
   * Add a new element hiding filter
   * @param {ElemHideBase} filter
   */
  add(filter)
  {
    if (knownFilters.has(filter))
      return;

    if (filter instanceof ElemHideException)
    {
      let {selector} = filter;
      let list = exceptions.get(selector);
      if (list)
        list.push(filter);
      else
        exceptions.set(selector, [filter]);

      // If this is the first exception for a previously unconditionally
      // applied element hiding selector we need to take care to update the
      // lookups.
      let unconditionalFilterForSelector = filterBySelector.get(selector);
      if (unconditionalFilterForSelector)
      {
        this._addToFiltersByDomain(unconditionalFilterForSelector);
        filterBySelector.delete(selector);
        unconditionalSelectors = null;
      }
    }
    else if (!(filter.domains || exceptions.has(filter.selector)))
    {
      // The new filter's selector is unconditionally applied to all domains
      filterBySelector.set(filter.selector, filter);
      unconditionalSelectors = null;
    }
    else
    {
      // The new filter's selector only applies to some domains
      this._addToFiltersByDomain(filter);
    }

    knownFilters.add(filter);
    FilterNotifier.emit("elemhideupdate");
  },

  /**
   * Removes an element hiding filter
   * @param {ElemHideBase} filter
   */
  remove(filter)
  {
    if (!knownFilters.has(filter))
      return;

    // Whitelisting filters
    if (filter instanceof ElemHideException)
    {
      let list = exceptions.get(filter.selector);
      let index = list.indexOf(filter);
      if (index >= 0)
        list.splice(index, 1);
    }
    // Unconditially applied element hiding filters
    else if (filterBySelector.get(filter.selector) == filter)
    {
      filterBySelector.delete(filter.selector);
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
          filters.delete(filter);
      }
    }

    knownFilters.delete(filter);
    FilterNotifier.emit("elemhideupdate");
  },

  /**
   * Checks whether an exception rule is registered for a filter on a particular
   * domain.
   * @param {Filter} filter
   * @param {?string} docDomain
   * @return {?ElemHideException}
   */
  getException(filter, docDomain)
  {
    let list = exceptions.get(filter.selector);
    if (!list)
      return null;

    for (let i = list.length - 1; i >= 0; i--)
    {
      if (list[i].isActiveOnDomain(docDomain))
        return list[i];
    }

    return null;
  },

  /**
   * Returns a list of selectors that apply on each website unconditionally.
   * @returns {string[]}
   */
  getUnconditionalSelectors()
  {
    if (!unconditionalSelectors)
      unconditionalSelectors = [...filterBySelector.keys()];
    return unconditionalSelectors.slice();
  },

  /**
   * Constant used by getSelectorsForDomain to return all selectors applying to
   * a particular hostname.
   * @type {number}
   * @const
   */
  ALL_MATCHING: 0,

  /**
   * Constant used by getSelectorsForDomain to exclude selectors which apply to
   * all websites without exception.
   * @type {number}
   * @const
   */
  NO_UNCONDITIONAL: 1,

  /**
   * Constant used by getSelectorsForDomain to return only selectors for filters
   * which specifically match the given host name.
   * @type {number}
   * @const
   */
  SPECIFIC_ONLY: 2,

  /**
   * Determines from the current filter list which selectors should be applied
   * on a particular host name.
   * @param {string} domain
   * @param {number} [criteria]
   *   One of the following: ElemHide.ALL_MATCHING, ElemHide.NO_UNCONDITIONAL or
   *                         ElemHide.SPECIFIC_ONLY.
   * @returns {string[]}
   *   List of selectors.
   */
  getSelectorsForDomain(domain, criteria = ElemHide.ALL_MATCHING)
  {
    let selectors = [];

    if (criteria < ElemHide.NO_UNCONDITIONAL)
      selectors = this.getUnconditionalSelectors();

    let specificOnly = (criteria >= ElemHide.SPECIFIC_ONLY);
    let excluded = new Set();
    let currentDomain = domain ? domain.toUpperCase() : "";

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
          else if ((excluded.size == 0 || !excluded.has(filter)) &&
                   !this.getException(filter, domain))
          {
            selectors.push(filter.selector);
          }
        }
      }

      if (currentDomain == "")
        break;

      let nextDot = currentDomain.indexOf(".");
      currentDomain = nextDot == -1 ? "" : currentDomain.substr(nextDot + 1);
    }

    return selectors;
  }
};
