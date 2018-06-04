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
 * @fileOverview Definition of Filter class and its subclasses.
 */

const {FilterNotifier} = require("./filterNotifier");
const {extend} = require("./coreUtils");
const {filterToRegExp} = require("./common");

/**
 * Abstract base class for filters
 *
 * @param {string} text   string representation of the filter
 * @constructor
 */
function Filter(text)
{
  this.text = text;
  this.subscriptions = [];
}
exports.Filter = Filter;

Filter.prototype =
{
  /**
   * String representation of the filter
   * @type {string}
   */
  text: null,

  /**
   * Filter subscriptions the filter belongs to
   * @type {Subscription[]}
   */
  subscriptions: null,

  /**
   * Filter type as a string, e.g. "blocking".
   * @type {string}
   */
  get type()
  {
    throw new Error("Please define filter type in the subclass");
  },

  /**
   * Serializes the filter to an array of strings for writing out on the disk.
   * @param {string[]} buffer  buffer to push the serialization results into
   */
  serialize(buffer)
  {
    buffer.push("[Filter]");
    buffer.push("text=" + this.text);
  },

  toString()
  {
    return this.text;
  }
};

/**
 * Cache for known filters, maps string representation to filter objects.
 * @type {Map.<string,Filter>}
 */
Filter.knownFilters = new Map();

/**
 * Regular expression that element hiding filters should match
 * @type {RegExp}
 */
