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
 * Content types for request blocking and whitelisting.
 *
 * There are two kinds of content types: resource types, and special
 * (non-resource) types.
 *
 * Resource types include web resources like scripts, images, and so on.
 *
 * Special types include filter options for popup blocking and CSP header
 * injection as well as flags for whitelisting documents.
 *
 * By default a filter matches any resource type, but if a filter has an
 * explicit resource type, special option, or whitelisting flag, like
 * <code>$script</code>, <code>$popup</code>, or <code>$elemhide</code>, then
 * it matches only the given type, option, or flag.
 *
 * @type {object}
 */
let contentTypes = {
  // Types of web resources.
  OTHER: 1,
  SCRIPT: 2,
  IMAGE: 4,
  STYLESHEET: 8,
  OBJECT: 16,
  SUBDOCUMENT: 32,
  WEBSOCKET: 128,
  WEBRTC: 256,
  PING: 1024,
  XMLHTTPREQUEST: 2048, // 1 << 11

  MEDIA: 16384,
  FONT: 32768, // 1 << 15

  // Special filter options.
  POPUP: 1 << 24,
  CSP: 1 << 25,

  // Whitelisting flags.
  DOCUMENT: 1 << 26,
  GENERICBLOCK: 1 << 27,
  ELEMHIDE: 1 << 28,
  GENERICHIDE: 1 << 29
};

// Backwards compatibility.
contentTypes.BACKGROUND = contentTypes.IMAGE;
contentTypes.XBL = contentTypes.OTHER;
contentTypes.DTD = contentTypes.OTHER;

exports.contentTypes = contentTypes;

/**
 * Bitmask for resource types like <code>$script</code>, <code>$image</code>,
 * <code>$stylesheet</code>, and so on.
 *
 * If a filter has no explicit content type, it applies to all resource types
 * (but not to any {@link SPECIAL_TYPES special types}).
 *
 * @type {number}
 *
 * @package
 */
// The first 24 bits are reserved for resource types like "script", "image",
// and so on.
// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/ResourceType
const RESOURCE_TYPES = (1 << 24) - 1;

exports.RESOURCE_TYPES = RESOURCE_TYPES;

/**
 * Bitmask for special "types" (options and flags) like <code>$csp</code>,
 * <code>$elemhide</code>, and so on.
 *
 * @type {number}
 *
 * @package
 */
const SPECIAL_TYPES = ~RESOURCE_TYPES;

exports.SPECIAL_TYPES = SPECIAL_TYPES;

/**
 * Bitmask for "types" (flags) that are for exception rules only, like
 * <code>$document</code>, <code>$elemhide</code>, and so on.
 *
 * @type {number}
 *
 * @package
 */
const WHITELISTING_TYPES = contentTypes.DOCUMENT |
                           contentTypes.GENERICBLOCK |
                           contentTypes.ELEMHIDE |
                           contentTypes.GENERICHIDE;

exports.WHITELISTING_TYPES = WHITELISTING_TYPES;

/**
 * Yields individual types from a filter's type mask.
 *
 * @param {number} contentType A filter's type mask.
 * @param {number} [selection] Which types to yield.
 *
 * @yields {number}
 *
 * @package
 */
function* enumerateTypes(contentType, selection = ~0)
{
  for (let mask = contentType & selection, bitIndex = 0;
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

exports.enumerateTypes = enumerateTypes;
