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

const {Cache} = require("./caching");

const publicSuffixes = require("../data/publicSuffixList.json");

/**
 * Map of public suffixes to their offsets.
 * @type {Map.<string,number>}
 */
let publicSuffixMap = buildPublicSuffixMap();

/**
 * Cache of domain maps. The domains part of filter text
 * (e.g. <code>example.com,~mail.example.com</code>) is often repeated across
 * filters. This cache enables deduplication of the <code>Map</code> objects
 * that specify on which domains the filter does and does not apply, which
 * reduces memory usage and improves performance.
 * @type {Map.<string, Map.<string, boolean>>}
 */
let domainsCache = new Cache(1000);

/**
 * Builds a map of public suffixes to their offsets.
 * @returns {Map.<string,number>}
 */
function buildPublicSuffixMap()
{
  let map = new Map();

  for (let key in publicSuffixes)
    map.set(key, publicSuffixes[key]);

  return map;
}

/**
 * A <code>URLInfo</code> object represents information about a URL. It is
 * returned by <code>{@link parseURL}</code>.
 */
class URLInfo
{
  /**
   * Creates a <code>URLInfo</code> object.
   *
   * @param {string} href The entire URL.
   * @param {string} protocol The protocol scheme of the URL, including the
   *   final <code>:</code>.
   * @param {string} [hostname] The hostname of the URL.
   *
   * @private
   */
  constructor(href, protocol, hostname = "")
  {
    this._href = href;
    this._protocol = protocol;
    this._hostname = hostname;
  }

  /**
   * The entire URL.
   * @type {string}
   */
  get href()
  {
    return this._href;
  }

  /**
   * The protocol scheme of the URL, including the final <code>:</code>.
   * @type {string}
   */
  get protocol()
  {
    return this._protocol;
  }

  /**
   * The hostname of the URL.
   * @type {string}
   */
  get hostname()
  {
    return this._hostname;
  }

  /**
   * Returns the entire URL.
   * @returns {string} The entire URL.
   */
  toString()
  {
    return this._href;
  }
}

/**
 * Parses a URL to extract the protocol and the hostname. This is a lightweight
 * alternative to the native <code>URL</code> object. Unlike the
 * <code>URL</code> object, this function is not robust and will give incorrect
 * results for invalid URLs. <em>Use this function with valid, normalized,
 * properly encoded (IDNA and percent-encoding) URLs only.</em>
 *
 * @param {string} url The URL to parse.
 * @returns {URLInfo} Information about the URL.
 */
function parseURL(url)
{
  let match = /^([^:]+:)(?:\/\/(?:[^/]*@)?(\[[^\]]*\]|[^:/]+))?/.exec(url);
  return new URLInfo(url, match[1], match[2]);
}

exports.parseURL = parseURL;

/**
 * Normalizes a hostname.
 * @param {string} hostname
 * @returns {string}
 */
function normalizeHostname(hostname)
{
  return hostname[hostname.length - 1] == "." ?
           hostname.replace(/\.+$/, "") : hostname;
}

exports.normalizeHostname = normalizeHostname;

/**
 * Yields all suffixes for a domain. For example, given the domain
 * <code>www.example.com</code>, this function yields
 * <code>www.example.com</code>, <code>example.com</code>, and
 * <code>com</code>, in that order.
 *
 * @param {string} domain The domain.
 * @param {boolean} [includeBlank] Whether to include the blank suffix at the
 *   end.
 *
 * @yields {string} The next suffix for the domain.
 */
function* domainSuffixes(domain, includeBlank = false)
{
  while (domain != "")
  {
    yield domain;

    let dotIndex = domain.indexOf(".");
    domain = dotIndex == -1 ? "" : domain.substr(dotIndex + 1);
  }

  if (includeBlank)
    yield "";
}

exports.domainSuffixes = domainSuffixes;

/**
 * Checks whether the given hostname is an IP address.
 *
 * @param {string} hostname
 * @returns {boolean}
 */
function isIPAddress(hostname)
{
  return (hostname[0] == "[" && hostname[hostname.length - 1] == "]") ||
         /^\d+(\.\d+){3}$/.test(hostname);
}

/**
 * Gets the base domain for the given hostname.
 *
 * @param {string} hostname
 * @returns {string}
 */
function getBaseDomain(hostname)
{
  let slices = [];
  let cutoff = NaN;

  for (let suffix of domainSuffixes(hostname))
  {
    slices.push(suffix);

    let offset = publicSuffixMap.get(suffix);

    if (typeof offset != "undefined")
    {
      cutoff = slices.length - 1 - offset;
      break;
    }
  }

  if (isNaN(cutoff))
    return slices.length > 2 ? slices[slices.length - 2] : hostname;

  if (cutoff <= 0)
    return hostname;

  return slices[cutoff];
}

