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
 * @file Definition of Filter class and its subclasses.
 */

const {
  contentTypes, RESOURCE_TYPES, CONTEXT_TYPES
} = require("./contentTypes");
const {CONTENT_FILTER} = require("./filters");
const {Pattern} = require("./patterns");
const {parseDomains, domainSuffixes} = require("./url");
const {filterState} = require("./filterState");
const {parse, FilterParsingError} = require("./filters");

const {resources} = require("../data/resources.js");

const MIN_GENERIC_CONTENT_FILTER_BODY_LENGTH = 3;

/**
 * @typedef {Object} HttpHeader
 * @property {string} name
 * @property {?string} value
 */

/**
 * Map of internal resources for URL rewriting.
 * @type {Map.<string,string>}
 */
let resourceMap = new Map(
  Object.keys(resources).map(key => [key, resources[key]])
);

let isActiveFilter =
/**
 * Checks whether the given filter is an active filter.
 *
 * Filters of type `blocking`, `allowing`, `elemhide`, `elemhideexception`,
 * `elemhideemulation`, and `snippet` are considered active; filters of type
 * `invalid` and `comment` are not considered active.
 *
 * @param {?Filter} filter The filter.
 *
 * @returns {boolean} Whether the filter is active.
 */
exports.isActiveFilter = function isActiveFilter(filter) {
  return filter instanceof ActiveFilter;
};

let Filter =
/**
 * Abstract base class for filters
 */
exports.Filter = class Filter {
  /**
   * @param {string} text   string representation of the filter
   */
  constructor(text) {
    this.text = text;
  }

  /**
   * Filter type as a string, e.g. "blocking".
   *
   * Can be `blocking`, `allowing`, `elemhide`, `elemhideexception`,
   * `elemhideemulation`, `snippet`, `comment` or `invalid`.
   *
   * @type {string}
   */
  get type() {
    throw new Error("Please define filter type in the subclass");
  }

  /**
   * True if filter should only be loaded if it comes from a
   * privileged subscription (circumvention subscriptions or special
   * subscriptions).
   * @type {bool}
   */
  get requiresPrivilegedSubscription() {
    return false;
  }

  /**
   * Serializes the filter for writing out on disk.
   * @yields {string}
   */
  *serialize() {
    let {text} = this;

    yield "[Filter]";
    yield "text=" + text;
  }

  toString() {
    return this.text;
  }
};

/**
 * Cache for known filters, maps string representation to filter objects.
 * @type {Map.<string, module:filterClasses.Filter>}
 */
let knownFilters = new Map();

/**
 * Creates a filter of correct type from its text representation - does the
 * basic parsing and calls the right constructor then.
 *
 * @param {string} text   as in Filter()\
 * @return {module:filterClasses.Filter}
 */
exports.Filter.fromText = function(text) {
  let filter = knownFilters.get(text);
  if (filter)
    return filter;

  if (text.length === 0) {
    filter = new InvalidFilter(text, "filter_empty");
  }
  else if (text[0] == "!") {
    filter = new CommentFilter(text);
  }
  else {
    let match = text.includes("#") ? CONTENT_FILTER.exec(text) : null;
    if (match)
      filter = ContentFilter.fromText(text, match[1], match[2], match[3]);
    else
      filter = URLFilter.fromText(text);
  }

  if (filter.type !== "invalid")
    knownFilters.set(filter.text, filter);

  return filter;
};

/**
 * Deserializes a filter
 *
 * @param {Object}  obj map of serialized properties and their values
 * @return {module:filterClasses.Filter} filter or null if the filter couldn't
 *   be created
 */
exports.Filter.fromObject = function(obj) {
  let filter = Filter.fromText(obj.text);
  if (isActiveFilter(filter))
    filterState.fromObject(filter.text, obj);
  return filter;
};

let {normalize} = require("./filters/index.js");
exports.Filter.normalize = normalize;

let InvalidFilter =
/**
 * Class for invalid filters
 * @extends module:filterClasses.Filter
 */
exports.InvalidFilter = class InvalidFilter extends Filter {
  /**
   * @param {string} text see {@link module:filterClasses.Filter Filter()}
   * @param {string} reason Reason why this filter is invalid
   * @param {string?} option The optional option passed to the filter
   * @private
   */
  constructor(text, reason, option = null) {
    super(text);

    this.reason = reason;
    this.option = option;
  }

  get type() {
    return "invalid";
  }

  *serialize() {}
};

