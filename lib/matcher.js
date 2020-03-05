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

/** @module */

"use strict";

/**
 * @fileOverview Matcher class implementing matching addresses against
 *               a list of filters.
 */

const {RESOURCE_TYPES, SPECIAL_TYPES, WHITELISTING_TYPES,
       enumerateTypes} = require("./contentTypes");
const {filterToRegExp} = require("./common");
const {normalizeHostname, domainSuffixes, URLRequest} = require("./url");
const {FiltersByDomain, FilterMap} = require("./filtersByDomain");
const {Cache} = require("./caching");

/**
 * Regular expression for matching a keyword in a filter.
 * @type {RegExp}
 */
let keywordRegExp = /[^a-z0-9%*][a-z0-9%]{2,}(?=[^a-z0-9%*])/;

/**
 * Regular expression for matching all keywords in a filter.
 * @type {RegExp}
 */
let allKeywordsRegExp = new RegExp(keywordRegExp, "g");

/**
 * The maximum number of patterns that
 * `{@link module:matcher~compilePatterns compilePatterns()}` will compile
 * into regular expressions.
 * @type {number}
 */
const COMPILE_PATTERNS_MAX = 100;

/**
 * Checks if the keyword is bad for use.
 * @param {string} keyword
 * @returns {boolean}
 */
function isBadKeyword(keyword)
{
  return keyword == "https" || keyword == "http" || keyword == "com" ||
         keyword == "js";
}

/**
 * A `CompiledPatterns` object represents the compiled version of multiple URL
 * request patterns. It is returned by
 * `{@link module:matcher~compilePatterns compilePatterns()}`.
 */
class CompiledPatterns
{
  /**
   * Creates an object with the given regular expressions for case-sensitive
   * and case-insensitive matching respectively.
   * @param {?RegExp} [caseSensitive]
   * @param {?RegExp} [caseInsensitive]
   * @private
   */
  constructor(caseSensitive, caseInsensitive)
  {
    this._caseSensitive = caseSensitive;
    this._caseInsensitive = caseInsensitive;
  }

  /**
   * Tests whether the given URL request matches the patterns used to create
   * this object.
   * @param {module:url.URLRequest} request
   * @returns {boolean}
   */
  test(request)
  {
    return ((this._caseSensitive &&
             this._caseSensitive.test(request.href)) ||
            (this._caseInsensitive &&
             this._caseInsensitive.test(request.lowerCaseHref)));
  }
}

/**
 * Compiles patterns from the given filters into a single
 * `{@link module:matcher~CompiledPatterns CompiledPatterns}` object.
 *
 * @param {module:filterClasses.URLFilter|
 *         Set.<module:filterClasses.URLFilter>} filters
 *   The filters. If the number of filters exceeds
 *   `{@link module:matcher~COMPILE_PATTERNS_MAX COMPILE_PATTERNS_MAX}`, the
 *   function returns `null`.
 *
 * @returns {?module:matcher~CompiledPatterns}
 */
function compilePatterns(filters)
{
  // If the number of filters is too large, it may choke especially on low-end
  // platforms. As a precaution, we refuse to compile. Ideally we would check
  // the length of the regular expression source rather than the number of
  // filters, but this is far more straightforward and practical.
  if (filters.size > COMPILE_PATTERNS_MAX)
    return null;

  let caseSensitive = "";
  let caseInsensitive = "";

  for (let filter of filters)
  {
    let source = filter.pattern != null ? filterToRegExp(filter.pattern) :
                   filter.regexp.source;

    if (filter.matchCase)
      caseSensitive += source + "|";
    else
      caseInsensitive += source + "|";
  }

  let caseSensitiveRegExp = null;
  let caseInsensitiveRegExp = null;

  try
  {
    if (caseSensitive)
      caseSensitiveRegExp = new RegExp(caseSensitive.slice(0, -1));

    if (caseInsensitive)
      caseInsensitiveRegExp = new RegExp(caseInsensitive.slice(0, -1));
  }
  catch (error)
  {
    // It is possible in theory for the regular expression to be too large
    // despite COMPILE_PATTERNS_MAX
    return null;
  }

  return new CompiledPatterns(caseSensitiveRegExp, caseInsensitiveRegExp);
}

