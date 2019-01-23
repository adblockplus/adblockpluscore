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
function getDomain(hostname)
{
  let bits = hostname.split(".");
  let cutoff = bits.length - 2;

  for (let i = 0; i < bits.length; i++)
  {
    let offset = publicSuffixes[bits.slice(i).join(".")];

    if (typeof offset != "undefined")
    {
      cutoff = i - offset;
      break;
    }
  }

  if (cutoff <= 0)
    return hostname;

  return bits.slice(cutoff).join(".");
}

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
  let requestHostname = url.hostname.replace(/\.+$/, "");
  documentHostname = documentHostname.replace(/\.+$/, "");

  if (requestHostname == documentHostname)
    return false;

  if (!isDomain(requestHostname) || !isDomain(documentHostname))
    return true;

  return getDomain(requestHostname) != getDomain(documentHostname);
}

exports.isThirdParty = isThirdParty;