let CommentFilter =
/**
 * Class for comments
 * @extends module:filterClasses.Filter
 */
exports.CommentFilter = class CommentFilter extends Filter {
  /**
   * @param {string} text see {@link module:filterClasses.Filter Filter()}
   * @private
   */
  constructor(text) {
    super(text);
  }

  get type() {
    return "comment";
  }

  *serialize() {}
};

let ActiveFilter =
/**
 * Abstract base class for filters that can get hits
 * @extends module:filterClasses.Filter
 */
exports.ActiveFilter = class ActiveFilter extends Filter {
  /**
   * @param {string} text
   *   see {@link module:filterClasses.Filter Filter()}
   * @param {string} [domains]
   *   Domains that the filter is restricted to separated by domainSeparator
   *   e.g. "foo.com|bar.com|~baz.com"
   * @private
   */
  constructor(text, domains) {
    super(text);

    /**
     * String that the domains property should be generated from
     * @type {?string}
     */
    this.domainSource = domains || null;

    this._domains = domains ? void 0 : null;
  }

  /**
   * Number of filters contained, will always be 1 (required to
   * optimize {@link module:matcher.Matcher Matcher}).
   * @type {number}
   */
  get size() {
    return 1;
  }

  /**
   * See Filter.serialize()
   * @inheritdoc
   */
  *serialize() {
    yield* filterState.serialize(this.text);
  }

  /**
   * Defines whether the filter is disabled globally.
   * @type {boolean}
   * @deprecated use
   * {@link module:filterClasses.ActiveFilter#isDisabledForSubscription} and
   * {@link module:filterClasses.ActiveFilter#setDisabledForSubscription} for
   * disabling and enabling filters for specific subscriptions.
   */
  get disabled() {
    return !filterState.isEnabled(this.text);
  }
  set disabled(value) {
    filterState.setEnabled(this.text, !value);
  }

  /**
   * Defines which subscriptions the filter is disabled for.
   * See {@link module:filterClasses.ActiveFilter#isDisabledForSubscription} and
   * {@link module:filterClasses.ActiveFilter#setDisabledForSubscription} for
   * disabling and enabling filters.
   * @type {Set<string>}
   */
  get disabledSubscriptions() {
    return filterState.disabledSubscriptions(this.text);
  }

  /**
   * Checks whether this filter is disabled.
   * @param {string} subscriptionUrl The subscription to check for
   * enabled / disabled state.
   * @return {boolean} true if the filter is disabled
   */
  isDisabledForSubscription(subscriptionUrl) {
    return filterState.isDisabledForSubscription(this.text, subscriptionUrl);
  }
  /**
   * Disables or enables the filter.
   * @param {string} [subscriptionUrl] The subscription on which to
   * disable / enable the filter.
   * @param {boolean} [value] new disabled value, true for disabled
   * and false for enabled
   */
  setDisabledForSubscription(subscriptionUrl, value) {
    filterState.setDisabledForSubscription(this.text, subscriptionUrl, value);
  }

  /**
   * Separator character used in domainSource property
   * @type {string}
   */
  get domainSeparator() {
    return ",";
  }

  /**
   * Number of hits on the filter since the last reset
   * @type {number}
   */
  get hitCount() {
    return filterState.getHitCount(this.text);
  }
  set hitCount(value) {
    filterState.setHitCount(this.text, value);
  }

  /**
   * Last time the filter had a hit (in milliseconds since the beginning of the
   * epoch)
   * @type {number}
   */
  get lastHit() {
    return filterState.getLastHit(this.text);
  }
  set lastHit(value) {
    filterState.setLastHit(this.text, value);
  }

  /**
   * Map containing domains that this filter should match on/not match
   * on or null if the filter should match on all domains
   * @type {?Map.<string,boolean>}
   */
  get domains() {
    if (typeof this._domains == "undefined") {
      let {domainSource: source, domainSeparator: sep} = this;
      this._domains = parseDomains(source.toLowerCase(), sep);
    }
    return this._domains;
  }

  /**
   * Array containing public keys of websites that this filter should apply to
   * @type {?Array.<string>}
   */
  get sitekeys() {
    return null;
  }

  /**
   * String that the sitekey property should be generated from
   * @type {?string}
   */
  get sitekeySource() {
    return null;
  }

  /**
   * Checks whether this filter is active on a domain.
   * @param {?string} [docDomain] domain name of the document that loads the URL
   * @param {string} [sitekey] public key provided by the document
   * @return {boolean} true in case of the filter being active
   */
  isActiveOnDomain(docDomain, sitekey) {
    // Sitekeys are case-sensitive so we shouldn't convert them to
    // upper-case to avoid false positives here. Instead we need to
    // change the way filter options are parsed.
    if (this.sitekeys &&
        (!sitekey || !this.sitekeys.includes(sitekey)))
      return false;

    let {domains} = this;

    // If no domains are set the rule matches everywhere
    if (!domains)
      return true;

    if (docDomain == null)
      docDomain = "";
    else if (docDomain[docDomain.length - 1] == ".")
      docDomain = docDomain.substring(0, docDomain.length - 1);

    // If the document has no host name, match only if the filter
    // isn't restricted to specific domains
    if (!docDomain)
      return domains.get("");

    for (docDomain of domainSuffixes(docDomain)) {
      let isDomainIncluded = domains.get(docDomain);
      if (typeof isDomainIncluded != "undefined")
        return isDomainIncluded;
    }

    return domains.get("");
  }

  /**
   * Checks whether this filter is active only on a domain and its subdomains.
   * @param {?string} [docDomain]
   * @return {boolean}
   */
  isActiveOnlyOnDomain(docDomain) {
    let {domains} = this;

    if (!domains || domains.get(""))
      return false;

    if (docDomain == null)
      docDomain = "";
    else if (docDomain[docDomain.length - 1] == ".")
      docDomain = docDomain.substring(0, docDomain.length - 1);

    if (!docDomain)
      return false;

    for (let [domain, isIncluded] of domains) {
      if (isIncluded && domain != docDomain) {
        if (domain.length <= docDomain.length)
          return false;

        if (!domain.endsWith("." + docDomain))
          return false;
      }
    }

    return true;
  }

  /**
   * Checks whether this filter is generic or specific
   * @return {boolean}
   */
  isGeneric() {
    let {sitekeys, domains} = this;

    return !(sitekeys && sitekeys.length) && (!domains || domains.get(""));
  }

  /**
   * Yields the filter itself (required to optimize
   *   {@link module:matcher.Matcher Matcher}).
   * @yields {module:filterClasses.ActiveFilter}
   * @package
   */
  *[Symbol.iterator]() {
    yield this;
  }
};

