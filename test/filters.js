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

let parse = null;
let contentTypes = null;
let RESOURCE_TYPES = null;
let FilterParsingError = null;

describe("Filter parse", function() {
  beforeEach(function() {
    let sandboxedRequire = createSandbox();
    (
      ({parse, FilterParsingError} = sandboxedRequire(LIB_FOLDER + "/filters")),
      ({contentTypes, RESOURCE_TYPES} = sandboxedRequire(LIB_FOLDER + "/contentTypes"))
    );
  });

  /** Loosely compare an object. Values not in expected will
   * be treated as being `null`.
   *
   * @param {object} obj the object to compare.
   * @param {object} expected the expected values.
   */
  function compareObject(obj, expected) {
    Object.entries(obj).forEach(([key, value]) => {
      let expectedValue = expected[key];
      if (typeof expectedValue != "undefined")
        assert.deepEqual([key, value], [key, expectedValue]);
      else
        assert.deepStrictEqual([key, value], [key, null]);
    });
  }

  /** Parse and compare the error.
   *
   * @param {string} text the filter text.
   * @param {string} error the error name.
   * @param {object} errorDetail the error detail object.
   */
  function compareParsedError(text, error, errorDetail) {
    let result = parse(text);
    assert(result instanceof FilterParsingError);
    assert.equal(result.message, error);
    // errorDetail MUST contain the text of the filter.
    if (!errorDetail)
      errorDetail = {text};
    else if (!errorDetail.text)
      errorDetail.text = text;
    assert.deepEqual(result.detail, errorDetail);
  }

  /** Parse and compare the result
   *
   * @param {string} text the filter text.
   * @param {object} expected the expected object value for
   * `compareObject`.
   */
  function compareParsed(text, expected) {
    let parsed = parse(text);

    assert(parsed);
    assert(!(parsed instanceof Error));
    compareObject(parsed, expected);
  }

  it("Parses invalid filters", function() {
    compareParsed("/??/", {
      blocking: true,
      text: "/??/",
      regexpSource: "/??/"
    });
    compareParsedError("", "filter_empty");
    compareParsedError("! abracadabra", "invalid");
    compareParsedError("asd$foobar", "filter_unknown_option", {option: "foobar"});
    compareParsedError("||example.com/ad.js$rewrite=abp-resource:noopjs", "filter_invalid_rewrite");
    compareParsedError("||example.com/ad.js$rewrite=noop.js", "filter_invalid_rewrite");
    compareParsedError("||example.com/ad.js$rewrite", "filter_unknown_option", {option: "rewrite"});
    compareParsedError("*/ad.js$rewrite=abp-resource:noopjs", "filter_invalid_rewrite");
    compareParsedError("ad.js$rewrite=abp-resource:noopjs", "filter_invalid_rewrite");
    compareParsedError("||example/ad.js$rewrite=abp-resource:noopjs,third-party", "filter_invalid_rewrite");
    compareParsedError("ads.js$domain=déjàvu.com/ad.js", "filter_invalid_domain");
    compareParsedError("ads.js$domain", "filter_unknown_option", {option: "domain"});
    compareParsedError("blah$csp", "filter_invalid_csp");
    compareParsedError("bla$sitekey", "filter_unknown_option", {option: "sitekey"});
  });

  it("Accept wildcard short filters", function() {
    compareParsed("ab*", {
      blocking: true,
      text: "ab*",
      regexpSource: "ab*"
    });
  });

  it("Parses filters", function() {
    compareParsed("blabla", {
      blocking: true,
      text: "blabla",
      regexpSource: "blabla"
    });

    compareParsed("blabla$image", {
      blocking: true,
      text: "blabla$image",
      regexpSource: "blabla",
      contentType: contentTypes.IMAGE
    });
    compareParsed("blabla$~image", {
      blocking: true,
      text: "blabla$~image",
      regexpSource: "blabla",
      contentType: RESOURCE_TYPES & ~contentTypes.IMAGE
    });

    compareParsed("blabla$image,script", {
      blocking: true,
      text: "blabla$image,script",
      regexpSource: "blabla",
      contentType: contentTypes.IMAGE | contentTypes.SCRIPT
    });

    compareParsed("blabla$image,~script", {
      blocking: true,
      text: "blabla$image,~script",
      regexpSource: "blabla",
      contentType: contentTypes.IMAGE
    });
  });

  it("Parses allowing filters", function() {
    compareParsed("@@blabla$image,script", {
      blocking: false,
      text: "@@blabla$image,script",
      regexpSource: "blabla",
      contentType: contentTypes.IMAGE | contentTypes.SCRIPT
    });
  });

  it("Parses CSP filters", function() {
    compareParsed("blah$csp=unsafe-eval", {
      blocking: true,
      text: "blah$csp=unsafe-eval",
      regexpSource: "blah",
      csp: "unsafe-eval",
      contentType: RESOURCE_TYPES | contentTypes.CSP
    });
  });

  it("Parses header filters", function() {
    compareParsed("||example.com/ad.js$header=content-type=image/png", {
      blocking: true,
      text: "||example.com/ad.js$header=content-type=image/png",
      regexpSource: "||example.com/ad.js",
      contentType: (contentTypes.HEADER | RESOURCE_TYPES),
      header: {
        name: "content-type",
        value: "image/png"
      }
    });

    compareParsed("||example.com/ad.js$header=content-type=", {
      blocking: true,
      text: "||example.com/ad.js$header=content-type=",
      regexpSource: "||example.com/ad.js",
      contentType: (contentTypes.HEADER | RESOURCE_TYPES),
      header: {
        name: "content-type"
      }
    });

    compareParsed("||example.com/ad.js$header=content-type", {
      blocking: true,
      text: "||example.com/ad.js$header=content-type",
      regexpSource: "||example.com/ad.js",
      contentType: (contentTypes.HEADER | RESOURCE_TYPES),
      header: {
        name: "content-type"
      }
    });

    compareParsed("@@example.com/ad.js$header", {
      blocking: false,
      text: "@@example.com/ad.js$header",
      regexpSource: "example.com/ad.js",
      contentType: (contentTypes.HEADER | RESOURCE_TYPES)
    });

    compareParsedError("||example.com/ad.js$header", "filter_invalid_header");
    compareParsedError("||example.com/ad.js$header==foo", "filter_invalid_header");
  });

  it("Parses filter options", function() {
    compareParsed("bla$match-case,csp=first csp,script,other,third-party,domain=FOO.cOm,sitekey=foO", {
      blocking: true,
      text: "bla$match-case,csp=first csp,script,other,third-party,domain=FOO.cOm,sitekey=foO",
      regexpSource: "bla",
      matchCase: true,
      contentType: (contentTypes.SCRIPT | contentTypes.OTHER | contentTypes.CSP),
      thirdParty: true,
      domains: "FOO.cOm",
      sitekeys: "foO",
      csp: "first csp"
    });
  });
});