/**
 * Adds a filter by a given keyword to a map.
 * @param {module:filterClasses.URLFilter} filter
 * @param {string} keyword
 * @param {Map.<string,(module:filterClasses.URLFilter|
 *                      Set.<module:filterClasses.URLFilter>)>} map
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
 * @param {module:filterClasses.URLFilter} filter
 * @param {string} keyword
 * @param {Map.<string,(module:filterClasses.URLFilter|
 *                      Set.<module:filterClasses.URLFilter>)>} map
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
 * Checks whether a filter matches a given URL request without checking the
 * filter's domains.
 *
 * @param {module:filterClasses.URLFilter} filter The filter.
 * @param {module:url.URLRequest} request The URL request.
 * @param {number} typeMask A mask specifying the content type of the URL
 *   request.
 * @param {?string} [sitekey] An optional public key associated with the
 *   URL request.
 * @param {?Array} [collection] An optional list to which to append the filter
 *   if it matches. If omitted, the function directly returns the filter if it
 *   matches.
 *
 * @returns {?module:filterClasses.URLFilter} The filter if it matches and
 *   `collection` is omitted; otherwise `null`.
 */
function matchFilterWithoutDomain(filter, request, typeMask, sitekey,
                                  collection)
{
  if (filter.matchesWithoutDomain(request, typeMask, sitekey))
  {
    if (!collection)
      return filter;

    collection.push(filter);
  }

  return null;
}

/**
 * Checks whether a particular filter is slow.
 * @param {module:filterClasses.URLFilter} filter
 * @returns {boolean}
 */
exports.isSlowFilter = function isSlowFilter(filter)
{
  return !filter.pattern || !keywordRegExp.test(filter.pattern);
};

let Matcher =
/**
 * Blocking/whitelist filter matching
 */