let URLFilter =
/**
 * Abstract base class for URL filters
 * @extends module:filterClasses.ActiveFilter
 */
exports.URLFilter = class URLFilter extends ActiveFilter {
  /**
   * @param {string} text see {@link module:filterClasses.Filter Filter()}
   * @param {string} regexpSource
   *   filter part that the regular expression should be build from
   * @param {number} [contentType]
   *   Content types the filter applies to, combination of values from
   *   `{@link module:contentTypes.contentTypes}`
   * @param {boolean} [matchCase]
   *   Defines whether the filter should distinguish between lower and upper
   *   case letters
   * @param {string} [domains]
   *   Domains that the filter is restricted to, e.g. "foo.com|bar.com|~baz.com"
   * @param {boolean} [thirdParty]
   *   Defines whether the filter should apply to third-party or first-party
   *   content only
   * @param {string} [sitekeys]
   *   Public keys of websites that this filter should apply to
   * @param {?HttpHeader} [header]
   *   Header-based filtering.
   * @param {?string} [rewrite]
   *   The name of the internal resource to which to rewrite the
   *   URL. e.g. if the value of the `$rewrite` option is
   *   `abp-resource:blank-html`, this should be `blank-html`.
   *
   * @private
   */
  constructor(text, regexpSource, contentType, matchCase, domains, thirdParty,
              sitekeys, header, rewrite) {
    super(text, domains);

    this._sitekeySource = sitekeys == null ? null : sitekeys;
    this._sitekeys = sitekeys == null ? null : void 0;

    /**
     * Content types the filter applies to, combination of values from
     * `{@link module:contentTypes.contentTypes}`
     * @type {number}
     */
    this.contentType = contentType != null ? contentType : RESOURCE_TYPES;

    /**
     * Defines whether the filter should apply to third-party or
     * first-party content only. Can be null (apply to all content).
     * @type {?boolean}
     */
    this.thirdParty = thirdParty != null ? thirdParty : null;

    /**
     * Header-based filtering expression. Refer to the filter
     * documentation reference for the syntax, or
     * `{@link BlockingFilter.filterHeaders}` for the reference
     * implementation.
     * @type {?HttpHeader}
     */
    this.header = header != null ? header : null;

    /**
     * The name of the internal resource to which to rewrite the
     * URL. e.g. if the value of the `$rewrite` option is
     * `abp-resource:blank-html`, this should be `blank-html`.
     * @type {?string}
     */
    this.rewrite = rewrite != null ? rewrite : null;

    /**
     * Pattern for matching request URLs
     * @type {Pattern}
     */
    this.urlPattern = new Pattern(regexpSource, matchCase);
  }

  /**
   * Expression from which a regular expression should be generated -
   * for delayed creation of the regexp property.
   *
   * Undefined if the filter uses a regex literal pattern.
   * @type {?string}
   * @deprecated Use <code>filter.urlPattern.pattern</code>, or other
   * functions available on <code>{@link module:patterns.Pattern}</code>.
   */
  get pattern() {
    return this.urlPattern.pattern;
  }

  /**
   * Regular expression to be used when testing against this pattern
   * @type {RegExp}
   * @deprecated Use <code>filter.urlPattern.regexp</code>, or other
   * functions available on <code>{@link module:patterns.Pattern}</code>.
   */
  get regexp() {
    return this.urlPattern.regexp;
  }

  /**
   * Defines whether the filter should distinguish between lower and
   * upper case letters
   * @type {boolean}
   */
  get matchCase() {
    return this.urlPattern.matchCase;
  }

  /**
   * @see ActiveFilter.domainSeparator
   */
  get domainSeparator() {
    return "|";
  }

  /**
   * @see ActiveFilter.sitekeys
   */
  get sitekeys() {
    if (typeof this._sitekeys == "undefined")
      this._sitekeys = this._sitekeySource.split("|");

    return this._sitekeys;
  }

  /**
   * @see ActiveFilter.sitekeySource
   */
  get sitekeySource() {
    return this._sitekeySource;
  }

  /**
   * Tests whether the URL request matches this filter
   * @param {module:url.URLRequest} request URL request to be tested
   * @param {number} typeMask bitmask of content / request types to match
   * @param {?string} [sitekey] public key provided by the document
   * @return {boolean} true in case of a match
   */
  matches(request, typeMask, sitekey) {
    let contextMask = typeMask & CONTEXT_TYPES;
    let resourceMask = typeMask & ~CONTEXT_TYPES;
    return (this.contentType & resourceMask) != 0 &&
      (contextMask == 0 ?
       (this.contentType & CONTEXT_TYPES) == 0 :
       (this.contentType & contextMask) != 0
      ) &&
      (this.thirdParty == null || this.thirdParty == request.thirdParty) &&
      (this.urlPattern.regexp ?
       this.isActiveOnDomain(request.documentHostname, sitekey) &&
       this.urlPattern.matchesLocation(request) :
       this.urlPattern.matchesLocation(request) &&
       this.isActiveOnDomain(request.documentHostname, sitekey));
  }
};

