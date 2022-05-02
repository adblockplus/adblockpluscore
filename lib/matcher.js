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
 * @file Matcher class implementing matching addresses against
 *               a list of filters.
 */

const {RESOURCE_TYPES, SPECIAL_TYPES, ALLOWING_TYPES,
       enumerateTypes} = require("./contentTypes");
const {compilePatterns} = require("./patterns");
const {domainSuffixes, URLRequest} = require("./url");
const {Filter} = require("./filterClasses");
const {FiltersByDomain, FilterMap} = require("./filtersByDomain");
const {Cache} = require("./caching");

/**
 * Returns the amount of filters per map.
 * @param {Map} map
 * @param {string} keyword
 * @returns {number}
 */
let countFilters = (map, keyword) => {
  let list = map.get(keyword);
  if (!list)
    return 0;
  if (list instanceof Filter)
    return 1;
  return list.length;
};

/**
 * Returns a list of filters, if any, or an empty list.
 * @param {Map} map
 * @param {string} keyword
 * @returns {Array.<module:filterClasses.URLFilter>}
 */
let getFilters = (map, keyword) => {
  let list = map.get(keyword);
  if (!list)
    return Array.prototype;
  if (list instanceof Filter)
    return [list];
  return list;
};

/**
 * Checks if the keyword is bad for use.
 * @param {string} keyword
 * @returns {boolean}
 */
function isBadKeyword(keyword) {
  return keyword == "https" || keyword == "http" || keyword == "com" ||
         keyword == "js";
}

/**
 * Adds a filter by a given keyword to a map.
 * @param {module:filterClasses.URLFilter} filter
 * @param {string} keyword
 * @param {Map.<string,(module:filterClasses.URLFilter|
 *                      Array.<module:filterClasses.URLFilter>)>} map
 */
function addFilterByKeyword(filter, keyword, map) {
  // this dance is to avoid storing arrays for single filters
  let list = map.get(keyword);
  // when the keyword is known, promote as array if needed
  if (list) {
    if (list instanceof Filter)
      map.set(keyword, [list, filter]);
    else
      list.push(filter);
  }
  else {
    // store just the filter without the Array
    map.set(keyword, filter);
  }
}

/**
 * Removes a filter by a given keyword from a map.
 * @param {module:filterClasses.URLFilter} filter
 * @param {string} keyword
 * @param {Map.<string,(module:filterClasses.URLFilter|
 *                      Array.<module:filterClasses.URLFilter>)>} map
 */
function removeFilterByKeyword(filter, keyword, map) {
  // this dance is to normalize back the keyword entry, if any
  let list = map.get(keyword);
  if (list) {
    // when the value is a filter, remove the keyword if filter matches
    if (list instanceof Filter) {
      if (list == filter)
        map.delete(keyword);
    }
    // otherwise find the index and drop the array if the list has 1 item
    else {
      let i = list.findIndex(item => item === filter);
      if (i >= 0) {
        list.splice(i, 1);
        if (list.length === 1)
          map.set(keyword, list[0]);
      }
    }
  }
}

/**
 * Checks whether a filter matches a given URL request.
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
function matchFilter(filter, request, typeMask, sitekey, collection) {
  if (filter.matches(request, typeMask, sitekey)) {
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
exports.isSlowFilter = function isSlowFilter(filter) {
  return !filter.urlPattern.hasKeywords();
};

let Matcher =
/**
 * Blocking/allowing filter matching
 */
