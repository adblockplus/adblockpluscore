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

let compareVersions = null;

exports.setUp = function(callback)
{
  let sandboxedRequire = createSandbox();
  (
    {compareVersions} = sandboxedRequire("../lib/versions.js")
  );

  callback();
};

exports.testCompareVersions = function(test)
{
  let checkEqual = (v1, v2) =>
  {
    assert.equal(compareVersions(v1, v2), 0, `${v1} and ${v2} should be equal`);
  };

  // v1 should be less than v2; the function swaps the arguments to check the
  // other way as well.
  let checkNotEqual = (v1, v2) =>
  {
    assert.equal(compareVersions(v1, v2), -1, `${v1} should be less than ${v2}`);
    assert.equal(compareVersions(v2, v1), 1,
                 `${v2} should be greater than ${v1}`);
  };

  let compare = (op, v1, v2) =>
  {
    if (op == "=")
      checkEqual(v1, v2);
    else if (op == "<")
      checkNotEqual(v1, v2);
  };

  compare("=", "1", "1");
  compare("=", "0.1", "0.1");
  compare("=", "0.12", "0.12");
  compare("=", "1.0", "1.0");
  compare("=", "1.0a", "1.0a");
  compare("=", "1.0b1", "1.0b1");
  compare("=", "1.0b1.2749", "1.0b1.2749");
  compare("=", "1.0beta", "1.0beta");
  compare("=", "1.0beta1", "1.0beta1");
  compare("=", "2.1alpha3", "2.1alpha3");

  compare("<", "0.1", "1");
  compare("<", "0.3", "1");
  compare("<", "0.1", "1.0");
  compare("<", "0.3", "1.2");

  compare("<", "1", "2");
  compare("<", "1.1", "2");
  compare("<", "1.2", "2");
  compare("<", "1.4", "2");
  compare("<", "1", "2.0");
  compare("<", "1", "2.1");
  compare("<", "1", "2.3");
  compare("<", "1.1", "2.0");
  compare("<", "1.2", "2.1");
  compare("<", "1.4", "2.3");

  compare("<", "1.0b", "1.0");
  compare("<", "1.0beta", "1.0");

  compare("<", "1.0b1", "1.0");
  compare("<", "1.0beta1", "1.0");

  compare("<", "1.0a", "1.0b");
  compare("<", "1.0alpha", "1.0beta");

  compare("<", "1.0a", "1.0a2");
  compare("<", "1.0alpha", "1.0alpha2");

  compare("<", "1.0a1", "1.0a2");
  compare("<", "1.0alpha1", "1.0alpha2");

  compare("<", "1.0a2", "1.0b1");
  compare("<", "1.0alpha2", "1.0beta1");

  compare("<", "1.0", "1.1b");
  compare("<", "1.0", "1.1beta");

  compare("<", "1.0b", "1.1");
  compare("<", "1.0beta", "1.1");

  compare("<", "1.0b", "1.1a");
  compare("<", "1.0beta", "1.1alpha");

  compare("<", "1.0b1", "1.1a1");
  compare("<", "1.0beta1", "1.1alpha1");

  compare("<", "1.0b3", "1.1a1");
  compare("<", "1.0beta3", "1.1alpha1");

  compare("<", "1.1", "2.0b");
  compare("<", "1.1", "2.0beta");

  compare("<", "1.1b", "2.0");
  compare("<", "1.1beta", "2.0");

  compare("<", "1.1b", "2.0a");
  compare("<", "1.1beta", "2.0alpha");

  compare("<", "1.1b1", "2.0a1");
  compare("<", "1.1beta1", "2.0alpha1");

  compare("<", "1.1b3", "2.0a1");
  compare("<", "1.1beta3", "2.0alpha1");

  compare("<", "1.0b1.2749", "1.0b1.2791");
  compare("<", "1.0b1.2749", "1.0b2.1297");
  compare("<", "1.0a1.9241", "1.0b1.2749");

  test.done();
};
