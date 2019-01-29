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
 * The maximum number of entries to keep in
 * <code>{@link styleSheetCache}</code>.
 */
const maxStyleSheetCacheEntries = 100;

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
 * The default style sheet that applies on all domains. This is based on the
 * value of <code>{@link unconditionalSelectors}</code>.
 * @type {?string}
 */
let defaultStyleSheet = null;

/**
 * The common style sheet that applies on all unknown domains. This is a
 * concatenation of the default style sheet and an additional style sheet based
 * on selectors from all generic filters that are not in the
 * <code>{@link unconditionalSelectors}</code> list.
 * @type {?string}
 */
let commonStyleSheet = null;

/**
 * Cache of generated domain-specific style sheets. This contains entries for
 * only known domains. If a domain is unknown, it gets
 * <code>{@link commonStyleSheet}</code>.
 * @type {Map.<string,string>}
 */
let styleSheetCache = new Map();

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
 * All domains known to occur in exceptions
 * @type {Set.<string>}
 */
let knownExceptionDomains = new Set();

/**
 * Returns the suffix of the given domain that is known. If no suffix is known,
 * an empty string is returned.
 * @param {?string} domain
 * @returns {string}
 */
function getKnownSuffix(domain)
{
  while (domain && !filtersByDomain.has(domain) &&
         !knownExceptionDomains.has(domain))
  {
    let index = domain.indexOf(".");
    domain = index == -1 ? "" : domain.substring(index + 1);
  }

  return domain;
}

/**
 * Adds a filter to the lookup table of filters by domain.
 * @param {Filter} filter
 * @param {?Map.<string,boolean>} [domains]
 */
