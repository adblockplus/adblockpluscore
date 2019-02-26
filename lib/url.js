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

const publicSuffixes = require("../data/publicSuffixList.json");

/**
 * Map of public suffixes to their offsets.
 * @type {Map.<string,number>}
 */
let publicSuffixMap = buildPublicSuffixMap();

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
  return (hostname[hostname.length - 1] == "." ?
            hostname.replace(/\.+$/, "") : hostname).toLowerCase();
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
 * Checks whether the given hostname is a domain.
 *
 * @param {string} hostname
 * @returns {boolean}
 */
function isDomain(hostname)
{
  // No hostname or IPv4 address, also considering hexadecimal octets.
  if (/^((0x[\da-f]+|\d+)(\.|$))*$/i.test(hostname))
    return false;

  // IPv6 address. Since there can't be colons in domains, we can
  // just check whether there are any colons to exclude IPv6 addresses.
  return hostname.indexOf(":") == -1;
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
 * @param {URL} url The request URL.
 * @param {string} documentHostname The IDNA-encoded hostname of the document.
 *
 * @returns {boolean}
 */
function isThirdParty(url, documentHostname)
{
  let requestHostname = url.hostname;

  if (requestHostname[requestHostname.length - 1] == ".")
    requestHostname = requestHostname.replace(/\.+$/, "");

  if (documentHostname[documentHostname.length - 1] == ".")
    documentHostname = documentHostname.replace(/\.+$/, "");

  if (requestHostname == documentHostname)
    return false;

  if (!isDomain(requestHostname) || !isDomain(documentHostname))
    return true;

  return getBaseDomain(requestHostname) != getBaseDomain(documentHostname);
}

exports.isThirdParty = isThirdParty;