exports.getBaseDomain = getBaseDomain;

/**
 * Checks whether a request's origin is different from its document's origin.
 *
 * @param {string} requestHostname The IDNA-encoded hostname of the request.
 * @param {string} documentHostname The IDNA-encoded hostname of the document.
 *
 * @returns {boolean}
 */
function isThirdParty(requestHostname, documentHostname)
{
  if (requestHostname[requestHostname.length - 1] == ".")
    requestHostname = requestHostname.replace(/\.+$/, "");

  if (documentHostname[documentHostname.length - 1] == ".")
    documentHostname = documentHostname.replace(/\.+$/, "");

  if (requestHostname == documentHostname)
    return false;

  if (!requestHostname || !documentHostname)
    return true;

  if (isIPAddress(requestHostname) || isIPAddress(documentHostname))
    return true;

  return getBaseDomain(requestHostname) != getBaseDomain(documentHostname);
}

exports.isThirdParty = isThirdParty;

/**
 * The <code>URLRequest</code> class represents a URL request.
 */
class URLRequest
{
  /**
   * @private
   */
  URLRequest() {}

  /**
   * The URL of the request.
   * @type {string}
   */
  get href()
  {
    return this._href;
  }

  /**
   * Information about the URL of the request.
   * @type {URLInfo}
   */
  get urlInfo()
  {
    if (!this._urlInfo)
      this._urlInfo = parseURL(this._href);

    return this._urlInfo;
  }

  /**
   * The hostname of the document making the request.
   * @type {?string}
   */
  get documentHostname()
  {
    return this._documentHostname == null ? null : this._documentHostname;
  }

  /**
   * Whether this is a third-party request.
   * @type {boolean}
   */
  get thirdParty()
  {
    if (typeof this._thirdParty == "undefined")
    {
      this._thirdParty = this._documentHostname == null ? false :
                           isThirdParty(this.urlInfo.hostname,
                                        this._documentHostname);
    }

    return this._thirdParty;
  }

  /**
   * Returns the URL of the request.
   * @returns {string}
   */
  toString()
  {
    return this._href;
  }

  /**
   * The lower-case version of the URL of the request.
   * @type {string}
   * @package
   */
  get lowerCaseHref()
  {
    if (this._lowerCaseHref == null)
      this._lowerCaseHref = this._href.toLowerCase();

    return this._lowerCaseHref;
  }
}

/**
 * Returns a <code>{@link URLRequest}</code> object for the given URL.
 *
 * @param {string|URLInfo|URL} url The URL. If this is a <code>string</code>,
 *   it must be a canonicalized URL (see {@link parseURL}).
 * @param {?string} [documentHostname] The IDNA-encoded hostname of the
 *   document making the request.
 *
 * @returns {URLRequest}
 */
URLRequest.from = function(url, documentHostname = null)
{
  let request = new URLRequest();

  if (typeof url == "string")
  {
    request._href = url;
  }
  else
  {
    request._urlInfo = url instanceof URLInfo ? url :
                         new URLInfo(url.href, url.protocol, url.hostname);
    request._href = url.href;
  }

  if (documentHostname != null)
    request._documentHostname = documentHostname;

  return request;
};

exports.URLRequest = URLRequest;

/**
 * Parses the domains part of a filter text
 * (e.g. <code>example.com,~mail.example.com</code>) into a <code>Map</code>
 * object.
 *
 * @param {string} source The domains part of a filter text.
 * @param {string} separator The string used to separate two or more domains in
 *   the domains part of a filter text.
 *
 * @returns {?Map.<string, boolean>}
 *
 * @package
 */
function parseDomains(source, separator)
{
  let domains = domainsCache.get(source);
  if (typeof domains != "undefined")
    return domains;

  let list = source.split(separator);
  if (list.length == 1 && list[0][0] != "~")
  {
    // Fast track for the common one-domain scenario
    domains = new Map([["", false], [list[0], true]]);
  }
  else
  {
    domains = null;

    let hasIncludes = false;
    for (let i = 0; i < list.length; i++)
    {
      let domain = list[i];
      if (domain == "")
        continue;

      let include;
      if (domain[0] == "~")
      {
        include = false;
        domain = domain.substring(1);
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

  domainsCache.set(source, domains);

  return domains;
}

exports.parseDomains = parseDomains;