/**
 * Creates a URL filter from its text representation
 *
 * @param {string} filterText   same as in Filter()
 * @return {module:filterClasses.Filter}
 */
exports.URLFilter.fromText = function(filterText) {
  let result = parse(filterText);

  if (result instanceof FilterParsingError) {
    let option = null;
    if (result.message == "filter_unknown_option" && result.detail)
      option = result.detail.option;
    return new InvalidFilter(filterText, result.message, option);
  }

  let {
    blocking,
    text,
    regexpSource,
    contentType,
    matchCase,
    domains,
    thirdParty,
    sitekeys,
    header,
    rewrite,
    csp
  } = result;

  try {
    if (blocking) {
      return new BlockingFilter(
        text,
        regexpSource,
        contentType,
        matchCase,
        domains,
        thirdParty,
        sitekeys,
        header,
        rewrite,
        csp
      );
    }
    return new AllowingFilter(
      text,
      regexpSource,
      contentType,
      matchCase,
      domains,
      thirdParty,
      sitekeys,
      header
    );
  }
  catch (e) {
    return new InvalidFilter(filterText, "filter_invalid_regexp");
  }
};

/**
 * @deprecated Use <code>{@link contentTypes}</code> instead.
 * @see contentTypes
 */
// For backwards compatibility.
URLFilter.typeMap = contentTypes;