function addToFiltersByDomain(filter, domains = filter.domains)
{
  for (let [domain, isIncluded] of domains || defaultDomains)
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

/**
 * Returns the list of selectors that apply on a given domain from the subset
 * of filters that do not apply unconditionally on all domains.
 *
 * @param {string} domain The domain.
 * @param {boolean} specificOnly Whether selectors from generic filters should
 *   be included.
 *
 * @returns {Array.<string>} The list of selectors.
 */
function getConditionalSelectors(domain, specificOnly)
{
  let selectors = [];

  let excluded = new Set();
  let currentDomain = domain;

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

  return selectors;
}

/**
 * Returns the default style sheet that applies on all domains.
 * @returns {string}
 */
function getDefaultStyleSheet()
{
  if (!defaultStyleSheet)
    defaultStyleSheet = createStyleSheet(getUnconditionalSelectors());

  return defaultStyleSheet;
}

/**
 * Returns the common style sheet that applies on all unknown domains.
 * @returns {string}
 */
function getCommonStyleSheet()
{
  if (!commonStyleSheet)
  {
    commonStyleSheet = getDefaultStyleSheet() +
                       createStyleSheet(getConditionalSelectors("", false));
  }

  return commonStyleSheet;
}

/**
 * Returns the domain-specific style sheet that applies on a given domain.
 * @param {string} domain
 * @returns {string}
 */
function getDomainSpecificStyleSheet(domain)
{
  let styleSheet = styleSheetCache.get(domain);

  if (typeof styleSheet == "undefined")
  {
    styleSheet = createStyleSheet(getConditionalSelectors(domain, false));

    if (styleSheetCache.size >= maxStyleSheetCacheEntries)
      styleSheetCache.clear();

    styleSheetCache.set(domain, styleSheet);
  }

  return styleSheet;
}

ElemHideExceptions.on("added", ({domains, selector}) =>
{
  styleSheetCache.clear();
  commonStyleSheet = null;

  if (domains)
  {
    for (let domain of domains.keys())
    {
      // Note: Once an exception domain is known it never becomes unknown, even
      // when all the exceptions containing that domain are removed. This is a
      // best-case optimization.
      if (domain != "")
        knownExceptionDomains.add(domain);
    }
  }

  // If this is the first exception for a previously unconditionally applied
  // element hiding selector we need to take care to update the lookups.
  let unconditionalFilterForSelector = filterBySelector.get(selector);
  if (unconditionalFilterForSelector)
  {
    addToFiltersByDomain(unconditionalFilterForSelector);
    filterBySelector.delete(selector);
    unconditionalSelectors = null;
    defaultStyleSheet = null;
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
    commonStyleSheet = null;

    for (let collection of [styleSheetCache, filtersByDomain, filterBySelector,
                            knownFilters, knownExceptionDomains])
    {
      collection.clear();
    }

    unconditionalSelectors = null;
    defaultStyleSheet = null;

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

    styleSheetCache.clear();
    commonStyleSheet = null;

    let {domains, selector} = filter;

    if (!(domains || ElemHideExceptions.hasExceptions(selector)))
    {
      // The new filter's selector is unconditionally applied to all domains
      filterBySelector.set(selector, filter);
      unconditionalSelectors = null;
      defaultStyleSheet = null;
    }
    else
    {
      // The new filter's selector only applies to some domains
      addToFiltersByDomain(filter, domains);
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

    styleSheetCache.clear();
    commonStyleSheet = null;

    let {selector} = filter;

    // Unconditially applied element hiding filters
    if (filterBySelector.get(selector) == filter)
    {
      filterBySelector.delete(selector);
      unconditionalSelectors = null;
      defaultStyleSheet = null;
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
   * @typedef {object} ElemHideStyleSheet
   * @property {string} code CSS code.
   * @property {Array.<string>} selectors List of selectors.
   */

  /**
   * Generates a style sheet for a given domain based on the current set of
   * filters.
   *
   * @param {string} domain The domain.
   * @param {boolean} [specificOnly=false] Whether selectors from generic
   *   filters should be included.
   * @param {boolean} [includeSelectors=false] Whether the return value should
   *   include a separate list of selectors.
   *
   * @returns {ElemHideStyleSheet} An object containing the CSS code and the
   *   list of selectors.
   */
  generateStyleSheetForDomain(domain, specificOnly = false,
                              includeSelectors = false)
  {
    let code = null;
    let selectors = null;

    if (domain[domain.length - 1] == ".")
      domain = domain.replace(/\.+$/, "");

    domain = domain.toLowerCase();

    if (specificOnly)
    {
      selectors = getConditionalSelectors(domain, true);
      code = createStyleSheet(selectors);
    }
    else
    {
      let knownSuffix = getKnownSuffix(domain);

      if (includeSelectors)
      {
        selectors = getConditionalSelectors(knownSuffix, false);
        code = knownSuffix == "" ? getCommonStyleSheet() :
                 (getDefaultStyleSheet() + createStyleSheet(selectors));

        selectors = getUnconditionalSelectors().concat(selectors);
      }
      else
      {
        code = knownSuffix == "" ? getCommonStyleSheet() :
                 (getDefaultStyleSheet() +
                  getDomainSpecificStyleSheet(knownSuffix));
      }
    }

    return {code, selectors: includeSelectors ? selectors : null};
  }
};

/**
 * Yields rules from a style sheet returned by
 * <code>{@link createStyleSheet}</code>.
 *
 * @param {string} styleSheet A style sheet returned by
 *   <code>{@link createStyleSheet}</code>. If the given style sheet is
 *   <em>not</em> a value previously returned by a call to
 *   <code>{@link createStyleSheet}</code>, the behavior is undefined.
 * @yields {string} A rule from the given style sheet.
 */
function* rulesFromStyleSheet(styleSheet)
{
  let startIndex = 0;
  while (startIndex < styleSheet.length)
  {
    let ruleTerminatorIndex = styleSheet.indexOf("\n", startIndex);
    yield styleSheet.substring(startIndex, ruleTerminatorIndex);
    startIndex = ruleTerminatorIndex + 1;
  }
}

exports.rulesFromStyleSheet = rulesFromStyleSheet;

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
 * Creates an element hiding CSS rule for a given list of selectors.
 *
 * @param {Array.<string>} selectors
 * @returns {string}
 */
function createRule(selectors)
{
  let rule = "";

  for (let i = 0; i < selectors.length - 1; i++)
    rule += selectors[i] + ", ";

  rule += selectors[selectors.length - 1] + " {display: none !important;}\n";

  return rule;
}

/**
 * Creates an element hiding CSS style sheet from a given list of selectors.
 * @param {Array.<string>} selectors
 * @returns {string}
 */
function createStyleSheet(selectors)
{
  let styleSheet = "";

  for (let selectorGroup of splitSelectors(selectors))
    styleSheet += createRule(selectorGroup);

  return styleSheet;
}

exports.createStyleSheet = createStyleSheet;
