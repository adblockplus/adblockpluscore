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

const {createSandbox} = require("./_common");

let qualifySelector = null;

exports.setUp = function(callback)
{
  let sandboxedRequire = createSandbox();
  (
    {qualifySelector} = sandboxedRequire("../lib/common")
  );

  callback();
};

exports.testQualifySelector = function(test)
{
  test.equal(qualifySelector("div.bar", "#foo"), "div#foo.bar");
  test.equal(qualifySelector("body #foo", "div"), "body div#foo");
  test.equal(qualifySelector(".3bcRuc4 *", "div"), ".3bcRuc4 div");

  test.done();
};
