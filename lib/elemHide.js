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

const {ElemHideException} = require("filterClasses");
const {FilterNotifier} = require("filterNotifier");

/**
 * Lookup table, filters by their associated key
 * @type {Object}
 */
let filterByKey = [];

/**
 * Lookup table, keys of the filters by filter text
 * @type {Object}
 */
let keyByFilter = Object.create(null);

/**
 * Nested lookup table, filter (or false if inactive) by filter key by domain.
 * (Only contains filters that aren't unconditionally matched for all domains.)
 * @type {Object}
 */
let filtersByDomain = Object.create(null);

/**
 * Lookup table, filter key by selector. (Only used for selectors that are
 * unconditionally matched for all domains.)
 */
let filterKeyBySelector = Object.create(null);

/**
 * This array caches the keys of filterKeyBySelector table (selectors which
 * unconditionally apply on all domains). It will be null if the cache needs to
 * be rebuilt.
 */
let unconditionalSelectors = null;

/**
 * This array caches the values of filterKeyBySelector table (filterIds for
 * selectors which unconditionally apply on all domains). It will be null if the
 * cache needs to be rebuilt.
 */
let unconditionalFilterKeys = null;

/**
 * Object to be used instead when a filter has a blank domains property.
 */
let defaultDomains = new Map([["", true]]);

/**
 * Lookup table, keys are known element hiding exceptions
 * @type {Object}
 */
let knownExceptions = Object.create(null);

/**
 * Lookup table, lists of element hiding exceptions by selector
 * @type {Object}
 */
