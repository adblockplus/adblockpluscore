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

const {createSandbox} = require("./_common");

let contentTypes = null;
let RESOURCE_TYPES = null;
let SPECIAL_TYPES = null;
let enumerateTypes = null;

describe("Content types", function()
{
  beforeEach(function()
  {
    let sandboxedRequire = createSandbox();
    (
      {contentTypes, RESOURCE_TYPES, SPECIAL_TYPES,
       enumerateTypes} = sandboxedRequire("../lib/contentTypes")
    );
  });

  it("Resource types", function()
  {
    // Sanity.
    assert.equal(RESOURCE_TYPES, (1 << 24) - 1,
                 "The resource types should be the first 24 bits");
    for (let type in contentTypes)
    {
      // Note: This is not strictly necessary but these assumptions help us
      // simplify and optimize the code.
      assert.ok(contentTypes[type] > 0,
                `Type "${type}" should be greater than zero`);
      assert.ok(contentTypes[type] < 1 << 31 >>> 0,
                `Type "${type}" should not exceed 2 ** 31 - 1`);
    }
  });

  it("Enumerate types", function()
  {
    let reverseTypeMap = new Map();
    for (let type in contentTypes)
    {
      // Skip backwards compatibility types.
      if (!["BACKGROUND", "XBL", "DTD"].includes(type))
        reverseTypeMap.set(contentTypes[type], type);
    }

    function testEnumerateTypes(types, expected, {selection} = {})
    {
      let contentType = 0;
      for (let type of types.split(","))
        contentType |= contentTypes[type];

      let result = [];
      for (let type of enumerateTypes(contentType, selection))
        result.push(reverseTypeMap.get(type));

      assert.deepEqual(result.join(","), expected);
    }

    // Resource types only.
    testEnumerateTypes("IMAGE,SCRIPT,STYLESHEET", "SCRIPT,IMAGE,STYLESHEET");
    testEnumerateTypes("IMAGE,SCRIPT,STYLESHEET", "SCRIPT,IMAGE,STYLESHEET",
                       {selection: RESOURCE_TYPES});
    testEnumerateTypes("IMAGE,SCRIPT,STYLESHEET", "",
                       {selection: SPECIAL_TYPES});

    // Special types only.
    testEnumerateTypes("CSP,DOCUMENT,GENERICHIDE",
                       "CSP,DOCUMENT,GENERICHIDE");
    testEnumerateTypes("CSP,DOCUMENT,GENERICHIDE", "",
                       {selection: RESOURCE_TYPES});
    testEnumerateTypes("CSP,DOCUMENT,GENERICHIDE",
                       "CSP,DOCUMENT,GENERICHIDE",
                       {selection: SPECIAL_TYPES});

    // Mixed.
    testEnumerateTypes(
      "WEBSOCKET,ELEMHIDE,XMLHTTPREQUEST,GENERICBLOCK,FONT,POPUP",
      "WEBSOCKET,XMLHTTPREQUEST,FONT,POPUP,GENERICBLOCK,ELEMHIDE"
    );
    testEnumerateTypes(
      "WEBSOCKET,ELEMHIDE,XMLHTTPREQUEST,GENERICBLOCK,FONT,POPUP",
      "WEBSOCKET,XMLHTTPREQUEST,FONT",
      {selection: RESOURCE_TYPES}
    );
    testEnumerateTypes(
      "WEBSOCKET,ELEMHIDE,XMLHTTPREQUEST,GENERICBLOCK,FONT,POPUP",
      "POPUP,GENERICBLOCK,ELEMHIDE",
      {selection: SPECIAL_TYPES}
    );

    // None.
    testEnumerateTypes("", "");
    testEnumerateTypes("", "", {selection: RESOURCE_TYPES});
    testEnumerateTypes("", "", {selection: SPECIAL_TYPES});
  });
});
