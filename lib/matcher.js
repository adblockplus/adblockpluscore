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
 * @fileOverview Matcher class implementing matching addresses against
 *               a list of filters.
 */

const {RegExpFilter, WhitelistFilter} = require("./filterClasses");
const {suffixes} = require("./domain");

/**
 * Regular expression for matching a keyword in a filter.
 * @type {RegExp}
 */
const keywordRegExp = /[^a-z0-9%*][a-z0-9%]{3,}(?=[^a-z0-9%*])/;

/**
 * Regular expression for matching all keywords in a filter.
 * @type {RegExp}
 */
const allKeywordsRegExp = new RegExp(keywordRegExp, "g");

/**
 * Bitmask for content types that are implied by default in a filter, like
 * <code>$script</code>, <code>$image</code>, <code>$stylesheet</code>, and so
 * on.
 * @type {number}
 */
const DEFAULT_TYPES = RegExpFilter.prototype.contentType;

/**
 * Bitmask for "types" that must always be specified in a filter explicitly,
 * like <code>$csp</code>, <code>$popup</code>, <code>$elemhide</code>, and so
 * on.
 * @type {number}
 */
const NON_DEFAULT_TYPES = ~DEFAULT_TYPES;

/**
 * Bitmask for "types" that are for exception rules only, like
 * <code>$document</code>, <code>$elemhide</code>, and so on.
 * @type {number}
 */
const WHITELIST_ONLY_TYPES = RegExpFilter.typeMap.DOCUMENT |
                             RegExpFilter.typeMap.ELEMHIDE |
                             RegExpFilter.typeMap.GENERICHIDE |
                             RegExpFilter.typeMap.GENERICBLOCK;

/**
 * Map to be used instead when a filter has a blank <code>domains</code>
 * property.
 * @type {Map.<string, boolean>}
 */
let defaultDomains = new Map([["", true]]);

/**
 * Yields individual non-default types from a filter's type mask.
 * @param {number} contentType A filter's type mask.
 * @yields {number}
 */
function* nonDefaultTypes(contentType)
{
  for (let mask = contentType & NON_DEFAULT_TYPES, bitIndex = 0;
       mask != 0; mask >>>= 1, bitIndex++)
  {
    if ((mask & 1) != 0)
    {
      // Note: The zero-fill right shift by zero is necessary for dropping the
      // sign.
      yield 1 << bitIndex >>> 0;
    }
  }
}

/**
 * Adds a filter by a given keyword to a map.
 * @param {RegExpFilter} filter
 * @param {string} keyword
 * @param {Map.<string,(RegExpFilter|Set.<RegExpFilter>)>} map
 */
function addFilterByKeyword(filter, keyword, map)
{
  let set = map.get(keyword);
  if (typeof set == "undefined")
  {
    map.set(keyword, filter);
  }
  else if (set.size == 1)
  {
    if (filter != set)
      map.set(keyword, new Set([set, filter]));
  }
  else
  {
    set.add(filter);
  }
}

/**
 * Removes a filter by a given keyword from a map.
 * @param {RegExpFilter} filter
 * @param {string} keyword
 * @param {Map.<string,(RegExpFilter|Set.<RegExpFilter>)>} map
 */
function removeFilterByKeyword(filter, keyword, map)
{
  let set = map.get(keyword);
  if (typeof set == "undefined")
    return;

  if (set.size == 1)
  {
    if (filter == set)
      map.delete(keyword);
  }
  else
  {
    set.delete(filter);

    if (set.size == 1)
      map.set(keyword, [...set][0]);
  }
}

/**
 * Checks whether a particular filter is slow.
 * @param {RegExpFilter} filter
 * @returns {boolean}
 */
function isSlowFilter(filter)
{
  return !filter.pattern || !keywordRegExp.test(filter.pattern);
}

exports.isSlowFilter = isSlowFilter;

/**
 * Blacklist/whitelist filter matching
 */