let exceptions = Object.create(null);

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
    filterByKey = [];
    keyByFilter = Object.create(null);
    filtersByDomain = Object.create(null);
    filterKeyBySelector = Object.create(null);
    unconditionalSelectors = unconditionalFilterKeys = null;
    knownExceptions = Object.create(null);
    exceptions = Object.create(null);
    FilterNotifier.emit("elemhideupdate");
  },

  _addToFiltersByDomain(key, filter)
  {
    let domains = filter.domains || defaultDomains;
    for (let [domain, isIncluded] of domains)
    {
      let filters = filtersByDomain[domain];
      if (!filters)
        filters = filtersByDomain[domain] = Object.create(null);

      if (isIncluded)
        filters[key] = filter;
      else
        filters[key] = false;
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
      if (filter.text in knownExceptions)
        return;

      let {selector} = filter;
      if (!(selector in exceptions))
        exceptions[selector] = [];
      exceptions[selector].push(filter);

      // If this is the first exception for a previously unconditionally
      // applied element hiding selector we need to take care to update the
      // lookups.
      let filterKey = filterKeyBySelector[selector];
      if (typeof filterKey != "undefined")
      {
        this._addToFiltersByDomain(filterKey, filterByKey[filterKey]);
        delete filterKeyBySelector[selector];
        unconditionalSelectors = unconditionalFilterKeys = null;
      }

      knownExceptions[filter.text] = true;
    }
    else
    {
      if (filter.text in keyByFilter)
        return;

      let key = filterByKey.push(filter) - 1;
      keyByFilter[filter.text] = key;

      if (!(filter.domains || filter.selector in exceptions))
      {
        // The new filter's selector is unconditionally applied to all domains
        filterKeyBySelector[filter.selector] = key;
        unconditionalSelectors = unconditionalFilterKeys = null;
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
    if (filterKeyBySelector[filter.selector] == key)
    {
      delete filterKeyBySelector[filter.selector];
      unconditionalSelectors = unconditionalFilterKeys = null;
      return;
    }

    // We haven't found this filter in unconditional filters, look in
    // filtersByDomain.
    let domains = filter.domains || defaultDomains;
    for (let domain of domains.keys())
    {
      let filters = filtersByDomain[domain];
      if (filters)
        delete filters[key];
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
      if (!(filter.text in knownExceptions))
        return;

      let list = exceptions[filter.selector];
      let index = list.indexOf(filter);
      if (index >= 0)
        list.splice(index, 1);
      delete knownExceptions[filter.text];
    }
    else
    {
      if (!(filter.text in keyByFilter))
        return;

      let key = keyByFilter[filter.text];
      delete filterByKey[key];
      delete keyByFilter[filter.text];
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
    if (!(filter.selector in exceptions))
      return null;

    let list = exceptions[filter.selector];
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
   * Returns a list of all selectors as a nested map. On first level, the keys
   * are all values of `ElemHideBase.selectorDomain` (domains on which these
   * selectors should apply, ignoring exceptions). The values are maps again,
   * with the keys being selectors and values the corresponding filter keys.
   * @returns {Map.<String,Map<String,String>>}
   */
  getSelectors()
  {
    let domains = new Map();
    for (let key in filterByKey)
    {
      let filter = filterByKey[key];
      if (!filter.selector)
        continue;

      let domain = filter.selectorDomain || "";

      if (!domains.has(domain))
        domains.set(domain, new Map());
      domains.get(domain).set(filter.selector, key);
    }

    return domains;
  },

  /**
   * Returns a list of selectors that apply on each website unconditionally.
   * @returns {string[]}
   */
  getUnconditionalSelectors()
  {
    if (!unconditionalSelectors)
      unconditionalSelectors = Object.keys(filterKeyBySelector);
    return unconditionalSelectors.slice();
  },

  /**
   * Returns a list of filter keys for selectors which apply to all websites
   * without exception.
   * @returns {number[]}
   */
  getUnconditionalFilterKeys()
  {
    if (!unconditionalFilterKeys)
    {
      let selectors = this.getUnconditionalSelectors();
      unconditionalFilterKeys = [];
      for (let selector of selectors)
        unconditionalFilterKeys.push(filterKeyBySelector[selector]);
    }
    return unconditionalFilterKeys.slice();
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
   * on a particular host name. Optionally returns the corresponding filter
   * keys.
   * @param {string} domain
   * @param {number} [criteria]
   *   One of the following: ElemHide.ALL_MATCHING, ElemHide.NO_UNCONDITIONAL or
   *                         ElemHide.SPECIFIC_ONLY.
   * @param {boolean} [provideFilterKeys]
   *   If true, the function will return a list of corresponding filter keys in
   *   addition to selectors.
   * @returns {string[]|Array.<string[]>}
   *   List of selectors or an array with two elements (list of selectors and
   *   list of corresponding keys) if provideFilterKeys is true.
   */
  getSelectorsForDomain(domain, criteria, provideFilterKeys)
  {
    let filterKeys = [];
    let selectors = [];

    if (typeof criteria == "undefined")
      criteria = ElemHide.ALL_MATCHING;
    if (criteria < ElemHide.NO_UNCONDITIONAL)
    {
      selectors = this.getUnconditionalSelectors();
      if (provideFilterKeys)
        filterKeys = this.getUnconditionalFilterKeys();
    }

    let specificOnly = (criteria >= ElemHide.SPECIFIC_ONLY);
    let seenFilters = Object.create(null);
    let currentDomain = domain ? domain.toUpperCase() : "";
    while (true)
    {
      if (specificOnly && currentDomain == "")
        break;

      let filters = filtersByDomain[currentDomain];
      if (filters)
      {
        for (let filterKey in filters)
        {
          if (filterKey in seenFilters)
            continue;
          seenFilters[filterKey] = true;

          let filter = filters[filterKey];
          if (filter && !this.getException(filter, domain))
          {
            selectors.push(filter.selector);
            // It is faster to always push the key, even if not required.
            filterKeys.push(filterKey);
          }
        }
      }

      if (currentDomain == "")
        break;

      let nextDot = currentDomain.indexOf(".");
      currentDomain = nextDot == -1 ? "" : currentDomain.substr(nextDot + 1);
    }

    if (provideFilterKeys)
      return [selectors, filterKeys];
    return selectors;
  }
};
