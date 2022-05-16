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

const {contentTypes} = require("../contentTypes");
const {resources} = require("../../data/resources.js");
const {toASCII} = require("punycode");

// We differentiate generic rules from specific ones in order to support the
// conversion of $genericblock exception filters. Since with the
// declarativeNetRequest API "allow" rules take priority over "allowAllRequest"
// rules, we also need to take care to give "allowAllRequest" rules a slighlty
// higher priority.
const GENERIC_PRIORITY = 1000;
exports.GENERIC_PRIORITY = GENERIC_PRIORITY;
const GENERIC_ALLOW_ALL_PRIORITY = 1001;
exports.GENERIC_ALLOW_ALL_PRIORITY = GENERIC_ALLOW_ALL_PRIORITY;
const SPECIFIC_PRIORITY = 2000;
exports.SPECIFIC_PRIORITY = SPECIFIC_PRIORITY;
const SPECIFIC_ALLOW_ALL_PRIORITY = 2001;
exports.SPECIFIC_ALLOW_ALL_PRIORITY = SPECIFIC_ALLOW_ALL_PRIORITY;


const requestTypes = new Map([
  [contentTypes.OTHER, ["other", "csp_report"]],
  [contentTypes.SCRIPT, ["script"]],
  [contentTypes.IMAGE, ["image"]],
  [contentTypes.STYLESHEET, ["stylesheet"]],
  [contentTypes.OBJECT, ["object"]],
  [contentTypes.SUBDOCUMENT, ["sub_frame"]],
  [contentTypes.WEBSOCKET, ["websocket"]],
  [contentTypes.PING, ["ping"]],
  [contentTypes.XMLHTTPREQUEST, ["xmlhttprequest"]],
  [contentTypes.MEDIA, ["media"]],
  [contentTypes.FONT, ["font"]]
]);
exports.requestTypes = requestTypes;

const supportedRequestTypes = Array.from(requestTypes.keys())
                                   .reduce(((srt, t) => srt | t));
exports.supportedRequestTypes = supportedRequestTypes;

function getResourceTypes(filterContentType) {
  // The default is to match everything except "main_frame", which is fine.
  if ((filterContentType & supportedRequestTypes) == supportedRequestTypes)
    return;

  let result = [];

  for (let [mask, types] of requestTypes) {
    if (filterContentType & mask)
      result = result.concat(types);
  }

  return result;
}

function getDomains(filterDomains) {
  let domains = [];
  let excludedDomains = [];
  let isGenericFilter = true;

  if (filterDomains) {
    for (let [domain, enabled] of filterDomains) {
      if (domain == "")
        isGenericFilter = enabled;
      else
        (enabled ? domains : excludedDomains).push(domain);
    }
  }

  return {domains, excludedDomains, isGenericFilter};
}

function getCondition(filter, urlFilter, resourceTypes, matchCase) {
  let condition = {};

  if (urlFilter)
    condition.urlFilter = toASCII(urlFilter);
  else if (filter.regexp)
    condition.regexFilter = toASCII(filter.regexp.source);

  if (resourceTypes)
    condition.resourceTypes = resourceTypes;

  if (!matchCase)
    condition.isUrlFilterCaseSensitive = false;

  if (filter.thirdParty != null)
    condition.domainType = filter.thirdParty ? "thirdParty" : "firstParty";

  let {domains, excludedDomains, isGenericFilter} = getDomains(filter.domains);

  if (domains.length)
    condition.domains = domains;
  if (excludedDomains.length)
    condition.excludedDomains = excludedDomains;

  return [condition, isGenericFilter];
}

exports.generateRedirectRules = function(filter, urlFilter, matchCase) {
  let url = resources[filter.rewrite];

  // We can't generate rules for unknown abp-resources...
  if (!url)
    return [];

  let resourceTypes = getResourceTypes(filter.contentType);

  // We can't generate rules for filters which don't include any supported
  // resource types.
  if (resourceTypes && resourceTypes.length == 0)
    return [];

  let [condition, isGenericFilter] = getCondition(
    filter, urlFilter, resourceTypes, matchCase
  );

  return [{
    priority: isGenericFilter ? GENERIC_PRIORITY : SPECIFIC_PRIORITY,
    condition,
    action: {
      type: "redirect",
      redirect: {url}
    }
  }];
};