let BlockingFilter =
/**
 * Class for blocking filters
 * @extends module:filterClasses.URLFilter
 */
exports.BlockingFilter = class BlockingFilter extends URLFilter {
  /**
   * @param {string} text see {@link module:filterClasses.Filter Filter()}
   * @param {string} regexpSource see
   *   {@link module:filterClasses.URLFilter URLFilter()}
   * @param {number} [contentType] see
   *   {@link module:filterClasses.URLFilter URLFilter()}
   * @param {boolean} [matchCase] see
   *   {@link module:filterClasses.URLFilter URLFilter()}
   * @param {string} [domains] see
   *   {@link module:filterClasses.URLFilter URLFilter()}
   * @param {boolean} [thirdParty] see
   *   {@link module:filterClasses.URLFilter URLFilter()}
   * @param {string} [sitekeys] see
   *   {@link module:filterClasses.URLFilter URLFilter()}
   * @param {?HttpHeader} [header] see
   *   {@link module:filterClasses.URLFilter URLFilter()}
   * @param {?string} [rewrite]
   *   The name of the internal resource to which to rewrite the
   *   URL. e.g. if the value of the `$rewrite` option is
   *   `abp-resource:blank-html`, this should be `blank-html`.
   * @param {?string} [csp]
   *   Content Security Policy to inject when the filter matches
   *
   * @private
   */
  constructor(text, regexpSource, contentType, matchCase, domains, thirdParty,
              sitekeys, header, rewrite, csp) {
    super(
      text,
      regexpSource,
      contentType,
      matchCase,
      domains,
      thirdParty,
      sitekeys,
      header,
      rewrite
    );

    /**
     * Content Security Policy to inject for matching requests.
     * @type {?string}
     */
    this.csp = csp != null ? csp : null;
  }

  get type() {
    return "blocking";
  }

  get requiresPrivilegedSubscription() {
    return (this.contentType & contentTypes.HEADER) != 0;
  }

  /**
   * Rewrites an URL.
   * @param {string} url the URL to rewrite
   * @return {string} the rewritten URL, or the original in case of failure
   */
  rewriteUrl(url) {
    return resourceMap.get(this.rewrite) || url;
  }

  /**
   * Filter headers.
   *
   * This function would be called by the request blocker code after
   * matching the request.
   *
   * @param {webRequest.HttpHeaders} headers the HTTP response headers
   *   to match, as they are returned by the request blocker. They
   *   follow the {@link webRequest API
   *   https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/HttpHeaders}.
   * @return {boolean} Whether the headers match. Will return true if
   *   there is nothing to match against, or if the header is present
   *   but no value.
   */
  filterHeaders(headers) {
    if (!this.header)
      return true;

    for (let header of headers) {
      if (header.name.toLowerCase() == this.header.name) {
        if (this.header.value) {
          if (header.value.includes(this.header.value))
            return true;
        }
        else {
          return true;
        }
      }
    }

    return false;
  }
};

let AllowingFilter =
/**
 * Class for allowing (allowlisting) filters
 * @extends module:filterClasses.URLFilter
 */
exports.AllowingFilter = class AllowingFilter extends URLFilter {
  get type() {
    return "allowing";
  }
};

let ContentFilter =
/**
 * Base class for content filters
 * @extends module:filterClasses.ActiveFilter
 */
exports.ContentFilter = class ContentFilter extends ActiveFilter {
  /**
   * @param {string} text see {@link module:filterClasses.Filter Filter()}
   * @param {string} [domains] Host names or domains the filter should be
   *                           restricted to
   * @param {string} body      The body of the filter or the script that should
   *                           be executed or the CSS selector for the HTML
   *                           elements that should be hidden
   *
   * @private
   */
  constructor(text, domains, body) {
    super(text, domains || null);

    this.body = body;
  }
};

/**
 * Creates a content filter from a pre-parsed text representation
 *
 * @param {string} text         same as in Filter()
 * @param {string} [domains]
 *   domains part of the text representation
 * @param {string} [type]
 *   rule type, either:
 *     * "" for an element hiding filter
 *     * "@" for an element hiding exception filter
 *     * "?" for an element hiding emulation filter
 *     * "$" for a snippet filter
 * @param {string} body
 *   body part of the text representation, either a CSS selector or a snippet
 *   script
 * @return {module:filterClasses.ElemHideFilter|
 *          module:filterClasses.ElemHideException|
 *          module:filterClasses.ElemHideEmulationFilter|
 *          module:filterClasses.SnippetFilter|
 *          module:filterClasses.InvalidFilter}
 */