class Matcher
{
  constructor()
  {
    /**
     * Lookup table for keywords by their associated filter
     * @type {Map.<RegExpFilter,string>}
     * @private
     */
    this._keywordByFilter = new Map();

    /**
     * Lookup table for simple filters by their associated keyword
     * @type {Map.<string,(RegExpFilter|Set.<RegExpFilter>)>}
     * @private
     */
    this._simpleFiltersByKeyword = new Map();

    /**
     * Lookup table for complex filters by their associated keyword
     * @type {Map.<string,(RegExpFilter|Set.<RegExpFilter>)>}
     * @private
     */
    this._complexFiltersByKeyword = new Map();

    /**
     * Lookup table of domain maps for complex filters by their associated
     * keyword
     * @type {Map.<string,Map.<string,(RegExpFilter|
     *                                 Map.<RegExpFilter,boolean>)>>}
     * @private
     */
    this._filterDomainMapsByKeyword = new Map();

    /**
     * Lookup table of type-specific lookup tables for complex filters by their
     * associated keyword
     * @type {Map.<string,Map.<string,(RegExpFilter|Set.<RegExpFilter>)>>}
     * @private
     */
    this._filterMapsByType = new Map();
  }

  /**
   * Removes all known filters
   */
  clear()
  {
    this._keywordByFilter.clear();
    this._simpleFiltersByKeyword.clear();
    this._complexFiltersByKeyword.clear();
    this._filterDomainMapsByKeyword.clear();
    this._filterMapsByType.clear();
  }

  /**
   * Adds a filter to the matcher
   * @param {RegExpFilter} filter
   */
  add(filter)
  {
    if (this._keywordByFilter.has(filter))
      return;

    // Look for a suitable keyword
    let keyword = this.findKeyword(filter);
    let locationOnly = filter.isLocationOnly();

    addFilterByKeyword(filter, keyword,
                       locationOnly ? this._simpleFiltersByKeyword :
                         this._complexFiltersByKeyword);

    this._keywordByFilter.set(filter, keyword);

    if (locationOnly)
      return;

    for (let type of nonDefaultTypes(filter.contentType))
    {
      let map = this._filterMapsByType.get(type);
      if (!map)
        this._filterMapsByType.set(type, map = new Map());

      addFilterByKeyword(filter, keyword, map);
    }

    let filtersByDomain = this._filterDomainMapsByKeyword.get(keyword);
    if (!filtersByDomain)
      this._filterDomainMapsByKeyword.set(keyword, filtersByDomain = new Map());

    for (let [domain, include] of filter.domains || defaultDomains)
    {
      if (!include && domain == "")
        continue;

      let map = filtersByDomain.get(domain);
      if (!map)
      {
        filtersByDomain.set(domain, include ? filter :
                              map = new Map([[filter, false]]));
      }
      else if (map.size == 1 && !(map instanceof Map))
      {
        if (filter != map)
        {
          filtersByDomain.set(domain, new Map([[map, true],
                                               [filter, include]]));
        }
      }
      else
      {
        map.set(filter, include);
      }
    }
  }

  /**
   * Removes a filter from the matcher
   * @param {RegExpFilter} filter
   */
  remove(filter)
  {
    let keyword = this._keywordByFilter.get(filter);
    if (typeof keyword == "undefined")
      return;

    let locationOnly = filter.isLocationOnly();

    removeFilterByKeyword(filter, keyword,
                          locationOnly ? this._simpleFiltersByKeyword :
                            this._complexFiltersByKeyword);

    this._keywordByFilter.delete(filter);

    if (locationOnly)
      return;

    for (let type of nonDefaultTypes(filter.contentType))
    {
      let map = this._filterMapsByType.get(type);
      if (map)
        removeFilterByKeyword(filter, keyword, map);
    }

    let filtersByDomain = this._filterDomainMapsByKeyword.get(keyword);
    if (filtersByDomain)
    {
      let domains = filter.domains || defaultDomains;
      for (let domain of domains.keys())
      {
        let map = filtersByDomain.get(domain);
        if (map)
        {
          if (map.size > 1 || map instanceof Map)
          {
            map.delete(filter);

            if (map.size == 0)
              filtersByDomain.delete(domain);
          }
          else if (filter == map)
          {
            filtersByDomain.delete(domain);
          }
        }
      }
    }
  }

  /**
   * Chooses a keyword to be associated with the filter
   * @param {Filter} filter
   * @returns {string} keyword or an empty string if no keyword could be found
   * @protected
   */
  findKeyword(filter)
  {
    let result = "";
    let {pattern} = filter;
    if (pattern == null)
      return result;

    let candidates = pattern.toLowerCase().match(allKeywordsRegExp);
    if (!candidates)
      return result;

    let resultCount = 0xFFFFFF;
    let resultLength = 0;
    for (let i = 0, l = candidates.length; i < l; i++)
    {
      let candidate = candidates[i].substr(1);
      let simpleFilters = this._simpleFiltersByKeyword.get(candidate);
      let complexFilters = this._complexFiltersByKeyword.get(candidate);
      let count = (typeof simpleFilters != "undefined" ?
                     simpleFilters.size : 0) +
                  (typeof complexFilters != "undefined" ?
                     complexFilters.size : 0);
      if (count < resultCount ||
          (count == resultCount && candidate.length > resultLength))
      {
        result = candidate;
        resultCount = count;
        resultLength = candidate.length;
      }
    }
    return result;
  }

