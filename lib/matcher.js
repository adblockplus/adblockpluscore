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
 * Bitmask for "types" that are for exception rules only, like
 * <code>$document</code>, <code>$elemhide</code>, and so on.
 * @type {number}
 */
const WHITELIST_ONLY_TYPES = RegExpFilter.typeMap.DOCUMENT |
                             RegExpFilter.typeMap.ELEMHIDE |
                             RegExpFilter.typeMap.GENERICHIDE |
                             RegExpFilter.typeMap.GENERICBLOCK;

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
     * Lookup table for filters by their associated keyword
     * @type {Map.<string,(Filter|Set.<Filter>)>}
     * @private
     */
    this._filterByKeyword = new Map();
  }

  /**
   * Removes all known filters
   */
  clear()
  {
    this._filterByKeyword.clear();
  }

  /**
   * Adds a filter to the matcher
   * @param {RegExpFilter} filter
   */
  add(filter)
  {
    // Look for a suitable keyword
    let keyword = this.findKeyword(filter);
    let set = this._filterByKeyword.get(keyword);
    if (typeof set == "undefined")
    {
      this._filterByKeyword.set(keyword, filter);
    }
    else if (set.size == 1)
    {
      if (filter != set)
        this._filterByKeyword.set(keyword, new Set([set, filter]));
    }
    else
    {
      set.add(filter);
    }
  }

  /**
   * Removes a filter from the matcher
   * @param {RegExpFilter} filter
   */
  remove(filter)
  {
    let keyword = this.findKeyword(filter);
    let set = this._filterByKeyword.get(keyword);
    if (typeof set == "undefined")
      return;

    if (set.size == 1)
    {
      if (filter == set)
        this._filterByKeyword.delete(keyword);
    }
    else
    {
      set.delete(filter);

      if (set.size == 1)
        this._filterByKeyword.set(keyword, [...set][0]);
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

    let hash = this._filterByKeyword;
    let resultCount = 0xFFFFFF;
    let resultLength = 0;
    for (let i = 0, l = candidates.length; i < l; i++)
    {
      let candidate = candidates[i].substr(1);
      let filters = hash.get(candidate);
      let count = typeof filters != "undefined" ? filters.size : 0;
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

  /**
   * Checks whether the entries for a particular keyword match a URL
   * @param {string} keyword
   * @param {string} location
   * @param {number} typeMask
   * @param {string} [docDomain]
   * @param {boolean} [thirdParty]
   * @param {string} [sitekey]
   * @param {boolean} [specificOnly]
   * @returns {?Filter}
   * @protected
   */
  checkEntryMatch(keyword, location, typeMask, docDomain, thirdParty, sitekey,
                  specificOnly)
  {
    let set = this._filterByKeyword.get(keyword);
    if (typeof set == "undefined")
      return null;

    for (let filter of set)
    {
      if (specificOnly && filter.isGeneric() &&
          !(filter instanceof WhitelistFilter))
        continue;

      if (filter.matches(location, typeMask, docDomain, thirdParty, sitekey))
        return filter;
    }
    return null;
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
    this.maxCacheEntries = 1000;

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
}

exports.CombinedMatcher = CombinedMatcher;

/**
 * Shared {@link CombinedMatcher} instance that should usually be used.
 * @type {CombinedMatcher}
 */
let defaultMatcher = new CombinedMatcher();

exports.defaultMatcher = defaultMatcher;
