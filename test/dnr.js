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

const assert = require("assert");
const {LIB_FOLDER, createSandbox} = require("./_common");

let contentTypes = null;
let RESOURCE_TYPES = null;
let asDNR = null;
let createConverter = null;
let GENERIC_PRIORITY;
let GENERIC_ALLOW_ALL_PRIORITY;
let SPECIFIC_PRIORITY;
let SPECIFIC_ALLOW_ALL_PRIORITY;

const preParsedRule = {
  blocking: false,
  text: null,
  regexpSource: null,
  contentType: null,
  matchCase: null,
  domains: null,
  thirdParty: null,
  sitekeys: null,
  header: null,
  rewrite: null,
  csp: null
};

describe("DeclarativeNetRequest", function() {
  beforeEach(function() {
    let sandboxedRequire = createSandbox();
    (
      ({contentTypes, RESOURCE_TYPES} = sandboxedRequire(LIB_FOLDER + "/contentTypes")),
      ({asDNR, createConverter} = sandboxedRequire(LIB_FOLDER + "/dnr")),
      ({GENERIC_PRIORITY, GENERIC_ALLOW_ALL_PRIORITY,
        SPECIFIC_PRIORITY, SPECIFIC_ALLOW_ALL_PRIORITY} =
       sandboxedRequire(LIB_FOLDER + "/dnr/rules.js"))
    );
    let converter = {
      isRegexSupported: r => true,
      modifyRule: o => o
    };
    asDNR = asDNR.bind(converter);
  });

  it("Returns error for sitekey filters", function() {
    let parsedSitekey = Object.assign(
      {},
      preParsedRule,
      {
        blocking: true,
        text: "abcd$sitekey=SiTeK3y",
        regexpSource: "abcd",
        contentType: RESOURCE_TYPES,
        sitekeys: "SiTeK3y"
      });

    let result = asDNR(parsedSitekey);
    assert(result instanceof Error);
    assert.equal(result.message, "filter_unknown_option");
    assert.equal(result.detail.text, "abcd$sitekey=SiTeK3y");
  });

  it("Returns error for header filters", function() {
    let parsedHeaderFiltering = Object.assign(
      {},
      preParsedRule,
      {
        blocking: true,
        text: "abcd$header=content-type=application/pdf",
        regexpSource: "abcd",
        contentType: RESOURCE_TYPES | contentTypes.HEADER,
        header: {
          name: "content-type",
          value: "application/pdf"
        }
      });

    let result = asDNR(parsedHeaderFiltering);
    assert(result instanceof Error);
    assert.equal(result.message, "filter_unknown_option");
    assert.equal(result.detail.text, "abcd$header=content-type=application/pdf");
  });

  it("Return error for invalid regexp", function() {
    // This converter will reject the case maching /InVaLiD/i regexp
    let converter = createConverter({
      isRegexSupported: re => re.regex != "InVaLiD"
    });

    // This regexp is rejected by parse()
    let result = converter("/??/");
    assert(result instanceof Error);
    assert.equal(result.message, "filter_invalid_regexp");
    assert.equal(result.detail.text, "/??/");

    result = converter("pass");
    assert(!(result instanceof Error));
    assert.equal(result[0].action.type, "block");

    // The regexp is accepted by parse() but not by asDNR()
    result = converter("/InVaLiD/$match-case");
    assert(result instanceof Error);
    assert.equal(result.message, "filter_invalid_regexp");
    assert.equal(result.detail.text, "/InVaLiD/$match-case");
  });

  it("Return error for invalid rewrite", function() {
    let rule = Object.assign(
      {},
      preParsedRule,
      {
        blocking: true,
        text: "||example.com^*/getspot/?spotid=$media,rewrite=abp-resource:blank-mp42,domain=example.com",
        regexpSource: "||example.com^*/getspot/?spotid=",
        contentType: 16384,
        domains: "example.com",
        rewrite: "blank-mp42"
      });

    let result = asDNR(rule);
    assert.equal(result.length, 0);
  });

  it("Convert easylist blocking rules", function() {
    let rule1 = Object.assign(
      {},
      preParsedRule,
      {
        blocking: true,
        text: "-ad-300x600px.",
        regexpSource: "-ad-300x600px."
      });
    let result = asDNR(rule1);
    assert.equal(result.length, 1);
    assert.equal(result[0].priority, GENERIC_PRIORITY);
    assert.equal(result[0].action.type, "block");
    assert.deepEqual(result[0].condition, {urlFilter: "-ad-300x600px.", isUrlFilterCaseSensitive: false});

    let rule2 = Object.assign(
      {},
      preParsedRule,
      {
        blocking: true,
        text: "-adwords.$domain=~consultant-adwords.com|~consultant-adwords.fr|~expert-adwords.com|~freelance-adwords.com|~freelance-adwords.fr",
        regexpSource: "-adwords.",
        domains: "~consultant-adwords.com|~consultant-adwords.fr|~expert-adwords.com|~freelance-adwords.com|~freelance-adwords.fr"
      });
    result = asDNR(rule2);
    assert.equal(result.length, 1);
    assert.equal(result[0].priority, GENERIC_PRIORITY);
    assert.equal(result[0].action.type, "block");
    assert.deepEqual(result[0].condition, {
      urlFilter: "-adwords.",
      isUrlFilterCaseSensitive: false,
      excludedDomains: [
        "consultant-adwords.com",
        "consultant-adwords.fr",
        "expert-adwords.com",
        "freelance-adwords.com",
        "freelance-adwords.fr"
      ]
    });

    let rule3 = Object.assign(
      {},
      preParsedRule,
      {
        blocking: true,
        text: ".openx.$domain=~openx.com|~openx.solar",
        regexpSource: ".openx.",
        domains: "~openx.com|~openx.solar"
      });
    result = asDNR(rule3);
    assert.equal(result.length, 1);
    assert.equal(result[0].priority, GENERIC_PRIORITY);
    assert.equal(result[0].action.type, "block");
    assert.deepEqual(result[0].condition, {
      urlFilter: ".openx.",
      isUrlFilterCaseSensitive: false,
      excludedDomains: [
        "openx.com",
        "openx.solar"
      ]
    });

    let rule4 = Object.assign(
      {},
      preParsedRule,
      {
        blocking: true,
        text: "||contentpass.net/stats?$third-party",
        regexpSource: "||contentpass.net/stats?",
        thirdParty: true
      });
    result = asDNR(rule4);
    assert.equal(result.length, 1);
    assert.equal(result[0].priority, GENERIC_PRIORITY);
    assert.equal(result[0].action.type, "block");
    assert.deepEqual(result[0].condition, {
      urlFilter: "||contentpass.net/stats?",
      isUrlFilterCaseSensitive: false,
      domainType: "thirdParty"
    });
  });

  it("Convert easylist regexp blocking rules", function() {
    let rule = Object.assign(
      {},
      preParsedRule,
      {
        blocking: true,
        text: "/^https?://(.+?.)?anotherexample.com/images/uploads/[a-zA-Z]{6,15}-.*/",
        regexpSource: "/^https?://(.+?.)?anotherexample.com/images/uploads/[a-zA-Z]{6,15}-.*/"
      });
    let result = asDNR(rule);
    assert.equal(result.length, 1);
    assert.equal(result[0].priority, GENERIC_PRIORITY);
    assert.equal(result[0].action.type, "block");
    assert.deepEqual(result[0].condition, {
      regexFilter: "^https?:\\/\\/(.+?.)?anotherexample.com\\/images\\/uploads\\/[a-za-z]{6,15}-.*",
      isUrlFilterCaseSensitive: false
    });
  });

  it("Convert easylist allowing rules", function() {
    let rule1 = Object.assign(
      {},
      preParsedRule,
      {
        blocking: false,
        text: "@@||g.doubleclick.net/gpt/pubads_impl_$script,domain=example.com",
        regexpSource: "||g.doubleclick.net/gpt/pubads_impl_",
        contentType: 2,
        domains: "example.com"
      });
    let result = asDNR(rule1);
    assert.equal(result.length, 1);
    assert.equal(result[0].priority, SPECIFIC_PRIORITY);
    assert.equal(result[0].action.type, "allow");
    assert.deepEqual(result[0].condition, {
      urlFilter: "||g.doubleclick.net/gpt/pubads_impl_",
      isUrlFilterCaseSensitive: false,
      domains: ["example.com"],
      resourceTypes: [
        "script"
      ]
    });

    // popup rules are discarded.
    let rule2 = Object.assign(
      {},
      preParsedRule,
      {
        blocking: false,
        text: "@@||ads.microsoft.com^$popup",
        regexpSource: "||ads.microsoft.com^",
        contentType: 16777216
      });
    result = asDNR(rule2);
    assert.equal(result.length, 0);


    let rule3 = Object.assign(
      {},
      preParsedRule,
      {
        blocking: false,
        text: "@@||optout.exampleadvertising.org^$document",
        regexpSource: "||optout.exampleadvertising.org^",
        contentType: 134217728
      });

    result = asDNR(rule3);
    assert.equal(result.length, 1);
    assert.equal(result[0].priority, SPECIFIC_ALLOW_ALL_PRIORITY);
    assert.equal(result[0].action.type, "allowAllRequests");
    assert.deepEqual(result[0].condition, {
      urlFilter: "||optout.exampleadvertising.org^",
      resourceTypes: [
        "main_frame",
        "sub_frame"
      ]
    });

    let rule4 = Object.assign(
      {},
      preParsedRule,
      {
        blocking: false,
        text: "@@||optout.exampleadvertising.org^$genericblock,document",
        regexpSource: "||optout.exampleadvertising.org^",
        contentType: 402653184
      });

    result = asDNR(rule4);
    assert.equal(result.length, 1);
    assert.equal(result[0].priority, GENERIC_ALLOW_ALL_PRIORITY);
    assert.equal(result[0].action.type, "allowAllRequests");
    assert.deepEqual(result[0].condition, {
      urlFilter: "||optout.exampleadvertising.org^",
      resourceTypes: [
        "main_frame",
        "sub_frame"
      ]
    });
  });

  it("Convert easylist rewrite rules", function() {
    const {resources} = require("../data/resources.js");

    let rule = Object.assign(
      {},
      preParsedRule,
      {
        blocking: true,
        text: "||example.com^*/getspot/?spotid=$media,rewrite=abp-resource:blank-mp3,domain=example.com",
        regexpSource: "||example.com^*/getspot/?spotid=",
        contentType: 16384,
        domains: "example.com",
        rewrite: "blank-mp3"
      });

    let result = asDNR(rule);
    assert.equal(result.length, 1);
    assert.equal(result[0].priority, SPECIFIC_PRIORITY);
    assert.deepEqual(result[0].action, {type: "redirect", redirect: {
      url: resources[rule.rewrite]
    }});
    assert.deepEqual(result[0].condition, {
      urlFilter: "||example.com^*/getspot/?spotid=",
      resourceTypes: ["media"],
      isUrlFilterCaseSensitive: false,
      domains: ["example.com"]
    });
  });

  it("Convert easylist CSP blocking rules", function() {
    let rule = Object.assign(
      {},
      preParsedRule,
      {
        blocking: true,
        text: "||example.com^$csp=script-src 'self' * 'unsafe-inline'",
        regexpSource: "||example.com^",
        contentType: 50331647,
        csp: "script-src 'self' * 'unsafe-inline'"
      });

    let result = asDNR(rule);
    assert.equal(result.length, 1);
    assert.equal(result[0].priority, GENERIC_PRIORITY);
    assert.deepEqual(result[0].condition, {
      urlFilter: "||example.com^",
      resourceTypes: [
        "main_frame",
        "sub_frame"
      ]
    });
    assert.deepEqual(result[0].action, {
      type: "modifyHeaders",
      responseHeaders: [{
        header: "Content-Security-Policy",
        operation: "append",
        value: "script-src 'self' * 'unsafe-inline'"
      }]
    });
  });

  it("Convert easylist CSP allowing rules", function() {
    let rule = Object.assign(
      {},
      preParsedRule,
      {
        blocking: false,
        text: "@@||example.com/login$csp,~third-party",
        regexpSource: "||example.com/login",
        contentType: 50331647,
        thirdParty: false
      });

    let result = asDNR(rule);
    assert.equal(result.length, 1);
    assert.equal(result[0].priority, SPECIFIC_PRIORITY);
    assert.equal(result[0].action.type, "allow");
    assert.deepEqual(result[0].condition, {
      urlFilter: "||example.com/login",
      resourceTypes: [
        "main_frame",
        "sub_frame"
      ],
      isUrlFilterCaseSensitive: false,
      domainType: "firstParty"
    });
  });
});
