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
 * Indicates whether we are using the getSelectorsForDomain function and
 * therefore mainting the required filtersByDomain, filtersBySelector and
 * unconditionalSelectors lookups. (Will be false for Firefox)
 * @type Boolean
 */
var usingGetSelectorsForDomain = !("nsIStyleSheetService" in Ci);

/**
 * Nested lookup table, filter (or false if inactive) by filter key by domain.
 * (Only contains filters that aren't unconditionally matched for all domains.)
 * @type Object
 */
var filtersByDomain = Object.create(null);

/**
 * Lookup table, filters by selector. (Only contains filters that have a
 * selector that is unconditionally matched for all domains.)
 */
var filtersBySelector = Object.create(null);

/**
 * This array caches the keys of filtersBySelector table (selectors which
 * unconditionally apply on all domains). It will be null if the cache needs to
 * be rebuilt.
 */
var unconditionalSelectors = null;

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
    filtersBySelector = Object.create(null);
    unconditionalSelectors = null;
    knownExceptions = Object.create(null);
    exceptions = Object.create(null);
    FilterNotifier.emit("elemhideupdate");
  },

  _addToFiltersByDomain: function(filter)
  {
    let key = keyByFilter[filter.text];
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

      if (usingGetSelectorsForDomain)
      {
        // If this is the first exception for a previously unconditionally
        // applied element hiding selector we need to take care to update the
        // lookups.
        let unconditionalFilters = filtersBySelector[selector];
        if (unconditionalFilters)
        {
          for (let f of unconditionalFilters)
            this._addToFiltersByDomain(f);
          delete filtersBySelector[selector];
          unconditionalSelectors = null;
        }
      }

      knownExceptions[filter.text] = true;
    }
    else
    {
      if (filter.text in keyByFilter)
        return;

      let key = filterByKey.push(filter) - 1;
      keyByFilter[filter.text] = key;

      if (usingGetSelectorsForDomain)
      {
        if (!(filter.domains || filter.selector in exceptions))
        {
          // The new filter's selector is unconditionally applied to all domains
          let filters = filtersBySelector[filter.selector];
          if (filters)
          {
            filters.push(filter);
          }
          else
          {
            filtersBySelector[filter.selector] = [filter];
            unconditionalSelectors = null;
          }
        }
        else
        {
          // The new filter's selector only applies to some domains
          this._addToFiltersByDomain(filter);
        }
      }
    }

    FilterNotifier.emit("elemhideupdate");
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

      if (usingGetSelectorsForDomain)
      {
        let filters = filtersBySelector[filter.selector];
        if (filters)
        {
          if (filters.length > 1)
          {
            let index = filters.indexOf(filter);
            filters.splice(index, 1);
          }
          else
          {
            delete filtersBySelector[filter.selector];
            unconditionalSelectors = null;
          }
        }
        else
        {
          let domains = filter.domains || defaultDomains;
          for (let domain in domains)
          {
            let filters = filtersByDomain[domain];
            if (filters)
              delete filters[key];
          }
        }
      }
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
  getFilterByKey: function(/**String*/ key) /**Filter*/
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
   * Returns a list of all selectors active on a particular domain, must not be
   * used in Firefox (when usingGetSelectorsForDomain is false).
   */
  getSelectorsForDomain: function(/**String*/ domain, /**Boolean*/ specificOnly)
  {
    if (!usingGetSelectorsForDomain)
      throw new Error("getSelectorsForDomain can not be used in Firefox!");

    if (!unconditionalSelectors)
      unconditionalSelectors = Object.keys(filtersBySelector);
    let selectors = specificOnly ? [] : unconditionalSelectors.slice();

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
