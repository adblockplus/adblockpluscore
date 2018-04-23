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
 * Lookup table, filters by their associated key
 * @type {Filter[]}
 */
let filterByKey = [];

/**
 * Lookup table, keys of the filters by filter
 * @type {Map.<Filter,number>}
 */
let keyByFilter = new Map();

/**
 * Nested lookup table, filter (or false if inactive) by filter key by domain.
 * (Only contains filters that aren't unconditionally matched for all domains.)
 * @type {Map.<string,Map.<number,(Filter|boolean)>>}
 */
let filtersByDomain = new Map();

/**
 * Lookup table, filter key by selector. (Only used for selectors that are
 * unconditionally matched for all domains.)
 * @type {Map.<string,number>}
 */
let filterKeyBySelector = new Map();

/**
 * This array caches the keys of filterKeyBySelector table (selectors which
 * unconditionally apply on all domains). It will be null if the cache needs to
 * be rebuilt.
 */
let unconditionalSelectors = null;

/**
 * Object to be used instead when a filter has a blank domains property.
 */
let defaultDomains = new Map([["", true]]);

/**
 * Set containing known element hiding exceptions
 * @type {Set.<string>}
 */
let knownExceptions = new Set();

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
    for (let collection of [keyByFilter, filtersByDomain, filterKeyBySelector,
                            knownExceptions, exceptions])
    {
      collection.clear();
    }
    filterByKey = [];
    unconditionalSelectors = null;
    FilterNotifier.emit("elemhideupdate");
  },

  _addToFiltersByDomain(key, filter)
  {
    let domains = filter.domains || defaultDomains;
    for (let [domain, isIncluded] of domains)
    {
      let filters = filtersByDomain.get(domain);
      if (!filters)
        filtersByDomain.set(domain, filters = new Map());
      filters.set(key, isIncluded ? filter : false);
    }
  },

  /**
   * Add a new element hiding filter
   * @param {ElemHideFilter} filter
   */
  add(filter)
  {
    if (filter instanceof ElemHideException)
    {
      if (knownExceptions.has(filter.text))
        return;

      let {selector} = filter;
      let list = exceptions.get(selector);
      if (list)
        list.push(filter);
      else
        exceptions.set(selector, [filter]);

      // If this is the first exception for a previously unconditionally
      // applied element hiding selector we need to take care to update the
      // lookups.
      let filterKey = filterKeyBySelector.get(selector);
      if (typeof filterKey != "undefined")
      {
        this._addToFiltersByDomain(filterKey, filterByKey[filterKey]);
        filterKeyBySelector.delete(selector);
        unconditionalSelectors = null;
      }

      knownExceptions.add(filter.text);
    }
    else
    {
      if (keyByFilter.has(filter))
        return;

      let key = filterByKey.push(filter) - 1;
      keyByFilter.set(filter, key);

      if (!(filter.domains || exceptions.has(filter.selector)))
      {
        // The new filter's selector is unconditionally applied to all domains
        filterKeyBySelector.set(filter.selector, key);
        unconditionalSelectors = null;
      }
      else
      {
        // The new filter's selector only applies to some domains
        this._addToFiltersByDomain(key, filter);
      }
    }

    FilterNotifier.emit("elemhideupdate");
  },

  _removeFilterKey(key, filter)
  {
    if (filterKeyBySelector.get(filter.selector) == key)
    {
      filterKeyBySelector.delete(filter.selector);
      unconditionalSelectors = null;
      return;
    }

    // We haven't found this filter in unconditional filters, look in
    // filtersByDomain.
    let domains = filter.domains || defaultDomains;
    for (let domain of domains.keys())
    {
      let filters = filtersByDomain.get(domain);
      if (filters)
        filters.delete(key);
    }
  },

  /**
   * Removes an element hiding filter
   * @param {ElemHideFilter} filter
   */
  remove(filter)
  {
    if (filter instanceof ElemHideException)
    {
      if (!knownExceptions.has(filter.text))
        return;

      let list = exceptions.get(filter.selector);
      let index = list.indexOf(filter);
      if (index >= 0)
        list.splice(index, 1);
      knownExceptions.delete(filter.text);
    }
    else
    {
      let key = keyByFilter.get(filter);
      if (typeof key == "undefined")
        return;

      delete filterByKey[key];
      keyByFilter.delete(filter);
      this._removeFilterKey(key, filter);
    }

    FilterNotifier.emit("elemhideupdate");
  },

  /**
   * Checks whether an exception rule is registered for a filter on a particular
   * domain.
   * @param {Filter} filter
   * @param {string} docDomain
   * @return {ElemHideException}
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
   * Retrieves an element hiding filter by the corresponding protocol key
   * @param {number} key
   * @return {Filter}
   */
  getFilterByKey(key)
  {
    return (key in filterByKey ? filterByKey[key] : null);
  },

  /**
   * Returns a list of selectors that apply on each website unconditionally.
   * @returns {string[]}
   */
  getUnconditionalSelectors()
  {
    if (!unconditionalSelectors)
      unconditionalSelectors = [...filterKeyBySelector.keys()];
    return unconditionalSelectors.slice();
  },

  /**
   * Constant used by getSelectorsForDomain to return all selectors applying to
   * a particular hostname.
   */
  ALL_MATCHING: 0,

  /**
   * Constant used by getSelectorsForDomain to exclude selectors which apply to
   * all websites without exception.
   */
  NO_UNCONDITIONAL: 1,

  /**
   * Constant used by getSelectorsForDomain to return only selectors for filters
   * which specifically match the given host name.
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
  getSelectorsForDomain(domain, criteria)
  {
    let selectors = [];

    if (typeof criteria == "undefined")
      criteria = ElemHide.ALL_MATCHING;
    if (criteria < ElemHide.NO_UNCONDITIONAL)
      selectors = this.getUnconditionalSelectors();

    let specificOnly = (criteria >= ElemHide.SPECIFIC_ONLY);
    let seenFilters = new Set();
    let currentDomain = domain ? domain.toUpperCase() : "";
    while (true)
    {
      if (specificOnly && currentDomain == "")
        break;

      let filters = filtersByDomain.get(currentDomain);
      if (filters)
      {
        for (let [filterKey, filter] of filters)
        {
          if (seenFilters.has(filterKey))
            continue;
          seenFilters.add(filterKey);

          if (filter && !this.getException(filter, domain))
            selectors.push(filter.selector);
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