exports.ContentFilter.fromText = function(text, domains, type, body) {
  // We don't allow content filters which have any empty domains.
  // Note: The ContentFilter.prototype.domainSeparator is duplicated here, if
  // that changes this must be changed too.
  if (domains && /(^|,)~?(,|$)/.test(domains))
    return new InvalidFilter(text, "filter_invalid_domain");

  let restrictedByDomain = /,[^~][^,.]*\.[^,]/.test("," + domains) ||
      ("," + domains + ",").includes(",localhost,");

  if (type == "?" || type == "$") {
    // Element hiding emulation and snippet filters are inefficient so we need
    // to make sure that they're only applied if they specify active domains
    if (!restrictedByDomain) {
      return new InvalidFilter(text, type == "?" ?
        "filter_elemhideemulation_nodomain" :
        "filter_snippet_nodomain");
    }

    if (type == "?")
      return new ElemHideEmulationFilter(text, domains, body);

    return new SnippetFilter(text, domains, body);
  }

  if (!restrictedByDomain &&
      body.length < MIN_GENERIC_CONTENT_FILTER_BODY_LENGTH)
    return new InvalidFilter(text, "filter_elemhide_not_specific_enough");

  if (type == "@")
    return new ElemHideException(text, domains, body);

  return new ElemHideFilter(text, domains, body);
};

let ElemHideBase =
/**
 * Base class for element hiding filters
 * @extends module:filterClasses.ContentFilter
 */
exports.ElemHideBase = class ElemHideBase extends ContentFilter {
  /**
   * CSS selector for the HTML elements that should be hidden
   * @type {string}
   */
  get selector() {
    return this.body;
  }
};

let ElemHideFilter =
/**
 * Class for element hiding filters
 * @extends module:filterClasses.ElemHideBase
 */
exports.ElemHideFilter = class ElemHideFilter extends ElemHideBase {
  /**
   * @param {string} text see {@link module:filterClasses.Filter Filter()}
   * @param {string} [domains]  see
   *   {@link module:filterClasses.ElemHideBase ElemHideBase()}
   * @param {string} selector see
   *   {@link module:filterClasses.ElemHideBase ElemHideBase()}
   *
   * @private
   */
  constructor(text, domains, selector) {
    super(text, domains, selector);
  }

  get type() {
    return "elemhide";
  }
};

let ElemHideException =
/**
 * Class for element hiding exceptions
 * @extends module:filterClasses.ElemHideBase
 */
exports.ElemHideException = class ElemHideException extends ElemHideBase {
  /**
   * @param {string} text see {@link module:filterClasses.Filter Filter()}
   * @param {string} [domains]  see
   *   {@link module:filterClasses.ElemHideBase ElemHideBase()}
   * @param {string} selector see
   *   {@link module:filterClasses.ElemHideBase ElemHideBase()}
   *
   * @private
   */
  constructor(text, domains, selector) {
    super(text, domains, selector);
  }

  get type() {
    return "elemhideexception";
  }
};

let ElemHideEmulationFilter =
/**
 * Class for element hiding emulation filters
 */
exports.ElemHideEmulationFilter =
class ElemHideEmulationFilter extends ElemHideBase {
  /**
   * @param {string} text    see {@link module:filterClasses.Filter Filter()}
   * @param {string} domains see
   *   {@link module:filterClasses.ElemHideBase ElemHideBase()}
   * @param {string} selector see
   *   {@link module:filterClasses.ElemHideBase ElemHideBase()}
   * @constructor
   * @extends module:filterClasses.ElemHideBase
   *
   * @private
   */
  constructor(text, domains, selector) {
    super(text, domains, selector);
  }

  get type() {
    return "elemhideemulation";
  }
};

let SnippetFilter =
/**
 * Class for snippet filters
 * @extends module:filterClasses.ContentFilter
 */
exports.SnippetFilter = class SnippetFilter extends ContentFilter {
  get type() {
    return "snippet";
  }
  get requiresPrivilegedSubscription() {
    return true;
  }

  /**
   * Script that should be executed
   * @type {string}
   */
  get script() {
    return this.body;
  }
};
