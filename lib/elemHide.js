/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-2016 Eyeo GmbH
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

/**
 * @fileOverview Element hiding implementation.
 */

let {Utils} = require("utils");
let {ElemHideException} = require("filterClasses");
let {FilterNotifier} = require("filterNotifier");

/**
 * Lookup table, filters by their associated key
 * @type Object
 */
var filterByKey = [];

/**
 * Lookup table, keys of the filters by filter text
 * @type Object
 */
var keyByFilter = Object.create(null);

/**
 * Nested lookup table, filter (or false if inactive) by filter key by domain.
 * (Only contains filters that aren't unconditionally matched for all domains.)
 * @type Object
 */
var filtersByDomain = Object.create(null);

/**
 * Lookup table, filter keys by selector. (Only contains filters that have a
 * selector that is unconditionally matched for all domains.)
 */
var filterKeysBySelector = Object.create(null);

/**
 * This array caches the keys of filterKeysBySelector table (selectors which
 * unconditionally apply on all domains). It will be null if the cache needs to
 * be rebuilt.
 */
var unconditionalSelectors = null;

/**
 * This array caches the values of filterKeysBySelector table (filterIds for
 * selectors which unconditionally apply on all domains). It will be null if the
 * cache needs to be rebuilt. Note: Only the first filter key for each selector
 * is cached.
 */
var unconditionalFilterKeys = null;

/**
 * Object to be used instead when a filter has a blank domains property.
 */
var defaultDomains = Object.create(null);
defaultDomains[""] = true;

/**
 * Lookup table, keys are known element hiding exceptions
 * @type Object
 */
var knownExceptions = Object.create(null);

/**
 * Lookup table, lists of element hiding exceptions by selector
 * @type Object
 */
var exceptions = Object.create(null);

/**
 * Container for element hiding filters
 * @class
 */
var ElemHide = exports.ElemHide =
{
  /**
   * Removes all known filters
   */
  clear: function()
  {
    filterByKey = [];
    keyByFilter = Object.create(null);
    filtersByDomain = Object.create(null);
    filterKeysBySelector = Object.create(null);
    unconditionalSelectors = unconditionalFilterKeys = null;
    knownExceptions = Object.create(null);
    exceptions = Object.create(null);
    FilterNotifier.emit("elemhideupdate");
  },

  _addToFiltersByDomain: function(key, filter)
  {
    let domains = filter.domains || defaultDomains;
    for (let domain in domains)
    {
      let filters = filtersByDomain[domain];
      if (!filters)
        filters = filtersByDomain[domain] = Object.create(null);

      if (domains[domain])
        filters[key] = filter;
      else
        filters[key] = false;
    }
  },

  /**
   * Add a new element hiding filter
   * @param {ElemHideFilter} filter
   */
  add: function(filter)
  {
    if (filter instanceof ElemHideException)
    {
      if (filter.text in knownExceptions)
        return;

      let selector = filter.selector;
      if (!(selector in exceptions))
        exceptions[selector] = [];
      exceptions[selector].push(filter);

      // If this is the first exception for a previously unconditionally
      // applied element hiding selector we need to take care to update the
      // lookups.
      let filterKeys = filterKeysBySelector[selector];
      if (filterKeys)
      {
        for (let filterKey of filterKeys)
          this._addToFiltersByDomain(filterKey, filterByKey[filterKey]);
        delete filterKeysBySelector[selector];
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
        let filterKeys = filterKeysBySelector[filter.selector];
        if (filterKeys)
        {
          filterKeys.push(key);
        }
        else
        {
          filterKeysBySelector[filter.selector] = [key];
          unconditionalSelectors = unconditionalFilterKeys = null;
        }
      }
      else
      {
        // The new filter's selector only applies to some domains
        this._addToFiltersByDomain(key, filter);
      }
    }

    FilterNotifier.emit("elemhideupdate");
  },

  _removeFilterKey: function(key, filter)
  {
    let filterKeys = filterKeysBySelector[filter.selector];
    if (filterKeys)
    {
      let index = filterKeys.indexOf(key);
      if (index >= 0)
      {
        if (filterKeys.length > 1)
        {
          filterKeys.splice(index, 1);
          if (index == 0)
            unconditionalFilterKeys = null;
        }
        else
        {
          delete filterKeysBySelector[filter.selector];
          unconditionalSelectors = unconditionalFilterKeys = null;
        }
        return;
      }
    }

    // We haven't found this filter in unconditional filters, look in
    // filtersByDomain.
    let domains = filter.domains || defaultDomains;
    for (let domain in domains)
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
  remove: function(filter)
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
   */
  getException: function(/**Filter*/ filter, /**String*/ docDomain) /**ElemHideException*/
  {
    if (!(filter.selector in exceptions))
      return null;

    let list = exceptions[filter.selector];
    for (let i = list.length - 1; i >= 0; i--)
      if (list[i].isActiveOnDomain(docDomain))
        return list[i];

    return null;
  },

  /**
   * Retrieves an element hiding filter by the corresponding protocol key
   */
  getFilterByKey: function(/**Number*/ key) /**Filter*/
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
  getSelectors: function()
  {
    let domains = new Map();
    for (let key in filterByKey)
    {
      let filter = filterByKey[key];
      let selector = filter.selector;
      if (!selector)
        continue;

      let domain = filter.selectorDomain || "";

      if (!domains.has(domain))
        domains.set(domain, new Map());
      domains.get(domain).set(selector, key);
    }

    return domains;
  },

  /**
   * Returns a list of selectors that apply on each website unconditionally.
   * @returns {String[]}
   */
  getUnconditionalSelectors: function()
  {
    if (!unconditionalSelectors)
      unconditionalSelectors = Object.keys(filterKeysBySelector);
    return unconditionalSelectors.slice();
  },

  /**
   * Returns a list of all selectors active on a particular domain.
   * Returns a list of filterKeys for selectors that apply on each website
   * unconditionally.
   * @returns {Number[]}
   */
  getUnconditionalFilterKeys: function()
  {
    if (!unconditionalFilterKeys)
    {
      let selectors = this.getUnconditionalSelectors();
      unconditionalFilterKeys = [];
      for (let selector of selectors)
        unconditionalFilterKeys.push(filterKeysBySelector[selector][0]);
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
   * @param {String} domain
   * @param {Number} [criteria]
   *   One of the following: ElemHide.ALL_MATCHING, ElemHide.NO_UNCONDITIONAL or
   *                         ElemHide.SPECIFIC_ONLY.
   * @param {Boolean} [provideFilterKeys]
   *   If true, the function will return a list of corresponding filter keys in
   *   addition to selectors.
   * @returns {string[]|Array.<string[]>}
   *   List of selectors or an array with two elements (list of selectors and
   *   list of corresponding keys) if provideFilterKeys is true.
   */
  getSelectorsForDomain: function(domain, criteria, provideFilterKeys)
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
    else
      return selectors;
  }
};
