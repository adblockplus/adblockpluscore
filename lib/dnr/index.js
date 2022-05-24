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

const {Pattern} = require("../patterns");
const {parseDomains} = require("../url");
const {contentTypes, RESOURCE_TYPES} = require("../contentTypes");
const {
  generateCSPRules,
  generateAllowingRules,
  generateRedirectRules,
  generateBlockingRules,
  validateRule
} = require("./rules");
const {parse, FilterParsingError} = require("../filters");

/**
 * @typedef {Object} ConverterOptions
 * @property {function} isRegexSupported a sync/async method to check if a
 *  generic regular expression is compatible with the engine.
 * @property {function} modifyRule a sync method to modify a DNR rule if needed.
 */

/**
 * Returns a callback bound to the given options.
 * @param {ConverterOptions} options in Mv3 Web extensions this would be
 *  `chrome.declarativeNetRequest.isRegexSupported`, so that it's possible to
 *  pass `chrome.declarativeNetRequest` directly as option.
 * @returns {function}
 */
exports.createConverter = options => convert.bind({
  ...options,
  // ensure a callback to verify RegExp when needed
  isRegexSupported: options.isRegexSupported || (() => true),
  // ensure a callback to modify a DNR rule when needed
  modifyRule: options.modifyRule || (o => o)
});

/**
 * @typedef {Object} Rule see https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-Rule
 * @property {object} action see https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-RuleAction
 * @property {object} condition see https://developer.chrome.com/docs/extensions/reference/declarativeNetRequest/#type-RuleCondition
 * @property {number} id a unique identifier for this rule
 * @property {number?} priority optional priority of the filter
 */

/**
 * Returns an array with DNR Rules if the text is network related, or an Error
 * if no suitable rule can be created.
 * @param {string} text the filter text to convert or the generated error.
 * @returns {Rule[]|FilterParsingError}
 */
function convert(text) {
  const result = parse(text);
  return asDNR.call(this, result);
}

/** Convert a parsed filter to a DeclarativeNetRequest
 *
 * To work properly this function must be bound to an object that
 * has a method `isRegexSupported` that will return whether the RegExp
 * passed as argument is valid or not for DNR. This is necessary as
 * they have to be RE2 expection and this syntax isn't supported by native
 * JavaScript. There is a (native) node module or the Chrome WebExtension
 * API. `createConverter` will provide a default function that always
 * return true.
 *
 * @param {module:filters/index~ParsedFilter} parsedFilter The parsed filter
 *   object.
 * @return {Rule[]|Error}
 */
function asDNR(parsedFilter) {
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
  } = parsedFilter;

  // Sitekey aren't currently handled with DeclarativeNetRequest
  if (sitekeys || header) {
    return new FilterParsingError("filter_unknown_option",
                                  {
                                    option: sitekeys ? "sitekey" : "header",
                                    text
                                  });
  }

  try {
    const urlPattern = new Pattern(regexpSource, matchCase);
    let {pattern: urlFilter} = urlPattern;
    let checkValidRegExp = true;
    let hostname;

    matchCase = urlPattern.matchCase;

    if (urlFilter) {
      // We need to split out the hostname part (if any) of the filter, then
      // decide if it can be matched as lowercase or not.
      let match = /^(\|\||[a-zA-Z]*:\/\/)([^*^?/|]*)(.*)$/.exec(urlFilter);
      if (match) {
        hostname = match[2].toLowerCase();

        urlFilter = match[1] + hostname + match[3];
        matchCase = matchCase ||
                    match[3].length < 2 ||
                    !/[a-zA-Z]/.test(match[3]);
      }

      // The declarativeNetRequest API does not like the urlFilter to have a
      // redundant ||* prefix, so let's strip that now.
      if (urlFilter.startsWith("||*"))
        // Words are that the declarativeNetRequest API does not like
        // the urlFilter to have a redundant ||* prefix. But we need
        // to check this. Keep the '*' for now.
        urlFilter = urlFilter.substr(2);
    }
    else if (urlPattern.regexp) {
      checkValidRegExp = this.isRegexSupported({
        regex: urlPattern.regexp.source,
        isCaseSensitive: matchCase
      });
    }

    if (!checkValidRegExp) {
      return new FilterParsingError("filter_invalid_regexp",
                                    {
                                      regexp: urlPattern.regexp.source,
                                      text
                                    });
    }

    const filter = {
      blocking,
      regexp: urlPattern.regexp,
      contentType: contentType || RESOURCE_TYPES,
      thirdParty,
      rewrite,
      csp,
      domains: domains === null ? null : parseDomains(
        domains.toLowerCase(), "|")
    };

    let result;
    if (contentType & contentTypes.CSP)
      result = generateCSPRules(filter, urlFilter, matchCase);
    else if (!blocking)
      result = generateAllowingRules(filter, urlFilter, matchCase);
    else if (rewrite)
      result = generateRedirectRules(filter, urlFilter, matchCase);
    else
      result = generateBlockingRules(filter, urlFilter, matchCase);

    return result
      .map(this.modifyRule)
      .map(validateRule);
  }
  catch (error) {
    return new FilterParsingError("filter_invalid_regexp",
                                  {regexp: regexpSource, text});
  }
}

exports.asDNR = asDNR;