exports.Matcher = class Matcher {
  constructor() {
    /**
     * Lookup table for keywords by their associated filter
     * @type {Map.<module:filterClasses.URLFilter,string>}
     * @private
     */
    this._keywordByFilter = new Map();

    /**
     * Lookup table for simple filters by their associated keyword
     * @type {Map.<string,(module:filterClasses.URLFilter|
     *                     Array.<module:filterClasses.URLFilter>)>}
     * @private
     */
    this._simpleFiltersByKeyword = new Map();

    /**
     * Lookup table for complex filters by their associated keyword
     * @type {Map.<string,(module:filterClasses.URLFilter|
     *                     Array.<module:filterClasses.URLFilter>)>}
     * @private
     */
    this._complexFiltersByKeyword = new Map();

    /**
     * Lookup table of compiled patterns for simple filters by their associated
     * keyword
     * @type {Map.<string,?module:patterns~CompiledPatterns>}
     * @private
     */
    this._compiledPatternsByKeyword = new Map();

    /**
     * Compiled patterns for generic complex filters with no associated
     * keyword.
     * @type {?module:patterns~CompiledPatterns|boolean}
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
     *                   Array.<module:filterClasses.URLFilter>)>>}
     * @private
     */
    this._filterMapsByType = new Map();
  }

  /**
   * Removes all known filters
   */
  clear() {
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
  add(filter) {
    if (this._keywordByFilter.has(filter))
      return;

    // Look for a suitable keyword
    let keyword = this.findKeyword(filter);
    let simple = filter.contentType == RESOURCE_TYPES && filter.isGeneric();

    addFilterByKeyword(filter, keyword, simple ? this._simpleFiltersByKeyword :
        this._complexFiltersByKeyword);

    this._keywordByFilter.set(filter, keyword);

    if (simple) {
      if (this._compiledPatternsByKeyword.size > 0)
        this._compiledPatternsByKeyword.delete(keyword);

      return;
    }

    if (keyword == "")
      this._keywordlessCompiledPatterns = false;

    for (let type of enumerateTypes(filter.contentType, SPECIAL_TYPES)) {
      let map = this._filterMapsByType.get(type);
      if (!map)
        this._filterMapsByType.set(type, map = new Map());

      addFilterByKeyword(filter, keyword, map);
    }

    let {domains} = filter;

    let filtersByDomain = this._filterDomainMapsByKeyword.get(keyword);
    if (!filtersByDomain) {
      // In most cases, there is only one pure generic filter to a keyword.
      // Instead of Map { "foo" => Map { "" => Map { filter => true } } }, we
      // can just reduce it to Map { "foo" => filter } and save a lot of
      // memory.
      if (!domains) {
        this._filterDomainMapsByKeyword.set(keyword, filter);
        return;
      }

      filtersByDomain = new FiltersByDomain();
      this._filterDomainMapsByKeyword.set(keyword, filtersByDomain);
    }
    else if (!(filtersByDomain instanceof FiltersByDomain)) {
      filtersByDomain = new FiltersByDomain([["", filtersByDomain]]);
      this._filterDomainMapsByKeyword.set(keyword, filtersByDomain);
    }

    filtersByDomain.add(filter, domains);
  }

  /**
   * Removes a filter from the matcher
   * @param {module:filterClasses.URLFilter} filter
   */
  remove(filter) {
    let keyword = this._keywordByFilter.get(filter);
    if (typeof keyword == "undefined")
      return;

    let simple = filter.contentType == RESOURCE_TYPES && filter.isGeneric();

    removeFilterByKeyword(
      filter,
      keyword,
      simple ?
        this._simpleFiltersByKeyword :
        this._complexFiltersByKeyword
    );

    this._keywordByFilter.delete(filter);

    if (simple) {
      if (this._compiledPatternsByKeyword.size > 0)
        this._compiledPatternsByKeyword.delete(keyword);

      return;
    }

    if (keyword == "")
      this._keywordlessCompiledPatterns = false;

    for (let type of enumerateTypes(filter.contentType, SPECIAL_TYPES)) {
      let map = this._filterMapsByType.get(type);
      if (map)
        removeFilterByKeyword(filter, keyword, map);
    }

    let filtersByDomain = this._filterDomainMapsByKeyword.get(keyword);
    if (filtersByDomain) {
      // Because of the memory optimization in the add function, most of the
      // time this will be a filter rather than a map.
      if (!(filtersByDomain instanceof FiltersByDomain)) {
        this._filterDomainMapsByKeyword.delete(keyword);
        return;
      }

      filtersByDomain.remove(filter);

      if (filtersByDomain.size == 0) {
        this._filterDomainMapsByKeyword.delete(keyword);
      }
      else if (filtersByDomain.size == 1) {
        for (let [lastDomain, map] of filtersByDomain.entries()) {
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
   * Checks whether a filter exists in the matcher
   * @param {module:filterClasses.URLFilter} filter
   * @returns {boolean}
   */
  has(filter) {
    return this._keywordByFilter.has(filter);
  }

  /**
   * Chooses a keyword to be associated with the filter.
   *
   * Because it will perform some internal optimizations, there is no
   * guarantee that this function will always return the same result when
   * called with the same filter.
   *
   * @param {module:filterClasses.Filter} filter
   * @returns {string} keyword or an empty string if no keyword could be found
   * @protected
   */
  findKeyword(filter) {
    let result = "";

    let candidates = filter.urlPattern.keywordCandidates();
    if (!candidates)
      return result;

    let resultCount = 0xFFFFFF;
    let resultLength = 0;

    for (let i = 0, l = candidates.length; i < l; i++) {
      let candidate = candidates[i].substring(1);

      if (isBadKeyword(candidate))
        continue;

      let simpleCount = countFilters(this._simpleFiltersByKeyword, candidate);
      let complexCount = countFilters(this._complexFiltersByKeyword,
                                      candidate);

      let count = simpleCount + complexCount;

      if (count < resultCount ||
          (count == resultCount && candidate.length > resultLength)) {
        result = candidate;
        resultCount = count;
        resultLength = candidate.length;
      }
    }

    return result;
  }

  _matchFiltersByDomain(filtersByDomain, request, typeMask, sitekey,
                        specificOnly, collection) {
    let excluded = null;

    let domain = request.documentHostname || "";
    for (let suffix of domainSuffixes(domain, !specificOnly)) {
      let map = filtersByDomain.get(suffix);
      if (map) {
        if (map instanceof FilterMap) {
          for (let [filter, include] of map.entries()) {
            if (!include) {
              if (excluded)
                excluded.add(filter);
              else
                excluded = new Set([filter]);
            }
            else if (
              (!excluded || !excluded.has(filter)) &&
              matchFilter(filter, request, typeMask, sitekey, collection)
            ) {
              return filter;
            }
          }
        }
        else if ((!excluded || !excluded.has(map)) &&
                 matchFilter(map, request, typeMask, sitekey, collection)) {
          return map;
        }
      }
    }

    return null;
  }

  _checkEntryMatchSimpleQuickCheck(keyword, request, filters) {
    let compiled = this._compiledPatternsByKeyword.get(keyword);
    if (typeof compiled == "undefined") {
      compiled = compilePatterns(filters);
      this._compiledPatternsByKeyword.set(keyword, compiled);
    }

    // If compilation failed (e.g. too many filters), return true because this
    // is only a pre-check.
    return !compiled || compiled.test(request);
  }

  _checkEntryMatchSimple(keyword, request, collection) {
    let filters = getFilters(this._simpleFiltersByKeyword, keyword);
    let {length} = filters;
    if (length) {
      // For simple filters where there's more than one filter to the keyword,
      // we do a quick check using a single compiled pattern that combines all
      // the patterns. This is a lot faster for requests that are not going to
      // be blocked (i.e. most requests).
      if (length === 1 ||
          this._checkEntryMatchSimpleQuickCheck(keyword, request, filters)) {
        for (let filter of filters) {
          // Simple filters match any resource type.
          if (matchFilter(filter, request, RESOURCE_TYPES, null, collection))
            return filter;
        }
      }
    }

    return null;
  }

  _checkEntryMatchForType(keyword, request, typeMask, sitekey, specificOnly,
                          collection) {
    let filtersForType = this._filterMapsByType.get(typeMask);
    if (filtersForType) {
      for (let filter of getFilters(filtersForType, keyword)) {
        if (specificOnly && filter.isGeneric())
          continue;

        if (matchFilter(filter, request, typeMask, sitekey, collection))
          return filter;
      }
    }

    return null;
  }

  _checkEntryMatchByDomain(keyword, request, typeMask, sitekey, specificOnly,
                           collection) {
    let filtersByDomain = this._filterDomainMapsByKeyword.get(keyword);
    if (filtersByDomain) {
      if (filtersByDomain instanceof FiltersByDomain) {
        if (keyword == "" && !specificOnly) {
          let compiled = this._keywordlessCompiledPatterns;

          // If the value is false, it indicates that we need to initialize it
          // to either a CompiledPatterns object or null.
          if (compiled == false) {
            // Compile all the patterns from the generic filters into a single
            // object. It is worth doing this for the keywordless generic
            // complex filters because they must be checked against every
            // single URL request that has not already been blocked by one of
            // the simple filters (i.e. most URL requests).
            let map = filtersByDomain.get("");
            if (map instanceof FilterMap)
              compiled = compilePatterns([...map.keys()]);

            this._keywordlessCompiledPatterns = compiled || null;
          }

          // We can skip the generic filters if none of them pass the test.
          if (compiled && !compiled.test(request))
            specificOnly = true;
        }

        return this._matchFiltersByDomain(
          filtersByDomain, request, typeMask, sitekey, specificOnly, collection
        );
      }

      // Because of the memory optimization in the add function, most of the
      // time this will be a filter rather than a map.

      // Also see #7312: If it's a single filter, it's always the equivalent of
      // Map { "" => Map { filter => true } } (i.e. applies to any domain). If
      // the specific-only flag is set, we skip it.
      if (!specificOnly) {
        return matchFilter(
          filtersByDomain, request, typeMask, sitekey, collection
        );
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
                  collection) {
    // We need to skip the simple (location-only) filters if the type mask does
    // not contain any resource types.
    if (!specificOnly && (typeMask & RESOURCE_TYPES) != 0) {
      let filter = this._checkEntryMatchSimple(keyword, request, collection);
      if (filter)
        return filter;
    }

    // If the type mask contains a special type (first condition) and it is
    // the only type in the mask (second condition), we can use the
    // type-specific map, which typically contains a lot fewer filters. This
    // enables faster lookups for allowing types like $document, $elemhide,
    // and so on, as well as other special types like $csp.
    if ((typeMask & SPECIAL_TYPES) != 0 && (typeMask & typeMask - 1) == 0) {
      return this._checkEntryMatchForType(
        keyword, request, typeMask, sitekey, specificOnly, collection
      );
    }


    return this._checkEntryMatchByDomain(
      keyword, request, typeMask, sitekey, specificOnly, collection
    );
  }

  /**
   * @see #match
   * @deprecated
   * @inheritdoc
   */
  matchesAny(url, typeMask, docDomain, sitekey, specificOnly) {
    return this.match(url, typeMask, docDomain, sitekey, specificOnly);
  }

  /**
   * Tests whether the URL matches any of the known filters
   * @param {URL|module:url~URLInfo|string} url
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
  match(url, typeMask, docDomain, sitekey, specificOnly) {
    let request = URLRequest.from(url, docDomain);
    let candidates = request.lowerCaseHref.match(/[a-z0-9%]{2,}|$/g);

    for (let i = 0, l = candidates.length; i < l; i++) {
      if (isBadKeyword(candidates[i]))
        continue;

      let result = this.checkEntryMatch(
        candidates[i], request, typeMask, sitekey, specificOnly
      );
      if (result)
        return result;
    }

    return null;
  }
};

class CombinedMatcher {
  constructor() {
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
    this._allowing = new Matcher();

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
  clear() {
    this._blocking.clear();
    this._allowing.clear();
    this._resultCache.clear();
  }

  /**
   * @see module:matcher.Matcher#add
   * @param {module:filterClasses.Filter} filter
   */
  add(filter) {
    if (filter.type == "allowing")
      this._allowing.add(filter);
    else
      this._blocking.add(filter);

    this._resultCache.clear();
  }

  /**
   * @see module:matcher.Matcher#remove
   * @param {module:filterClasses.Filter} filter
   */
  remove(filter) {
    if (filter.type == "allowing")
      this._allowing.remove(filter);
    else
      this._blocking.remove(filter);

    this._resultCache.clear();
  }

  /**
   * @see module:matcher.Matcher#has
   * @param {module:filterClasses.Filter} filter
   * @returns {boolean}
   */
  has(filter) {
    if (filter.type == "allowing")
      return this._allowing.has(filter);
    return this._blocking.has(filter);
  }

  /**
   * @see module:matcher.Matcher#findKeyword
   * @param {module:filterClasses.Filter} filter
   * @returns {string} keyword
   * @protected
   */
  findKeyword(filter) {
    if (filter.type == "allowing")
      return this._allowing.findKeyword(filter);
    return this._blocking.findKeyword(filter);
  }

  _matchInternal(url, typeMask, docDomain, sitekey, specificOnly,
                 exhaustiveSearch) {
    let request = URLRequest.from(url, docDomain);
    let candidates = request.lowerCaseHref.match(/[a-z0-9%]{2,}|$/g)
        .filter(candidate => !isBadKeyword(candidate));
    let typeIsOnlyAllowing = (typeMask & ~ALLOWING_TYPES) == 0;

    let allowingHit = null;
    let blockingHit = null;

    let findAllowing = () => {
      for (let i = 0, l = candidates.length; !allowingHit && i < l; i++) {
        allowingHit = this._allowing.checkEntryMatch(
          candidates[i], request, typeMask, sitekey
        );
      }
    };

    let findBlocking = () => {
      for (let i = 0, l = candidates.length; !blockingHit && i < l; i++) {
        blockingHit = this._blocking.checkEntryMatch(
          candidates[i], request, typeMask, sitekey, specificOnly
        );
      }
    };

    if (exhaustiveSearch) {
      findAllowing();
      if (!allowingHit && !typeIsOnlyAllowing)
        findBlocking();
    }
    else if (typeIsOnlyAllowing) {
      findAllowing();
    }
    else {
      findBlocking();
      if (blockingHit)
        findAllowing();
    }

    return allowingHit || blockingHit;
  }

  _searchInternal(url, typeMask, docDomain, sitekey, specificOnly, filterType) {
    let hits = {};

    let searchBlocking = filterType == "blocking" || filterType == "all";
    let searchAllowing = filterType == "allowing" || filterType == "all";

    if (searchBlocking)
      hits.blocking = [];

    if (searchAllowing)
      hits.allowing = [];

    // If the type mask includes no types other than allowing types, we
    // can skip the blocking filters.
    if ((typeMask & ~ALLOWING_TYPES) == 0)
      searchBlocking = false;

    let request = URLRequest.from(url, docDomain);
    let candidates = request.lowerCaseHref.match(/[a-z0-9%]{2,}|$/g);

    for (let i = 0, l = candidates.length; i < l; i++) {
      if (isBadKeyword(candidates[i]))
        continue;

      if (searchBlocking) {
        this._blocking.checkEntryMatch(
          candidates[i],
          request,
          typeMask,
          sitekey,
          specificOnly,
          hits.blocking
        );
      }


      if (searchAllowing) {
        this._allowing.checkEntryMatch(
          candidates[i], request, typeMask, sitekey, false, hits.allowing
        );
      }
    }

    return hits;
  }

  /**
   * @see #match
   * @deprecated
   * @inheritdoc
   */
  matchesAny(url, typeMask, docDomain, sitekey, specificOnly) {
    return this.match(url, typeMask, docDomain, sitekey, specificOnly);
  }

  /**
   * Tests whether the URL matches any of the known filters
   *
   * If both a blocking and an allowing filter matches, the allowing filter is
   * prioritized.
   *
   * If only an allowing filter matches, then the allowing filter will not be
   * returned unless it is one of the `{@link module:contentTypes.ALLOWING_TYPES
   * ALLOWING_TYPES}` used for exception rules only, or if `exhaustiveSearch` is
   * true. In other words, the allowing filter is only returned if it is
   * expected to change blocking behaviour.
   *
   * @param {URL|module:url~URLInfo|string} url
   *   URL to be tested
   * @param {number} typeMask
   *   bitmask of content / request types to match
   * @param {?string} [docDomain]
   *   domain name of the document that loads the URL
   * @param {?string} [sitekey]
   *   public key provided by the document
   * @param {boolean} [specificOnly]
   *   should be `true` if generic matches should be ignored
   * @param {boolean} [exhaustiveSearch=false]
   *   should return a matched allowing filter, even if the filter will have no
   *   effect on blocking behaviour
   * @returns {?module:filterClasses.URLFilter}
   *   matching filter or `null`
   */
  match(url, typeMask, docDomain, sitekey, specificOnly,
        exhaustiveSearch = false) {
    let key = `${url} ${typeMask} ${docDomain} ${sitekey} ${specificOnly} ${exhaustiveSearch}`;
    let result = this._resultCache.get(key);
    if (typeof result != "undefined")
      return result;

    result = this._matchInternal(
      url, typeMask, docDomain, sitekey, specificOnly, exhaustiveSearch
    );

    this._resultCache.set(key, result);

    return result;
  }

  /**
   * @typedef {Object} MatcherSearchResults
   * @property {Array.<module:filterClasses.BlockingFilter>} [blocking] List of
   *   blocking filters found.
   * @property {Array.<module:filterClasses.AllowingFilter>} [allowing] List
   *   of allowing filters found.
   */

  /**
   * Searches all blocking and allowing filters and returns results matching
   * the given parameters.
   *
   * @param {URL|module:url~URLInfo|string} url
   * @param {number} typeMask
   * @param {?string} [docDomain]
   * @param {?string} [sitekey]
   * @param {boolean} [specificOnly]
   * @param {string} [filterType] The types of filters to look for. This can be
   *   `"blocking"`, `"allowing"`, or `"all"` (default).
   *
   * @returns {MatcherSearchResults}
   */
  search(url, typeMask, docDomain, sitekey, specificOnly, filterType = "all") {
    let key = `* ${url} ${typeMask} ${docDomain} ${sitekey} ` +
              `${specificOnly} ${filterType}`;

    let result = this._resultCache.get(key);
    if (typeof result != "undefined")
      return result;

    result = this._searchInternal(
      url, typeMask, docDomain, sitekey, specificOnly, filterType
    );

    this._resultCache.set(key, result);

    return result;
  }

  /**
   * Tests whether the URL is allowlisted
   * @see module:matcher.Matcher#match
   * @inheritdoc
   * @returns {boolean}
   */
  isAllowlisted(url, typeMask, docDomain, sitekey) {
    return !!this._allowing.match(url, typeMask, docDomain, sitekey);
  }
}

/**
 * Combines a matcher for blocking and exception rules, automatically sorts
 * rules into two `{@link module:matcher.Matcher Matcher}` instances.
 */
exports.CombinedMatcher = CombinedMatcher;

/**
 * Create the `{@link module:matcher~CombinedMatcher CombinedMatcher}`
 * instance that should usually be used.
 * @returns {module:matcher.CombinedMatcher}
 */
exports.newDefaultMatcher = function() {
  return new CombinedMatcher();
};
