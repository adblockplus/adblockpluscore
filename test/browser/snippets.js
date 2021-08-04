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
/* global chai */
/* eslint no-new-func: "off" */

"use strict";

const libraryText = require("raw-loader!../../lib/content/snippets.js");
const {compileScript} = require("../../lib/snippets.js");
const {timeout} = require("./_utils");

const {assert} = chai;

describe("Snippets", function() {
  async function runSnippetScript(script) {
    new Function(compileScript(script, [libraryText]))();

    // For snippets that run in the context of the document via a <script>
    // element (i.e. snippets that use makeInjector()), we need to wait for
    // execution to be complete.
    await timeout(100);
  }

  it("content-script-snippet", async function() {
    window.a = false;
    await runSnippetScript("content-script-snippet a");
    assert.isTrue(window.a);
  });

  it("injected-snippet", async function() {
    window.b = false;
    await runSnippetScript("injected-snippet b");
    assert.isTrue(window.b);
  });
});