  _checkEntryMatchSimple(keyword, location, typeMask, docDomain, thirdParty,
                         sitekey, specificOnly, collection)
  {
    let filters = this._simpleFiltersByKeyword.get(keyword);
    if (filters)
    {
      let lowerCaseLocation = location.toLowerCase();

      for (let filter of filters)
      {
        if (specificOnly && !(filter instanceof WhitelistFilter))
          continue;

        if (filter.matchesLocation(location, lowerCaseLocation))
        {
          if (!collection)
            return filter;

          collection.push(filter);
        }
      }
    }

    return null;
  }

  _checkEntryMatchForType(keyword, location, typeMask, docDomain, thirdParty,
                          sitekey, specificOnly, collection)
  {
    let filtersForType = this._filterMapsByType.get(typeMask);
    if (filtersForType)
    {
      let filters = filtersForType.get(keyword);
      if (filters)
      {
        for (let filter of filters)
        {
          if (specificOnly && filter.isGeneric() &&
              !(filter instanceof WhitelistFilter))
            continue;

          if (filter.matches(location, typeMask, docDomain, thirdParty,
                             sitekey))
          {
            if (!collection)
              return filter;

            collection.push(filter);
          }
        }
      }
    }

    return null;
  }

  _checkEntryMatchByDomain(keyword, location, typeMask, docDomain, thirdParty,
                           sitekey, specificOnly, collection)
  {
    let filtersByDomain = this._filterDomainMapsByKeyword.get(keyword);
    if (filtersByDomain)
    {
      // The code in this block is similar to the generateStyleSheetForDomain
      // function in lib/elemHide.js.

      if (docDomain)
      {
        if (docDomain[docDomain.length - 1] == ".")
          docDomain = docDomain.replace(/\.+$/, "");

        docDomain = docDomain.toLowerCase();
      }

      let excluded = new Set();

      for (let suffix of suffixes(docDomain || "", !specificOnly))
      {
        let filters = filtersByDomain.get(suffix);
        if (filters)
        {
          for (let [filter, include] of filters.entries())
          {
            if (!include)
            {
              excluded.add(filter);
            }
            else if ((excluded.size == 0 || !excluded.has(filter)) &&
                     filter.matchesWithoutDomain(location, typeMask,
                                                 thirdParty, sitekey))
            {
              if (!collection)
                return filter;

              collection.push(filter);
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Checks whether the entries for a particular keyword match a URL
   * @param {string} keyword
   * @param {string} location
   * @param {number} typeMask
   * @param {string} [docDomain]
   * @param {boolean} [thirdParty]
   * @param {string} [sitekey]
   * @param {boolean} [specificOnly]
   * @param {?Array.<Filter>} [collection] An optional list of filters to which
   *   to append any results. If specified, the function adds <em>all</em>
   *   matching filters to the list; if omitted, the function directly returns
   *   the first matching filter.
   * @returns {?Filter}
   * @protected
   */
  checkEntryMatch(keyword, location, typeMask, docDomain, thirdParty, sitekey,
                  specificOnly, collection)
  {
    // We need to skip the simple (location-only) filters if the type mask does
    // not contain any default content types.
    if (!specificOnly && (typeMask & DEFAULT_TYPES) != 0)
    {
      let filter = this._checkEntryMatchSimple(keyword, location, typeMask,
                                               docDomain, thirdParty, sitekey,
                                               specificOnly, collection);
      if (filter)
        return filter;
    }

    // If the type mask contains a non-default type (first condition) and it is
    // the only type in the mask (second condition), we can use the
    // type-specific map, which typically contains a lot fewer filters. This
    // enables faster lookups for whitelisting types like $document, $elemhide,
    // and so on, as well as other special types like $csp.
    if ((typeMask & NON_DEFAULT_TYPES) != 0 && (typeMask & typeMask - 1) == 0)
    {
      return this._checkEntryMatchForType(keyword, location, typeMask,
                                          docDomain, thirdParty, sitekey,
                                          specificOnly, collection);
    }

    return this._checkEntryMatchByDomain(keyword, location, typeMask,
                                         docDomain, thirdParty, sitekey,
                                         specificOnly, collection);
  }

  /**
   * Tests whether the URL matches any of the known filters
   * @param {string} location
   *   URL to be tested
   * @param {number} typeMask
   *   bitmask of content / request types to match
   * @param {string} [docDomain]
   *   domain name of the document that loads the URL
   * @param {boolean} [thirdParty]
   *   should be true if the URL is a third-party request
   * @param {string} [sitekey]
   *   public key provided by the document
   * @param {boolean} [specificOnly]
   *   should be <code>true</code> if generic matches should be ignored
   * @returns {?RegExpFilter}
   *   matching filter or <code>null</code>
   */
  matchesAny(location, typeMask, docDomain, thirdParty, sitekey, specificOnly)
  {
    let candidates = location.toLowerCase().match(/[a-z0-9%]{3,}/g);
    if (candidates === null)
      candidates = [];
    candidates.push("");
    for (let i = 0, l = candidates.length; i < l; i++)
    {
      let result = this.checkEntryMatch(candidates[i], location, typeMask,
                                        docDomain, thirdParty, sitekey,
                                        specificOnly);
      if (result)
        return result;
    }

    return null;
  }
}

exports.Matcher = Matcher;

/**
 * Combines a matcher for blocking and exception rules, automatically sorts
 * rules into two {@link Matcher} instances.
 */
class CombinedMatcher
{
  constructor()
  {
    /**
     * Maximal number of matching cache entries to be kept
     * @type {number}
     */
    this.maxCacheEntries = 10000;

    /**
     * Matcher for blocking rules.
     * @type {Matcher}
     * @private
     */
    this._blacklist = new Matcher();

    /**
     * Matcher for exception rules.
     * @type {Matcher}
     * @private
     */
    this._whitelist = new Matcher();

    /**
     * Lookup table of previous {@link Matcher#matchesAny} results
     * @type {Map.<string,Filter>}
     * @private
     */
    this._resultCache = new Map();
  }

  /**
   * @see Matcher#clear
   */
  clear()
  {
    this._blacklist.clear();
    this._whitelist.clear();
    this._resultCache.clear();
  }

  /**
   * @see Matcher#add
   * @param {Filter} filter
   */
  add(filter)
  {
    if (filter instanceof WhitelistFilter)
      this._whitelist.add(filter);
    else
      this._blacklist.add(filter);

    this._resultCache.clear();
  }

  /**
   * @see Matcher#remove
   * @param {Filter} filter
   */
  remove(filter)
  {
    if (filter instanceof WhitelistFilter)
      this._whitelist.remove(filter);
    else
      this._blacklist.remove(filter);

    this._resultCache.clear();
  }

  /**
   * @see Matcher#findKeyword
   * @param {Filter} filter
   * @returns {string} keyword
   * @protected
   */
  findKeyword(filter)
  {
    if (filter instanceof WhitelistFilter)
      return this._whitelist.findKeyword(filter);
    return this._blacklist.findKeyword(filter);
  }

  /**
   * Optimized filter matching testing both whitelist and blacklist matchers
   * simultaneously. For parameters see
     {@link Matcher#matchesAny Matcher.matchesAny()}.
   * @see Matcher#matchesAny
   * @inheritdoc
   * @private
   */
  _matchesAnyInternal(location, typeMask, docDomain, thirdParty, sitekey,
                      specificOnly)
  {
    let candidates = location.toLowerCase().match(/[a-z0-9%]{3,}/g);
    if (candidates === null)
      candidates = [];

    // The first keyword in a URL is the protocol (usually "https" or "http").
    // This is an outlier: it has hundreds of filters typically, yet it rarely
    // ever has a match. We cut down the amount of processing for blocked URLs
    // significantly by moving it to the end of the list.
    if (candidates.length > 1)
      candidates.push(candidates.shift());

    candidates.push("");

    let whitelistHit = null;
    let blacklistHit = null;

    // If the type mask includes no types other than whitelist-only types, we
    // can skip the blacklist.
    if ((typeMask & ~WHITELIST_ONLY_TYPES) != 0)
    {
      for (let i = 0, l = candidates.length; !blacklistHit && i < l; i++)
      {
        blacklistHit = this._blacklist.checkEntryMatch(candidates[i], location,
                                                       typeMask, docDomain,
                                                       thirdParty, sitekey,
                                                       specificOnly);
      }
    }

    // If the type mask includes any whitelist-only types, we need to check the
    // whitelist.
    if (blacklistHit || (typeMask & WHITELIST_ONLY_TYPES) != 0)
    {
      for (let i = 0, l = candidates.length; !whitelistHit && i < l; i++)
      {
        whitelistHit = this._whitelist.checkEntryMatch(candidates[i], location,
                                                       typeMask, docDomain,
                                                       thirdParty, sitekey);
      }
    }

    return whitelistHit || blacklistHit;
  }

  _searchInternal(location, typeMask, docDomain, thirdParty, sitekey,
                  specificOnly, filterType)
  {
    let hits = {};

    let searchBlocking = filterType == "blocking" || filterType == "all";
    let searchWhitelist = filterType == "whitelist" || filterType == "all";

    if (searchBlocking)
      hits.blocking = [];

    if (searchWhitelist)
      hits.whitelist = [];

    // If the type mask includes no types other than whitelist-only types, we
    // can skip the blacklist.
    if ((typeMask & ~WHITELIST_ONLY_TYPES) == 0)
      searchBlocking = false;

    let candidates = location.toLowerCase().match(/[a-z0-9%]{3,}/g);
    if (candidates === null)
      candidates = [];
    candidates.push("");

    for (let i = 0, l = candidates.length; i < l; i++)
    {
      if (searchBlocking)
      {
        this._blacklist.checkEntryMatch(candidates[i], location, typeMask,
                                        docDomain, thirdParty, sitekey,
                                        specificOnly, hits.blocking);
      }

      if (searchWhitelist)
      {
        this._whitelist.checkEntryMatch(candidates[i], location, typeMask,
                                        docDomain, thirdParty, sitekey,
                                        false, hits.whitelist);
      }
    }

    return hits;
  }

  /**
   * @see Matcher#matchesAny
   * @inheritdoc
   */
  matchesAny(location, typeMask, docDomain, thirdParty, sitekey, specificOnly)
  {
    let key = location + " " + typeMask + " " + docDomain + " " + thirdParty +
      " " + sitekey + " " + specificOnly;

    let result = this._resultCache.get(key);
    if (typeof result != "undefined")
      return result;

    result = this._matchesAnyInternal(location, typeMask, docDomain,
                                      thirdParty, sitekey, specificOnly);

    if (this._resultCache.size >= this.maxCacheEntries)
      this._resultCache.clear();

    this._resultCache.set(key, result);

    return result;
  }

  /**
   * @typedef {object} MatcherSearchResults
   * @property {Array.<BlockingFilter>} [blocking] List of blocking filters
   *   found.
   * @property {Array.<WhitelistFilter>} [whitelist] List of whitelist filters
   *   found.
   */

  /**
   * Searches all blocking and whitelist filters and returns results matching
   * the given parameters.
   *
   * @param {string} location
   * @param {number} typeMask
   * @param {string} [docDomain]
   * @param {boolean} [thirdParty]
   * @param {string} [sitekey]
   * @param {boolean} [specificOnly]
   * @param {string} [filterType] The types of filters to look for. This can be
   *   <code>"blocking"</code>, <code>"whitelist"</code>, or
   *   <code>"all"</code> (default).
   *
   * @returns {MatcherSearchResults}
   */
  search(location, typeMask, docDomain, thirdParty, sitekey, specificOnly,
         filterType = "all")
  {
    let key = "* " + location + " " + typeMask + " " + docDomain + " " +
              thirdParty + " " + sitekey + " " + specificOnly + " " +
              filterType;

    let result = this._resultCache.get(key);
    if (typeof result != "undefined")
      return result;

    result = this._searchInternal(location, typeMask, docDomain, thirdParty,
                                  sitekey, specificOnly, filterType);

    if (this._resultCache.size >= this.maxCacheEntries)
      this._resultCache.clear();

    this._resultCache.set(key, result);

    return result;
  }

  /**
   * Tests whether the URL is whitelisted
   * @see Matcher#matchesAny
   * @inheritdoc
   * @returns {boolean}
   */
  isWhitelisted(location, typeMask, docDomain, thirdParty, sitekey)
  {
    return !!this._whitelist.matchesAny(location, typeMask, docDomain,
                                        thirdParty, sitekey);
  }
}

exports.CombinedMatcher = CombinedMatcher;

/**
 * Shared {@link CombinedMatcher} instance that should usually be used.
 * @type {CombinedMatcher}
 */
let defaultMatcher = new CombinedMatcher();

exports.defaultMatcher = defaultMatcher;