exports.generateCSPRules = function(filter, urlFilter, matchCase) {
  let [condition, isGenericFilter] = getCondition(
    filter, urlFilter, ["main_frame", "sub_frame"], matchCase
  );

  let rule;

  if (!filter.blocking) {
    // The DNR makes no distinction between CSP rules and main_frame/sub_frame
    // rules. Ideally, we would give CSP rules a different priority therefore,
    // to ensure that a $csp exception filter would not accidentally allowlist
    // the whole website. Unfortunately, I don't think that's possible if we are
    // to also support the distinction between specific and generic rules.
    //   Luckily, we are adding an "allow" rule (not "allowAllRequest") here and
    // there is no such thing as a blocking filter which applies to the
    // $document (main_frame), so we don't have to worry about that. There is
    // such a thing as a $subdocument blocking filter though, which a $csp
    // exception filter should not usually affect.
    //   As a compromise in order to support both $csp and $genericblock, we
    // accept that $csp exception filters might wrongly prevent frame-blocking
    // filters from matching. If this compromise proves problematic, we might
    // need to reconsider this in the future.
    rule = {
      action: {
        type: "allow"
      },
      condition,
      priority: filter.contentType & contentTypes.GENERICBLOCK ?
                  GENERIC_PRIORITY : SPECIFIC_PRIORITY
    };
  }
  else {
    rule = {
      action: {
        type: "modifyHeaders",
        responseHeaders: [{
          header: "Content-Security-Policy",
          operation: "append",
          value: filter.csp
        }]
      },
      condition,
      priority: isGenericFilter ? GENERIC_PRIORITY : SPECIFIC_PRIORITY
    };
  }

  // Chromium doesn't consider main_frame requests to have initiated from their
  // URL, so the domains/excludedDomains rule conditions won't work as expected
  // for main_frame requests. This is a problem for $csp filters which also use
  // the $domain option. As a partial workaround, we generate a separate
  // urlFilter rule for each domain. But note, we can't support excludedDomains
  // ($csp=...$~domain=...) or urlFilter conditions (||...$csp=...,domain=...).
  // See https://bugs.chromium.org/p/chromium/issues/detail?id=1207326
  //
  // Note: Hopefully, this workaround won't be necessary for long, but if we
  // need it long-term, then perhaps we should generate one rule with a longer
  // regexFilter condition instead. But if we do that, we will need to be
  // careful not to hit the memory limit for regular expression rule conditions
  // and also to match subdomains correctly.
  if (rule.condition.excludedDomains)
    return [];
  if (rule.condition.domains) {
    if (condition.urlFilter)
      return [];

    let {domains} = condition;
    delete condition.domains;

    let rules = [];
    for (let domain of domains) {
      let domainRule = JSON.parse(JSON.stringify(rule));
      domainRule.condition.urlFilter = "||" + domain + "^";
      rules.push(domainRule);
    }

    return rules;
  }

  return [rule];
};

exports.generateBlockingRules = function(filter, urlFilter, matchCase) {
  let resourceTypes = getResourceTypes(filter.contentType);

  // We can't generate rules for filters which don't include any supported
  // resource types.
  if (resourceTypes && resourceTypes.length == 0)
    return [];

  let [condition, isGenericFilter] = getCondition(
    filter, urlFilter, resourceTypes, matchCase
  );

  return [{
    priority: isGenericFilter ? GENERIC_PRIORITY : SPECIFIC_PRIORITY,
    condition,
    action: {
      type: "block"
    }
  }];
};

exports.generateAllowingRules = function(filter, urlFilter, matchCase) {
  let rules = [];
  let {contentType} = filter;

  let genericBlock = contentType & contentTypes.GENERICBLOCK;

  if (contentType & contentTypes.DOCUMENT || genericBlock) {
    contentType &= ~contentTypes.SUBDOCUMENT;

    rules.push({
      priority: genericBlock ?
                  GENERIC_ALLOW_ALL_PRIORITY : SPECIFIC_ALLOW_ALL_PRIORITY,
      condition: getCondition(
        filter, urlFilter, ["main_frame", "sub_frame"], matchCase)[0],
      action: {
        type: "allowAllRequests"
      }
    });
  }

  let resourceTypes = getResourceTypes(contentType);
  if (!resourceTypes || resourceTypes.length) {
    rules.push({
      priority: genericBlock ? GENERIC_PRIORITY : SPECIFIC_PRIORITY,
      condition: getCondition(filter, urlFilter, resourceTypes, matchCase)[0],
      action: {
        type: "allow"
      }
    });
  }

  return rules;
};