Filter.elemhideRegExp = /^([^/*|@"!]*?)#([@?])?#(.+)$/;
/**
 * Regular expression that RegExp filters specified as RegExps should match
 * @type {RegExp}
 */
Filter.regexpRegExp = /^(@@)?\/.*\/(?:\$~?[\w-]+(?:=[^,\s]+)?(?:,~?[\w-]+(?:=[^,\s]+)?)*)?$/;
/**
 * Regular expression that options on a RegExp filter should match
 * @type {RegExp}
 */
Filter.optionsRegExp = /\$(~?[\w-]+(?:=[^,]+)?(?:,~?[\w-]+(?:=[^,]+)?)*)$/;
/**
 * Regular expression that matches an invalid Content Security Policy
 * @type {RegExp}
 */
Filter.invalidCSPRegExp = /(;|^) ?(base-uri|referrer|report-to|report-uri|upgrade-insecure-requests)\b/i;

/**
 * Creates a filter of correct type from its text representation - does the
 * basic parsing and calls the right constructor then.
 *
 * @param {string} text   as in Filter()
 * @return {Filter}
 */
Filter.fromText = function(text)
{
  let filter = Filter.knownFilters.get(text);
  if (filter)
    return filter;

  let match = (text.includes("#") ? Filter.elemhideRegExp.exec(text) : null);
  if (match)
  {
    let propsMatch;
    if (!match[2] &&
        (propsMatch = /\[-abp-properties=(["'])([^"']+)\1\]/.exec(match[3])))
    {
      // This is legacy CSS properties syntax, convert to current syntax
      let prefix = match[3].substr(0, propsMatch.index);
      let expression = propsMatch[2];
      let suffix = match[3].substr(propsMatch.index + propsMatch[0].length);
      return Filter.fromText(`${match[1]}#?#` +
          `${prefix}:-abp-properties(${expression})${suffix}`);
    }

    filter = ElemHideBase.fromText(
      text, match[1], match[2], match[3]
    );
  }
  else if (text[0] == "!")
    filter = new CommentFilter(text);
  else
    filter = RegExpFilter.fromText(text);

  Filter.knownFilters.set(filter.text, filter);
  return filter;
};

/**
 * Deserializes a filter
 *
 * @param {Object}  obj map of serialized properties and their values
 * @return {Filter} filter or null if the filter couldn't be created
 */
Filter.fromObject = function(obj)
{
  let filter = Filter.fromText(obj.text);
  if (filter instanceof ActiveFilter)
  {
    if ("disabled" in obj)
      filter._disabled = (obj.disabled == "true");
    if ("hitCount" in obj)
      filter._hitCount = parseInt(obj.hitCount, 10) || 0;
    if ("lastHit" in obj)
      filter._lastHit = parseInt(obj.lastHit, 10) || 0;
  }
  return filter;
};

/**
 * Removes unnecessary whitespaces from filter text, will only return null if
 * the input parameter is null.
 * @param {string} text
 * @return {string}
 */
Filter.normalize = function(text)
{
  if (!text)
    return text;

  // Remove line breaks, tabs etc
  text = text.replace(/[^\S ]+/g, "");

  // Don't remove spaces inside comments
  if (/^ *!/.test(text))
    return text.trim();

  // Special treatment for element hiding filters, right side is allowed to
  // contain spaces
  if (Filter.elemhideRegExp.test(text))
  {
    let [, domains, separator, selector] = /^(.*?)(#[@?]?#?)(.*)$/.exec(text);
    return domains.replace(/ +/g, "") + separator + selector.trim();
  }

  // For most regexp filters we strip all spaces, but $csp filter options
  // are allowed to contain single (non trailing) spaces.
  let strippedText = text.replace(/ +/g, "");
  if (!strippedText.includes("$") || !/\bcsp=/i.test(strippedText))
    return strippedText;

  let optionsMatch = Filter.optionsRegExp.exec(strippedText);
  if (!optionsMatch)
    return strippedText;

  // For $csp filters we must first separate out the options part of the
  // text, being careful to preserve its spaces.
  let beforeOptions = strippedText.substring(0, optionsMatch.index);
  let strippedDollarIndex = -1;
  let dollarIndex = -1;
  do
  {
    strippedDollarIndex = beforeOptions.indexOf("$", strippedDollarIndex + 1);
    dollarIndex = text.indexOf("$", dollarIndex + 1);
  }
  while (strippedDollarIndex != -1);
  let optionsText = text.substr(dollarIndex + 1);

  // Then we can normalize spaces in the options part safely
  let options = optionsText.split(",");
  for (let i = 0; i < options.length; i++)
  {
    let option = options[i];
    let cspMatch = /^ *c *s *p *=/i.exec(option);
    if (cspMatch)
    {
      options[i] = cspMatch[0].replace(/ +/g, "") +
                   option.substr(cspMatch[0].length).trim().replace(/ +/g, " ");
    }
    else
      options[i] = option.replace(/ +/g, "");
  }

  return beforeOptions + "$" + options.join();
};

/**
 * @see filterToRegExp
 */
Filter.toRegExp = filterToRegExp;

/**
 * Class for invalid filters
 * @param {string} text see Filter()
 * @param {string} reason Reason why this filter is invalid
 * @constructor
 * @augments Filter
 */
function InvalidFilter(text, reason)
{
  Filter.call(this, text);

  this.reason = reason;
}
exports.InvalidFilter = InvalidFilter;

InvalidFilter.prototype = extend(Filter, {
  type: "invalid",

  /**
   * Reason why this filter is invalid
   * @type {string}
   */
  reason: null,

  /**
   * See Filter.serialize()
   * @inheritdoc
   */
  serialize(buffer) {}
});

/**
 * Class for comments
 * @param {string} text see Filter()
 * @constructor
 * @augments Filter
 */
function CommentFilter(text)
{
  Filter.call(this, text);
}
exports.CommentFilter = CommentFilter;

CommentFilter.prototype = extend(Filter, {
  type: "comment",

  /**
   * See Filter.serialize()
   * @inheritdoc
   */
  serialize(buffer) {}
});

/**
 * Abstract base class for filters that can get hits
 * @param {string} text
 *   see Filter()
 * @param {string} [domains]
 *   Domains that the filter is restricted to separated by domainSeparator
 *   e.g. "foo.com|bar.com|~baz.com"
 * @constructor
 * @augments Filter
 */
function ActiveFilter(text, domains)
{
  Filter.call(this, text);

  this.domainSource = domains;
}
exports.ActiveFilter = ActiveFilter;

ActiveFilter.prototype = extend(Filter, {
  _disabled: false,
  _hitCount: 0,
  _lastHit: 0,

  /**
   * Defines whether the filter is disabled
   * @type {boolean}
   */
  get disabled()
  {
    return this._disabled;
  },
  set disabled(value)
  {
    if (value != this._disabled)
    {
      let oldValue = this._disabled;
      this._disabled = value;
      FilterNotifier.triggerListeners("filter.disabled", this, value, oldValue);
    }
    return this._disabled;
  },

  /**
   * Number of hits on the filter since the last reset
   * @type {number}
   */
  get hitCount()
  {
    return this._hitCount;
  },
  set hitCount(value)
  {
    if (value != this._hitCount)
    {
      let oldValue = this._hitCount;
      this._hitCount = value;
      FilterNotifier.triggerListeners("filter.hitCount", this, value, oldValue);
    }
    return this._hitCount;
  },

  /**
   * Last time the filter had a hit (in milliseconds since the beginning of the
   * epoch)
   * @type {number}
   */
  get lastHit()
  {
    return this._lastHit;
  },
  set lastHit(value)
  {
    if (value != this._lastHit)
    {
      let oldValue = this._lastHit;
      this._lastHit = value;
      FilterNotifier.triggerListeners("filter.lastHit", this, value, oldValue);
    }
    return this._lastHit;
  },

  /**
   * String that the domains property should be generated from
   * @type {?string}
   */
  domainSource: null,

  /**
   * Separator character used in domainSource property, must be
   * overridden by subclasses
   * @type {string}
   */
  domainSeparator: null,

  /**
   * Determines whether the trailing dot in domain names isn't important and
   * should be ignored, must be overridden by subclasses.
   * @type {boolean}
   */
  ignoreTrailingDot: true,

  /**
   * Determines whether domainSource is already upper-case,
   * can be overridden by subclasses.
   * @type {boolean}
   */
  domainSourceIsUpperCase: false,

  /**
   * Map containing domains that this filter should match on/not match
   * on or null if the filter should match on all domains
   * @type {?Map.<string,boolean>}
   */
  get domains()
  {
    // Despite this property being cached, the getter is called
    // several times on Safari, due to WebKit bug 132872
    let prop = Object.getOwnPropertyDescriptor(this, "domains");
    if (prop)
      return prop.value;

    let domains = null;

    if (this.domainSource)
    {
      let source = this.domainSource;
      if (!this.domainSourceIsUpperCase)
      {
        // RegExpFilter already have uppercase domains
        source = source.toUpperCase();
      }
      let list = source.split(this.domainSeparator);
      if (list.length == 1 && list[0][0] != "~")
      {
        // Fast track for the common one-domain scenario
        if (this.ignoreTrailingDot)
          list[0] = list[0].replace(/\.+$/, "");
        domains = new Map([["", false], [list[0], true]]);
      }
      else
      {
        let hasIncludes = false;
        for (let i = 0; i < list.length; i++)
        {
          let domain = list[i];
          if (this.ignoreTrailingDot)
            domain = domain.replace(/\.+$/, "");
          if (domain == "")
            continue;

          let include;
          if (domain[0] == "~")
          {
            include = false;
            domain = domain.substr(1);
          }
          else
          {
            include = true;
            hasIncludes = true;
          }

          if (!domains)
            domains = new Map();

          domains.set(domain, include);
        }
        if (domains)
          domains.set("", !hasIncludes);
      }

      this.domainSource = null;
    }

    Object.defineProperty(this, "domains", {value: domains, enumerable: true});
    return this.domains;
  },

  /**
   * Array containing public keys of websites that this filter should apply to
   * @type {?string[]}
   */
  sitekeys: null,

  /**
   * Checks whether this filter is active on a domain.
   * @param {string} [docDomain] domain name of the document that loads the URL
   * @param {string} [sitekey] public key provided by the document
   * @return {boolean} true in case of the filter being active
   */
  isActiveOnDomain(docDomain, sitekey)
  {
    // Sitekeys are case-sensitive so we shouldn't convert them to
    // upper-case to avoid false positives here. Instead we need to
    // change the way filter options are parsed.
    if (this.sitekeys &&
        (!sitekey || this.sitekeys.indexOf(sitekey.toUpperCase()) < 0))
    {
      return false;
    }

    // If no domains are set the rule matches everywhere
    if (!this.domains)
      return true;

    // If the document has no host name, match only if the filter
    // isn't restricted to specific domains
    if (!docDomain)
      return this.domains.get("");

    if (this.ignoreTrailingDot)
      docDomain = docDomain.replace(/\.+$/, "");
    docDomain = docDomain.toUpperCase();

    while (true)
    {
      let isDomainIncluded = this.domains.get(docDomain);
      if (typeof isDomainIncluded != "undefined")
        return isDomainIncluded;

      let nextDot = docDomain.indexOf(".");
      if (nextDot < 0)
        break;
      docDomain = docDomain.substr(nextDot + 1);
    }
    return this.domains.get("");
  },

  /**
   * Checks whether this filter is active only on a domain and its subdomains.
   * @param {string} docDomain
   * @return {boolean}
   */
  isActiveOnlyOnDomain(docDomain)
  {
    if (!docDomain || !this.domains || this.domains.get(""))
      return false;

    if (this.ignoreTrailingDot)
      docDomain = docDomain.replace(/\.+$/, "");
    docDomain = docDomain.toUpperCase();

    for (let [domain, isIncluded] of this.domains)
    {
      if (isIncluded && domain != docDomain)
      {
        if (domain.length <= docDomain.length)
          return false;

        if (!domain.endsWith("." + docDomain))
          return false;
      }
    }

    return true;
  },

  /**
   * Checks whether this filter is generic or specific
   * @return {boolean}
   */
  isGeneric()
  {
    return !(this.sitekeys && this.sitekeys.length) &&
            (!this.domains || this.domains.get(""));
  },

  /**
   * See Filter.serialize()
   * @inheritdoc
   */
  serialize(buffer)
  {
    if (this._disabled || this._hitCount || this._lastHit)
    {
      Filter.prototype.serialize.call(this, buffer);
      if (this._disabled)
        buffer.push("disabled=true");
      if (this._hitCount)
        buffer.push("hitCount=" + this._hitCount);
      if (this._lastHit)
        buffer.push("lastHit=" + this._lastHit);
    }
  }
});

/**
 * Abstract base class for RegExp-based filters
 * @param {string} text see Filter()
 * @param {string} regexpSource
 *   filter part that the regular expression should be build from
 * @param {number} [contentType]
 *   Content types the filter applies to, combination of values from
 *   RegExpFilter.typeMap
 * @param {boolean} [matchCase]
 *   Defines whether the filter should distinguish between lower and upper case
 *   letters
 * @param {string} [domains]
 *   Domains that the filter is restricted to, e.g. "foo.com|bar.com|~baz.com"
 * @param {boolean} [thirdParty]
 *   Defines whether the filter should apply to third-party or first-party
 *   content only
 * @param {string} [sitekeys]
 *   Public keys of websites that this filter should apply to
 * @constructor
 * @augments ActiveFilter
 */
function RegExpFilter(text, regexpSource, contentType, matchCase, domains,
                      thirdParty, sitekeys)
{
  ActiveFilter.call(this, text, domains, sitekeys);

  if (contentType != null)
    this.contentType = contentType;
  if (matchCase)
    this.matchCase = matchCase;
  if (thirdParty != null)
    this.thirdParty = thirdParty;
  if (sitekeys != null)
    this.sitekeySource = sitekeys;

  if (regexpSource.length >= 2 &&
      regexpSource[0] == "/" &&
      regexpSource[regexpSource.length - 1] == "/")
  {
    // The filter is a regular expression - convert it immediately to
    // catch syntax errors
    let regexp = new RegExp(regexpSource.substr(1, regexpSource.length - 2),
                            this.matchCase ? "" : "i");
    Object.defineProperty(this, "regexp", {value: regexp});
  }
  else
  {
    // No need to convert this filter to regular expression yet, do it on demand
    this.regexpSource = regexpSource;
  }
}
exports.RegExpFilter = RegExpFilter;

RegExpFilter.prototype = extend(ActiveFilter, {
  /**
   * @see ActiveFilter.domainSourceIsUpperCase
   */
  domainSourceIsUpperCase: true,

  /**
   * Number of filters contained, will always be 1 (required to
   * optimize Matcher).
   * @type {number}
   */
  length: 1,

  /**
   * @see ActiveFilter.domainSeparator
   */
  domainSeparator: "|",

  /**
   * Expression from which a regular expression should be generated -
   * for delayed creation of the regexp property
   * @type {string}
   */
  regexpSource: null,
  /**
   * Regular expression to be used when testing against this filter
   * @type {RegExp}
   */
  get regexp()
  {
    // Despite this property being cached, the getter is called
    // several times on Safari, due to WebKit bug 132872
    let prop = Object.getOwnPropertyDescriptor(this, "regexp");
    if (prop)
      return prop.value;

    let source = Filter.toRegExp(this.regexpSource);
    let regexp = new RegExp(source, this.matchCase ? "" : "i");
    Object.defineProperty(this, "regexp", {value: regexp});
    this.regexpSource = null;
    return regexp;
  },
  /**
   * Content types the filter applies to, combination of values from
   * RegExpFilter.typeMap
   * @type {number}
   */
  contentType: 0x7FFFFFFF,
  /**
   * Defines whether the filter should distinguish between lower and
   * upper case letters
   * @type {boolean}
   */
  matchCase: false,
  /**
   * Defines whether the filter should apply to third-party or
   * first-party content only. Can be null (apply to all content).
   * @type {?boolean}
   */
  thirdParty: null,

  /**
   * String that the sitekey property should be generated from
   * @type {?string}
   */
  sitekeySource: null,

  /**
   * @see ActiveFilter.sitekeys
   */
  get sitekeys()
  {
    // Despite this property being cached, the getter is called
    // several times on Safari, due to WebKit bug 132872
    let prop = Object.getOwnPropertyDescriptor(this, "sitekeys");
    if (prop)
      return prop.value;

    let sitekeys = null;

    if (this.sitekeySource)
    {
      sitekeys = this.sitekeySource.split("|");
      this.sitekeySource = null;
    }

    Object.defineProperty(
      this, "sitekeys", {value: sitekeys, enumerable: true}
    );
    return this.sitekeys;
  },

  /**
   * Tests whether the URL matches this filter
   * @param {string} location URL to be tested
   * @param {number} typeMask bitmask of content / request types to match
   * @param {string} [docDomain] domain name of the document that loads the URL
   * @param {boolean} [thirdParty] should be true if the URL is a third-party
   *                               request
   * @param {string} [sitekey] public key provided by the document
   * @return {boolean} true in case of a match
   */
  matches(location, typeMask, docDomain, thirdParty, sitekey)
  {
    if (this.contentType & typeMask &&
        (this.thirdParty == null || this.thirdParty == thirdParty) &&
        this.isActiveOnDomain(docDomain, sitekey) && this.regexp.test(location))
    {
      return true;
    }
    return false;
  }
});

// Required to optimize Matcher, see also RegExpFilter.prototype.length
Object.defineProperty(RegExpFilter.prototype, "0", {
  get() { return this; }
});

/**
 * Creates a RegExp filter from its text representation
 * @param {string} text   same as in Filter()
 * @return {Filter}
 */
RegExpFilter.fromText = function(text)
{
  let blocking = true;
  let origText = text;
  if (text.indexOf("@@") == 0)
  {
    blocking = false;
    text = text.substr(2);
  }

  let contentType = null;
  let matchCase = null;
  let domains = null;
  let sitekeys = null;
  let thirdParty = null;
  let collapse = null;
  let csp = null;
  let rewrite = null;
  let options;
  let match = (text.indexOf("$") >= 0 ? Filter.optionsRegExp.exec(text) : null);
  if (match)
  {
    options = match[1].split(",");
    text = match.input.substr(0, match.index);
    for (let option of options)
    {
      let value = null;
      let separatorIndex = option.indexOf("=");
      if (separatorIndex >= 0)
      {
        value = option.substr(separatorIndex + 1);
        option = option.substr(0, separatorIndex);
      }
      option = option.replace(/-/, "_").toUpperCase();
      if (option in RegExpFilter.typeMap)
      {
        if (contentType == null)
          contentType = 0;
        contentType |= RegExpFilter.typeMap[option];

        if (option == "CSP" && value)
          csp = value;
      }
      else if (option[0] == "~" && option.substr(1) in RegExpFilter.typeMap)
      {
        if (contentType == null)
          ({contentType} = RegExpFilter.prototype);
        contentType &= ~RegExpFilter.typeMap[option.substr(1)];
      }
      else if (option == "MATCH_CASE")
        matchCase = true;
      else if (option == "~MATCH_CASE")
        matchCase = false;
      else if (option == "DOMAIN" && value)
        domains = value.toUpperCase();
      else if (option == "THIRD_PARTY")
        thirdParty = true;
      else if (option == "~THIRD_PARTY")
        thirdParty = false;
      else if (option == "COLLAPSE")
        collapse = true;
      else if (option == "~COLLAPSE")
        collapse = false;
      else if (option == "SITEKEY" && value)
        sitekeys = value.toUpperCase();
      else if (option == "REWRITE" && value)
        rewrite = value;
      else
        return new InvalidFilter(origText, "filter_unknown_option");
    }
  }

  // For security reasons, never match $rewrite filters
  // against requests that might load any code to be executed.
  if (rewrite != null)
  {
    if (contentType == null)
      ({contentType} = RegExpFilter.prototype);
    contentType &= ~(RegExpFilter.typeMap.SCRIPT |
                     RegExpFilter.typeMap.SUBDOCUMENT |
                     RegExpFilter.typeMap.OBJECT |
                     RegExpFilter.typeMap.OBJECT_SUBREQUEST);
  }

  try
  {
    if (blocking)
    {
      if (csp && Filter.invalidCSPRegExp.test(csp))
        return new InvalidFilter(origText, "filter_invalid_csp");

      return new BlockingFilter(origText, text, contentType, matchCase, domains,
                                thirdParty, sitekeys, collapse, csp, rewrite);
    }
    return new WhitelistFilter(origText, text, contentType, matchCase, domains,
                               thirdParty, sitekeys);
  }
  catch (e)
  {
    return new InvalidFilter(origText, "filter_invalid_regexp");
  }
};

/**
 * Maps type strings like "SCRIPT" or "OBJECT" to bit masks
 */
RegExpFilter.typeMap = {
  OTHER: 1,
  SCRIPT: 2,
  IMAGE: 4,
  STYLESHEET: 8,
  OBJECT: 16,
  SUBDOCUMENT: 32,
  DOCUMENT: 64,
  WEBSOCKET: 128,
  WEBRTC: 256,
  CSP: 512,
  XBL: 1,
  PING: 1024,
  XMLHTTPREQUEST: 2048,
  OBJECT_SUBREQUEST: 4096,
  DTD: 1,
  MEDIA: 16384,
  FONT: 32768,

  BACKGROUND: 4,    // Backwards compat, same as IMAGE

  POPUP: 0x10000000,
  GENERICBLOCK: 0x20000000,
  ELEMHIDE: 0x40000000,
  GENERICHIDE: 0x80000000
};

// CSP, DOCUMENT, ELEMHIDE, POPUP, GENERICHIDE and GENERICBLOCK options
// shouldn't be there by default
RegExpFilter.prototype.contentType &= ~(RegExpFilter.typeMap.CSP |
                                        RegExpFilter.typeMap.DOCUMENT |
                                        RegExpFilter.typeMap.ELEMHIDE |
                                        RegExpFilter.typeMap.POPUP |
                                        RegExpFilter.typeMap.GENERICHIDE |
                                        RegExpFilter.typeMap.GENERICBLOCK);

/**
 * Class for blocking filters
 * @param {string} text see Filter()
 * @param {string} regexpSource see RegExpFilter()
 * @param {number} [contentType] see RegExpFilter()
 * @param {boolean} [matchCase] see RegExpFilter()
 * @param {string} [domains] see RegExpFilter()
 * @param {boolean} [thirdParty] see RegExpFilter()
 * @param {string} [sitekeys] see RegExpFilter()
 * @param {boolean} [collapse]
 *   defines whether the filter should collapse blocked content, can be null
 * @param {string} [csp]
 *   Content Security Policy to inject when the filter matches
 * @param {?string} [rewrite]
 *   The (optional) rule specifying how to rewrite the URL. See
 *   BlockingFilter.prototype.rewrite.
 * @constructor
 * @augments RegExpFilter
 */
function BlockingFilter(text, regexpSource, contentType, matchCase, domains,
                        thirdParty, sitekeys, collapse, csp, rewrite)
{
  RegExpFilter.call(this, text, regexpSource, contentType, matchCase, domains,
                    thirdParty, sitekeys);

  this.collapse = collapse;
  this.csp = csp;
  this.rewrite = rewrite;
}
exports.BlockingFilter = BlockingFilter;

BlockingFilter.prototype = extend(RegExpFilter, {
  type: "blocking",

  /**
   * Defines whether the filter should collapse blocked content.
   * Can be null (use the global preference).
   * @type {?boolean}
   */
  collapse: null,

  /**
   * Content Security Policy to inject for matching requests.
   * @type {?string}
   */
  csp: null,

  /**
   * The rule specifying how to rewrite the URL.
   * The syntax is similar to the one of String.prototype.replace().
   * @type {?string}
   */
  rewrite: null,

  /**
   * Rewrites an URL.
   * @param {string} url the URL to rewrite
   * @return {string} the rewritten URL, or the original in case of failure
   */
  rewriteUrl(url)
  {
    try
    {
      let rewrittenUrl = new URL(url.replace(this.regexp, this.rewrite), url);
      if (rewrittenUrl.origin == new URL(url).origin)
        return rewrittenUrl.href;
    }
    catch (e)
    {
    }

    return url;
  }
});

/**
 * Class for whitelist filters
 * @param {string} text see Filter()
 * @param {string} regexpSource see RegExpFilter()
 * @param {number} [contentType] see RegExpFilter()
 * @param {boolean} [matchCase] see RegExpFilter()
 * @param {string} [domains] see RegExpFilter()
 * @param {boolean} [thirdParty] see RegExpFilter()
 * @param {string} [sitekeys] see RegExpFilter()
 * @constructor
 * @augments RegExpFilter
 */
function WhitelistFilter(text, regexpSource, contentType, matchCase, domains,
                         thirdParty, sitekeys)
{
  RegExpFilter.call(this, text, regexpSource, contentType, matchCase, domains,
                    thirdParty, sitekeys);
}
exports.WhitelistFilter = WhitelistFilter;

WhitelistFilter.prototype = extend(RegExpFilter, {
  type: "whitelist"
});

/**
 * Base class for element hiding filters
 * @param {string} text see Filter()
 * @param {string} [domains] Host names or domains the filter should be
 *                           restricted to
 * @param {string} selector   CSS selector for the HTML elements that should be
 *                            hidden
 * @constructor
 * @augments ActiveFilter
 */
function ElemHideBase(text, domains, selector)
{
  ActiveFilter.call(this, text, domains || null);

  // Braces are being escaped to prevent CSS rule injection.
  this.selector = selector.replace("{", "\\7B ").replace("}", "\\7D ");
}
exports.ElemHideBase = ElemHideBase;

ElemHideBase.prototype = extend(ActiveFilter, {
  /**
   * @see ActiveFilter.domainSeparator
   */
  domainSeparator: ",",

  /**
   * @see ActiveFilter.ignoreTrailingDot
   */
  ignoreTrailingDot: false,

  /**
   * CSS selector for the HTML elements that should be hidden
   * @type {string}
   */
  selector: null
});

/**
 * Creates an element hiding filter from a pre-parsed text representation
 *
 * @param {string} text         same as in Filter()
 * @param {string} [domains]
 *   domains part of the text representation
 * @param {string} [type]
*    rule type, either empty or @ (exception) or ? (emulation rule)
 * @param {string} selector     raw CSS selector
 * @return {ElemHideFilter|ElemHideException|
 *          ElemHideEmulationFilter|InvalidFilter}
 */
ElemHideBase.fromText = function(text, domains, type, selector)
{
  // We don't allow ElemHide filters which have any empty domains.
  // Note: The ElemHide.prototype.domainSeparator is duplicated here, if that
  // changes this must be changed too.
  if (domains && /(^|,)~?(,|$)/.test(domains))
    return new InvalidFilter(text, "filter_invalid_domain");

  if (type == "@")
    return new ElemHideException(text, domains, selector);

  if (type == "?")
  {
    // Element hiding emulation filters are inefficient so we need to make sure
    // that they're only applied if they specify active domains
    if (!/,[^~][^,.]*\.[^,]/.test("," + domains))
      return new InvalidFilter(text, "filter_elemhideemulation_nodomain");

    return new ElemHideEmulationFilter(text, domains, selector);
  }

  return new ElemHideFilter(text, domains, selector);
};

/**
 * Class for element hiding filters
 * @param {string} text see Filter()
 * @param {string} [domains]  see ElemHideBase()
 * @param {string} selector see ElemHideBase()
 * @constructor
 * @augments ElemHideBase
 */
function ElemHideFilter(text, domains, selector)
{
  ElemHideBase.call(this, text, domains, selector);
}
exports.ElemHideFilter = ElemHideFilter;

ElemHideFilter.prototype = extend(ElemHideBase, {
  type: "elemhide"
});

/**
 * Class for element hiding exceptions
 * @param {string} text see Filter()
 * @param {string} [domains]  see ElemHideBase()
 * @param {string} selector see ElemHideBase()
 * @constructor
 * @augments ElemHideBase
 */
function ElemHideException(text, domains, selector)
{
  ElemHideBase.call(this, text, domains, selector);
}
exports.ElemHideException = ElemHideException;

ElemHideException.prototype = extend(ElemHideBase, {
  type: "elemhideexception"
});

/**
 * Class for element hiding emulation filters
 * @param {string} text           see Filter()
 * @param {string} domains        see ElemHideBase()
 * @param {string} selector       see ElemHideBase()
 * @constructor
 * @augments ElemHideBase
 */
function ElemHideEmulationFilter(text, domains, selector)
{
  ElemHideBase.call(this, text, domains, selector);
}
exports.ElemHideEmulationFilter = ElemHideEmulationFilter;

ElemHideEmulationFilter.prototype = extend(ElemHideBase, {
  type: "elemhideemulation"
});
