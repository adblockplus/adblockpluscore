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

/** @module */

const {contentTypes, RESOURCE_TYPES} = require("../contentTypes");

/**
 * Regular expression that content filters should match
 * @type {RegExp}
 */
const CONTENT_FILTER = /^([^/|@"!]*?)#([@?$])?#(.+)$/;
exports.CONTENT_FILTER = CONTENT_FILTER;

/**
 * Regular expression that options on a RegExp filter should match
 * @type {RegExp}
 */
const FILTER_OPTIONS = /\$(~?[\w-]+(?:=[^,]*)?(?:,~?[\w-]+(?:=[^,]*)?)*)$/;
exports.FILTER_OPTIONS = FILTER_OPTIONS;

// used to reduce possible short filters damage
const MIN_GENERIC_URL_FILTER_PATTERN_LENGTH = 4;

/**
 * Regular expression that matches an invalid Content Security Policy
 * @type {RegExp}
 */
const INVALID_CSP = /(;|^) ?(base-uri|referrer|report-to|report-uri|upgrade-insecure-requests)\b/i;
exports.INVALID_CSP = INVALID_CSP;

/**
 * The Error type returned by parse.
 *
 * For example `filter_unknown_option` will have `option`.
 * @property {Object} detail Contains information about the error.
 * @property {string} [detail.option] The option for `filter_unknown_option`.
 * @property {string} [detail.regexp] The regexp for `filter_invalid_regexp`.
 * @property {string} detail.text The text of the rejected filter.
 */
class FilterParsingError extends Error {
  /** Construct a FilterParsingError
   * @constructor
   * @param {string} message The error message.
   * @param {Object} detail The FilterParsingError detail. Contains at
   *   least `text`.
   */
  constructor(message, detail) {
    super(message);
    this.detail = detail;
  }
}

exports.FilterParsingError = FilterParsingError;

/**
 * @typedef {Object} ParsedFilter
 * @property {bool} blocking Whether it's a blocking filter or not.
 * @property {string} text The filter text.
 * @property {string} regexpSource The source of the matching RegExp.
 * @property {number} contentType The
 *   {@link module:contentTypes.contentTypes content types} for the filter.
 * @property {bool?} matchCase If the filter is case sensitive.
 * @property {Array<string>?} domains The domains to match
 *   (`$domains` option).
 * @property {Array<string>?} sitekeys The sitekeys to match.
 * @property {object?} headers The headers filtering.
 * @property {string?} rewrite The URL for to rewrite to.
 * @property {string?} csp The CSP directive.
 */

/**
 * Parse the filter text representation into a structure.
 *
 * This is meant to be called by
 * {module:filterClasses.URLFilter.fromText}
 *
 * @param {string} text the filter normalized text. Call normalize()
 *   on the text prior to this, unless it is already normalized.
 * @return {ParsedFilter|FilterParsingError}
 *   The parsed filter, or a FilterParsingError.
 */
exports.parse = function parse(text) {
  // exclude empty text, comments, and content filters
  if (text.length < 1)
    return new FilterParsingError("filter_empty", {text});

  if (text[0] === "!" || CONTENT_FILTER.test(text))
    return new FilterParsingError("invalid", {text});

  // parse like an ABP URLFilter
  let blocking = true;
  let origText = text;
  if (text.startsWith("@@")) {
    blocking = false;
    text = text.substring(2);
  }

  let contentType = null;
  let matchCase = null;
  let domains = null;
  let sitekeys = null;
  let thirdParty = null;
  let csp = null;
  let rewrite = null;
  let header = null;
  let options;
  let match = text.includes("$") ? FILTER_OPTIONS.exec(text) : null;
  if (match) {
    text = match.input.substring(0, match.index);

    options = match[1].split(",");
    let cspSet = false;
    let headerSet = false;

    for (let option of options) {
      let value = null;
      let separatorIndex = option.indexOf("=");
      if (separatorIndex >= 0) {
        value = option.substring(separatorIndex + 1);
        option = option.substring(0, separatorIndex);
      }

      let inverse = option[0] == "~";
      if (inverse)
        option = option.substring(1);

      let optionUpperCase = option.toUpperCase();
      let type = contentTypes[optionUpperCase.replace(/-/, "_")];
      if (type) {
        if (inverse) {
          if (contentType == null)
            contentType = RESOURCE_TYPES;
          contentType &= ~type;
        }
        else if (type === contentTypes.CSP) {
          if (blocking && !value) {
            return new FilterParsingError("filter_invalid_csp",
                                          {text: origText});
          }
          cspSet = true;
          csp = value;
        }
        else if (type === contentTypes.HEADER) {
          if (blocking && !value) {
            return new FilterParsingError("filter_invalid_header",
                                          {text: origText});
          }
          headerSet = true;
          if (value) {
            let headerRaw = value.replace(/([^\\])\\x2c/g, "$1,")
                .replace(/\\\\x2c/g, "\\x2c");
            let equal = headerRaw.indexOf("=");
            if (equal == headerRaw.length - 1) {
              // This case is "key=" with no value
              header = {
                name: headerRaw.substring(0, equal).toLowerCase()
              };
            }
            else if (equal >= 0) {
              header = {
                name: headerRaw.substring(0, equal).toLowerCase(),
                value: headerRaw.substring(equal + 1)
              };
            }
            else {
              header = {
                name: headerRaw.toLowerCase()
              };
            }

            if (header.name.length == 0) {
              return new FilterParsingError("filter_invalid_header",
                                            {text: origText});
            }
            if (/^\/[\s\S]*\/$/.test(header.value)) {
              return new FilterParsingError("filter_invalid_header",
                                            {text: origText});
            }
          }
        }
        else {
          contentType |= type;
        }
      }
      else {
        switch (optionUpperCase) {
          case "MATCH-CASE":
            matchCase = !inverse;
            break;
          case "DOMAIN":
            if (!value) {
              return new FilterParsingError("filter_unknown_option",
                                            {option, text: origText});
            }
            domains = value;
            break;
          case "THIRD-PARTY":
            thirdParty = !inverse;
            break;
          case "SITEKEY":
            if (!value) {
              return new FilterParsingError("filter_unknown_option",
                                            {option, text: origText});
            }
            // Sitekeys are case-sensitive, they shouldn't be uppercased.
            sitekeys = value;
            break;
          case "REWRITE":
            if (value == null) {
              return new FilterParsingError("filter_unknown_option",
                                            {option, text: origText});
            }
            if (!value.startsWith("abp-resource:")) {
              return new FilterParsingError("filter_invalid_rewrite",
                                            {text: origText});
            }
            rewrite = value.substring("abp-resource:".length);
            break;
          default:
            return new FilterParsingError("filter_unknown_option",
                                          {option, text: origText});
        }
      }
    }
    if (cspSet || headerSet) {
      if (contentType == null)
        contentType = RESOURCE_TYPES;
      if (cspSet)
        contentType |= contentTypes.CSP;
      if (headerSet)
        contentType |= contentTypes.HEADER;
    }
  }

  let isGeneric = !sitekeys && !domains;
  if (isGeneric) {
    let minTextLength = MIN_GENERIC_URL_FILTER_PATTERN_LENGTH;
    let {length} = text;
    if (length > 0 && text[0] === "|") {
      minTextLength++;
      if (length > 1 && text[1] === "|")
        minTextLength++;
    }
    if (length < minTextLength && !text.includes("*")) {
      return new FilterParsingError("filter_url_not_specific_enough",
                                    {text: origText});
    }
  }
  // We expect filters to use Punycode for domains these days, so let's just
  // skip filters which don't. See #6647.
  else if (domains && /[^\x00-\x7F]/.test(domains)) {
    return new FilterParsingError("filter_invalid_domain", {text: origText});
  }

  if (blocking) {
    if (csp && INVALID_CSP.test(csp))
      return new FilterParsingError("filter_invalid_csp", {text: origText});

    if (rewrite) {
      if (text.startsWith("||")) {
        if (!domains && thirdParty != false) {
          return new FilterParsingError("filter_invalid_rewrite",
                                        {text: origText});
        }
      }
      else if (text.startsWith("*")) {
        if (!domains) {
          return new FilterParsingError("filter_invalid_rewrite",
                                        {text: origText});
        }
      }
      else {
        return new FilterParsingError("filter_invalid_rewrite",
                                      {text: origText});
      }
    }
  }

  return {
    blocking,
    text: origText,
    regexpSource: text,
    contentType,
    matchCase,
    domains,
    thirdParty,
    sitekeys,
    header,
    rewrite,
    csp
  };
};

/**
 * Removes unnecessary whitespaces from filter text, will only return null if
 * the input parameter is null.
 *
 * @param {string} text
 * @param {boolean?} dontSanitize avoid expensive operations on text.
 * @return {string}
 */
exports.normalize = function(text, dontSanitize = false) {
  if (text === "")
    return text;

  // Remove line breaks, tabs etc
  text = text.replace(/[^\S ]+/g, "");

  if (dontSanitize)
    return text.trim();

  if (!text.includes(" "))
    return text;

  // Don't remove spaces inside comments
  if (/^ *!/.test(text))
    return text.trim();

  // Special treatment for content filters, right side is allowed to contain
  // spaces
  if (CONTENT_FILTER.test(text)) {
    let [, domains, separator, body] = /^(.*?)(#[@?$]?#?)(.*)$/.exec(text);
    return domains.replace(/ +/g, "") + separator + body.trim();
  }

  // For most regexp filters we strip all spaces, but $csp filter options
  // are allowed to contain single (non trailing) spaces.
  let strippedText = text.replace(/ +/g, "");
  if (!strippedText.includes("$") || !/\b(csp|header)=/i.test(strippedText))
    return strippedText;

  let optionsMatch = FILTER_OPTIONS.exec(strippedText);
  if (!optionsMatch)
    return strippedText;

  // For $csp filters we must first separate out the options part of the
  // text, being careful to preserve its spaces.
  let beforeOptions = strippedText.substring(0, optionsMatch.index);
  let strippedDollarIndex = -1;
  let dollarIndex = -1;
  do {
    strippedDollarIndex = beforeOptions.indexOf("$", strippedDollarIndex + 1);
    dollarIndex = text.indexOf("$", dollarIndex + 1);
  }
  while (strippedDollarIndex != -1);
  let optionsText = text.substring(dollarIndex + 1);

  // Then we can normalize spaces in the options part safely
  let options = optionsText.split(",");
  for (let i = 0; i < options.length; i++) {
    let option = options[i];
    let optionMatch = /^ *(c *s *p|h *e *a *d *e *r) *=/i.exec(option);
    if (optionMatch) {
      options[i] = optionMatch[0].replace(/ +/g, "") +
                   option.substring(optionMatch[0].length).trim().replace(/ +/g, " ");
    }
    else {
      options[i] = option.replace(/ +/g, "");
    }
  }

  return beforeOptions + "$" + options.join();
};