exports.Matcher = class Matcher
{
  constructor()
  {
    /**
     * Lookup table for keywords by their associated filter
     * @type {Map.<module:filterClasses.URLFilter,string>}
     * @private
     */
    this._keywordByFilter = new Map();

    /**
     * Lookup table for simple filters by their associated keyword
     * @type {Map.<string,(module:filterClasses.URLFilter|
     *                     Set.<module:filterClasses.URLFilter>)>}
     * @private
     */
    this._simpleFiltersByKeyword = new Map();

    /**
     * Lookup table for complex filters by their associated keyword
     * @type {Map.<string,(module:filterClasses.URLFilter|
     *                     Set.<module:filterClasses.URLFilter>)>}
     * @private
     */
    this._complexFiltersByKeyword = new Map();

    /**
     * Lookup table of compiled patterns for simple filters by their associated
     * keyword
     * @type {Map.<string,?module:matcher~CompiledPatterns>}
     * @private
     */
    this._compiledPatternsByKeyword = new Map();

    /**
     * Compiled patterns for generic complex filters with no associated
     * keyword.
     * @type {?module:matcher~CompiledPatterns|boolean}
     * @private
     */
    this._keywordlessCompiledPatterns = false;

    /**
     * Lookup table of domain maps for complex filters by their associated
     * keyword
     * @type {Map.<string,
     *             Map.<string,
     *                  (module:filterClasses.URLFilter|
     *                   Map.<module:filterClasses.URLFilter,boolean>)>>}
     * @private
     */
    this._filterDomainMapsByKeyword = new Map();

    /**
     * Lookup table of type-specific lookup tables for complex filters by their
     * associated keyword
     * @type {Map.<string,
     *             Map.<string,
     *                  (module:filterClasses.URLFilter|
     *                   Set.<module:filterClasses.URLFilter>)>>}
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
    this._compiledPatternsByKeyword.clear();
    this._keywordlessCompiledPatterns = false;
    this._filterDomainMapsByKeyword.clear();
    this._filterMapsByType.clear();
  }

  /**
   * Adds a filter to the matcher
   * @param {module:filterClasses.URLFilter} filter
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
    {
      if (this._compiledPatternsByKeyword.size > 0)
        this._compiledPatternsByKeyword.delete(keyword);

      return;
    }

    if (keyword == "")
      this._keywordlessCompiledPatterns = false;

    for (let type of enumerateTypes(filter.contentType, SPECIAL_TYPES))
    {
      let map = this._filterMapsByType.get(type);
      if (!map)
        this._filterMapsByType.set(type, map = new Map());

      addFilterByKeyword(filter, keyword, map);
    }

    let {domains} = filter;

    let filtersByDomain = this._filterDomainMapsByKeyword.get(keyword);
    if (!filtersByDomain)
    {
      // In most cases, there is only one pure generic filter to a keyword.
      // Instead of Map { "foo" => Map { "" => Map { filter => true } } }, we
      // can just reduce it to Map { "foo" => filter } and save a lot of
      // memory.
      if (!domains)
      {
        this._filterDomainMapsByKeyword.set(keyword, filter);
        return;
      }

      filtersByDomain = new FiltersByDomain();
      this._filterDomainMapsByKeyword.set(keyword, filtersByDomain);
    }
    else if (!(filtersByDomain instanceof FiltersByDomain))
    {
      filtersByDomain = new FiltersByDomain([["", filtersByDomain]]);
      this._filterDomainMapsByKeyword.set(keyword, filtersByDomain);
    }

    filtersByDomain.add(filter, domains);
  }

  /**
   * Removes a filter from the matcher
   * @param {module:filterClasses.URLFilter} filter
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
    {
      if (this._compiledPatternsByKeyword.size > 0)
        this._compiledPatternsByKeyword.delete(keyword);

      return;
    }

    if (keyword == "")
      this._keywordlessCompiledPatterns = false;

    for (let type of enumerateTypes(filter.contentType, SPECIAL_TYPES))
    {
      let map = this._filterMapsByType.get(type);
      if (map)
        removeFilterByKeyword(filter, keyword, map);
    }

    let filtersByDomain = this._filterDomainMapsByKeyword.get(keyword);
    if (filtersByDomain)
    {
      // Because of the memory optimization in the add function, most of the
      // time this will be a filter rather than a map.
      if (!(filtersByDomain instanceof FiltersByDomain))
      {
        this._filterDomainMapsByKeyword.delete(keyword);
        return;
      }

      filtersByDomain.remove(filter);

      if (filtersByDomain.size == 0)
      {
        this._filterDomainMapsByKeyword.delete(keyword);
      }
      else if (filtersByDomain.size == 1)
      {
        for (let [lastDomain, map] of filtersByDomain.entries())
        {
          // Reduce Map { "foo" => Map { "" => filter } } to
          // Map { "foo" => filter }
          if (lastDomain == "" && !(map instanceof FilterMap))
            this._filterDomainMapsByKeyword.set(keyword, map);

          break;
        }
      }
    }
  }

  /**
   * Chooses a keyword to be associated with the filter
   * @param {module:filterClasses.Filter} filter
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
      let candidate = candidates[i].substring(1);

      if (isBadKeyword(candidate))
        continue;

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

  _matchFiltersByDomain(filtersByDomain, request, typeMask, sitekey,
                        specificOnly, collection)
  {
    let excluded = null;

    let domain = request.documentHostname ?
                   normalizeHostname(request.documentHostname) :
                   "";
    for (let suffix of domainSuffixes(domain, !specificOnly))
    {
      let map = filtersByDomain.get(suffix);
      if (map)
      {
        if (map instanceof FilterMap)
        {
          for (let [filter, include] of map.entries())
          {
            if (!include)
            {
              if (excluded)
                excluded.add(filter);
              else
                excluded = new Set([filter]);
            }
            else if ((!excluded || !excluded.has(filter)) &&
                     matchFilterWithoutDomain(filter, request, typeMask,
                                              sitekey, collection))
            {
              return filter;
            }
          }
        }
        else if ((!excluded || !excluded.has(map)) &&
                 matchFilterWithoutDomain(map, request, typeMask,
                                          sitekey, collection))
        {
          return map;
        }
      }
    }

    return null;
  }

  _checkEntryMatchSimpleQuickCheck(keyword, request, filters)
  {
    let compiled = this._compiledPatternsByKeyword.get(keyword);
    if (typeof compiled == "undefined")
    {
      compiled = compilePatterns(filters);
      this._compiledPatternsByKeyword.set(keyword, compiled);
    }

    // If compilation failed (e.g. too many filters), return true because this
    // is only a pre-check.
    return !compiled || compiled.test(request);
  }

  _checkEntryMatchSimple(keyword, request, collection)
  {
    let filters = this._simpleFiltersByKeyword.get(keyword);

    // For simple filters where there's more than one filter to the keyword, we
    // do a quick check using a single compiled pattern that combines all the
    // patterns. This is a lot faster for requests that are not going to be
    // blocked (i.e. most requests).
    if (filters && (filters.size == 1 ||
                    this._checkEntryMatchSimpleQuickCheck(keyword, request,
                                                          filters)))
    {
      for (let filter of filters)
      {
        if (filter.matchesLocation(request))
        {
          if (!collection)
            return filter;

          collection.push(filter);
        }
      }
    }

    return null;
  }

  _checkEntryMatchForType(keyword, request, typeMask, sitekey, specificOnly,
                          collection)
  {
    let filtersForType = this._filterMapsByType.get(typeMask);
    if (filtersForType)
    {
      let filters = filtersForType.get(keyword);
      if (filters)
      {
        for (let filter of filters)
        {
          if (specificOnly && filter.isGeneric())
            continue;

          if (filter.matches(request, typeMask, sitekey))
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

  _checkEntryMatchByDomain(keyword, request, typeMask, sitekey, specificOnly,
                           collection)
  {
    let filtersByDomain = this._filterDomainMapsByKeyword.get(keyword);
    if (filtersByDomain)
    {
      if (filtersByDomain instanceof FiltersByDomain)
      {
        if (keyword == "" && !specificOnly)
        {
          let compiled = this._keywordlessCompiledPatterns;

          // If the value is false, it indicates that we need to initialize it
          // to either a CompiledPatterns object or null.
          if (compiled == false)
          {
            // Compile all the patterns from the generic filters into a single
            // object. It is worth doing this for the keywordless generic
            // complex filters because they must be checked against every
            // single URL request that has not already been blocked by one of
            // the simple filters (i.e. most URL requests).
            let map = filtersByDomain.get("");
            if (map instanceof FilterMap)
              compiled = compilePatterns(new Set(map.keys()));

            this._keywordlessCompiledPatterns = compiled || null;
          }

          // We can skip the generic filters if none of them pass the test.
          if (compiled && !compiled.test(request))
            specificOnly = true;
        }

        return this._matchFiltersByDomain(filtersByDomain, request, typeMask,
                                          sitekey, specificOnly, collection);
      }

      // Because of the memory optimization in the add function, most of the
      // time this will be a filter rather than a map.

      // Also see #7312: If it's a single filter, it's always the equivalent of
      // Map { "" => Map { filter => true } } (i.e. applies to any domain). If
      // the specific-only flag is set, we skip it.
      if (!specificOnly)
      {
        return matchFilterWithoutDomain(filtersByDomain, request, typeMask,
                                        sitekey, collection);
      }
    }

    return null;
  }

  /**
   * Checks whether the entries for a particular keyword match a URL
   * @param {string} keyword
   * @param {module:url.URLRequest} request
   * @param {number} typeMask
   * @param {?string} [sitekey]
   * @param {boolean} [specificOnly]
   * @param {?Array.<module:filterClasses.Filter>} [collection] An optional
   *   list of filters to which to append any results. If specified, the
   *   function adds *all* matching filters to the list; if omitted,
   *   the function directly returns the first matching filter.
   * @returns {?module:filterClasses.Filter}
   * @protected
   */
  checkEntryMatch(keyword, request, typeMask, sitekey, specificOnly,
                  collection)
  {
    // We need to skip the simple (location-only) filters if the type mask does
    // not contain any resource types.
    if (!specificOnly && (typeMask & RESOURCE_TYPES) != 0)
    {
      let filter = this._checkEntryMatchSimple(keyword, request, collection);
      if (filter)
        return filter;
    }

    // If the type mask contains a special type (first condition) and it is
    // the only type in the mask (second condition), we can use the
    // type-specific map, which typically contains a lot fewer filters. This
    // enables faster lookups for whitelisting types like $document, $elemhide,
    // and so on, as well as other special types like $csp.
    if ((typeMask & SPECIAL_TYPES) != 0 && (typeMask & typeMask - 1) == 0)
    {
      return this._checkEntryMatchForType(keyword, request, typeMask,
                                          sitekey, specificOnly, collection);
    }

    return this._checkEntryMatchByDomain(keyword, request, typeMask,
                                         sitekey, specificOnly, collection);
  }

  /**
   * @see #match
   * @deprecated
   * @inheritdoc
   */
  matchesAny(url, typeMask, docDomain, sitekey, specificOnly)
  {
    return this.match(url, typeMask, docDomain, sitekey, specificOnly);
  }

  /**
   * Tests whether the URL matches any of the known filters
   * @param {URL|module:url~URLInfo} url
   *   URL to be tested
   * @param {number} typeMask
   *   bitmask of content / request types to match
   * @param {?string} [docDomain]
   *   domain name of the document that loads the URL
   * @param {?string} [sitekey]
   *   public key provided by the document
   * @param {boolean} [specificOnly]
   *   should be `true` if generic matches should be ignored
   * @returns {?module:filterClasses.URLFilter}
   *   matching filter or `null`
   */
  match(url, typeMask, docDomain, sitekey, specificOnly)
  {
    let request = URLRequest.from(url, docDomain);
    let candidates = request.lowerCaseHref.match(/[a-z0-9%]{2,}|$/g);

    for (let i = 0, l = candidates.length; i < l; i++)
    {
      if (isBadKeyword(candidates[i]))
        continue;

      let result = this.checkEntryMatch(candidates[i], request, typeMask,
                                        sitekey, specificOnly);
      if (result)
        return result;
    }

    return null;
  }
};

let CombinedMatcher =
/**
 * Combines a matcher for blocking and exception rules, automatically sorts
 * rules into two `{@link module:matcher.Matcher Matcher}` instances.
 */
exports.CombinedMatcher = class CombinedMatcher
{
  constructor()
  {
    /**
     * Matcher for blocking rules.
     * @type {module:matcher.Matcher}
     * @private
     */
    this._blocking = new Matcher();

    /**
     * Matcher for exception rules.
     * @type {module:matcher.Matcher}
     * @private
     */
    this._whitelist = new Matcher();

    /**
     * Lookup table of previous match results
     * @type {module:caching.Cache.<string, ?(module:filterClasses.URLFilter|
     *                                        MatcherSearchResults)>}
     * @private
     */
    this._resultCache = new Cache(10000);
  }

  /**
   * @see module:matcher.Matcher#clear
   */
  clear()
  {
    this._blocking.clear();
    this._whitelist.clear();
    this._resultCache.clear();
  }

  /**
   * @see module:matcher.Matcher#add
   * @param {module:filterClasses.Filter} filter
   */
  add(filter)
  {
    if (filter.type == "whitelist")
      this._whitelist.add(filter);
    else
      this._blocking.add(filter);

    this._resultCache.clear();
  }

  /**
   * @see module:matcher.Matcher#remove
   * @param {module:filterClasses.Filter} filter
   */
  remove(filter)
  {
    if (filter.type == "whitelist")
      this._whitelist.remove(filter);
    else
      this._blocking.remove(filter);

    this._resultCache.clear();
  }

  /**
   * @see module:matcher.Matcher#findKeyword
   * @param {module:filterClasses.Filter} filter
   * @returns {string} keyword
   * @protected
   */
  findKeyword(filter)
  {
    if (filter.type == "whitelist")
      return this._whitelist.findKeyword(filter);
    return this._blocking.findKeyword(filter);
  }

  _matchInternal(url, typeMask, docDomain, sitekey, specificOnly)
  {
    let request = URLRequest.from(url, docDomain);
    let candidates = request.lowerCaseHref.match(/[a-z0-9%]{2,}|$/g);

    let whitelistHit = null;
    let blockingHit = null;

    // If the type mask includes no types other than whitelisting types, we
    // can skip the blocking filters.
    if ((typeMask & ~WHITELISTING_TYPES) != 0)
    {
      for (let i = 0, l = candidates.length; !blockingHit && i < l; i++)
      {
        if (isBadKeyword(candidates[i]))
          continue;

        blockingHit = this._blocking.checkEntryMatch(candidates[i], request,
                                                     typeMask, sitekey,
                                                     specificOnly);
      }
    }

    // If the type mask includes any whitelisting types, we need to check the
    // whitelist filters.
    if (blockingHit || (typeMask & WHITELISTING_TYPES) != 0)
    {
      for (let i = 0, l = candidates.length; !whitelistHit && i < l; i++)
      {
        if (isBadKeyword(candidates[i]))
          continue;

        whitelistHit = this._whitelist.checkEntryMatch(candidates[i], request,
                                                       typeMask, sitekey);
      }
    }

    return whitelistHit || blockingHit;
  }

  _searchInternal(url, typeMask, docDomain, sitekey, specificOnly, filterType)
  {
    let hits = {};

    let searchBlocking = filterType == "blocking" || filterType == "all";
    let searchWhitelist = filterType == "whitelist" || filterType == "all";

    if (searchBlocking)
      hits.blocking = [];

    if (searchWhitelist)
      hits.whitelist = [];

    // If the type mask includes no types other than whitelisting types, we
    // can skip the blocking filters.
    if ((typeMask & ~WHITELISTING_TYPES) == 0)
      searchBlocking = false;

    let request = URLRequest.from(url, docDomain);
    let candidates = request.lowerCaseHref.match(/[a-z0-9%]{2,}|$/g);

    for (let i = 0, l = candidates.length; i < l; i++)
    {
      if (isBadKeyword(candidates[i]))
        continue;

      if (searchBlocking)
      {
        this._blocking.checkEntryMatch(candidates[i], request, typeMask,
                                       sitekey, specificOnly, hits.blocking);
      }

      if (searchWhitelist)
      {
        this._whitelist.checkEntryMatch(candidates[i], request, typeMask,
                                        sitekey, false, hits.whitelist);
      }
    }

    return hits;
  }

  /**
   * @see #match
   * @deprecated
   * @inheritdoc
   */
  matchesAny(url, typeMask, docDomain, sitekey, specificOnly)
  {
    return this.match(url, typeMask, docDomain, sitekey, specificOnly);
  }

  /**
   * @see module:matcher.Matcher#match
   * @inheritdoc
   */
  match(url, typeMask, docDomain, sitekey, specificOnly)
  {
    let key = url.href + " " + typeMask + " " + docDomain + " " + sitekey +
              " " + specificOnly;

    let result = this._resultCache.get(key);
    if (typeof result != "undefined")
      return result;

    result = this._matchInternal(url, typeMask, docDomain, sitekey,
                                 specificOnly);

    this._resultCache.set(key, result);

    return result;
  }

  /**
   * @typedef {object} MatcherSearchResults
   * @property {Array.<module:filterClasses.BlockingFilter>} [blocking] List of
   *   blocking filters found.
   * @property {Array.<module:filterClasses.WhitelistFilter>} [whitelist] List
   *   of whitelist filters found.
   */

  /**
   * Searches all blocking and whitelist filters and returns results matching
   * the given parameters.
   *
   * @param {URL|module:url~URLInfo} url
   * @param {number} typeMask
   * @param {?string} [docDomain]
   * @param {?string} [sitekey]
   * @param {boolean} [specificOnly]
   * @param {string} [filterType] The types of filters to look for. This can be
   *   `"blocking"`, `"whitelist"`, or `"all"` (default).
   *
   * @returns {MatcherSearchResults}
   */
  search(url, typeMask, docDomain, sitekey, specificOnly, filterType = "all")
  {
    let key = "* " + url.href + " " + typeMask + " " + docDomain + " " +
              sitekey + " " + specificOnly + " " + filterType;

    let result = this._resultCache.get(key);
    if (typeof result != "undefined")
      return result;

    result = this._searchInternal(url, typeMask, docDomain, sitekey,
                                  specificOnly, filterType);

    this._resultCache.set(key, result);

    return result;
  }

  /**
   * Tests whether the URL is whitelisted
   * @see module:matcher.Matcher#match
   * @inheritdoc
   * @returns {boolean}
   */
  isWhitelisted(url, typeMask, docDomain, sitekey)
  {
    return !!this._whitelist.match(url, typeMask, docDomain, sitekey);
  }
};

/**
 * Shared `{@link module:matcher.CombinedMatcher CombinedMatcher}` instance
 * that should usually be used.
 * @type {module:matcher.CombinedMatcher}
 */
exports.defaultMatcher = new CombinedMatcher();
