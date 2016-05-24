/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-2016 Eyeo GmbH
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

GLOBAL.Ci = {};
GLOBAL.Cu = {
  import: function()
  {
  }
};

let {ElemHide} = require("elemHide");
let {Filter} = require("filterClasses");

exports.testGetSelectorsForDomain = function(test)
{
  function fromText(f)
  {
    return (filterText) => f(Filter.fromText(filterText));
  }
  let addFilter = fromText(ElemHide.add);
  let removeFilter = fromText(ElemHide.remove);

  function normalizeSelectors(selectors)
  {
    // getSelectorsForDomain is currently allowed to return duplicate selectors
    // for performance reasons, so we need to remove duplicates here.
    return selectors.sort().filter((selector, index, selectors) =>
    {
      return index == 0 || selector != selectors[index -  1];
    });
  }
  function selectorsEqual(domain, expectedSelectors, specificOnly)
  {
    test.deepEqual(
      normalizeSelectors(ElemHide.getSelectorsForDomain(domain, specificOnly)),
      normalizeSelectors(expectedSelectors)
    );
  }

  selectorsEqual("", []);

  addFilter("~foo.example.com,example.com##foo");
  selectorsEqual("barfoo.example.com", ["foo"]);
  selectorsEqual("bar.foo.example.com", []);
  selectorsEqual("foo.example.com", []);
  selectorsEqual("example.com", ["foo"]);
  selectorsEqual("com", []);
  selectorsEqual("", []);

  addFilter("foo.example.com##turnip");
  selectorsEqual("foo.example.com", ["turnip"]);
  selectorsEqual("example.com", ["foo"]);
  selectorsEqual("com", []);
  selectorsEqual("", []);

  addFilter("example.com#@#foo");
  selectorsEqual("foo.example.com", ["turnip"]);
  selectorsEqual("example.com", []);
  selectorsEqual("com", []);
  selectorsEqual("", []);

  addFilter("com##bar");
  selectorsEqual("foo.example.com", ["turnip", "bar"]);
  selectorsEqual("example.com", ["bar"]);
  selectorsEqual("com", ["bar"]);
  selectorsEqual("", []);

  addFilter("example.com#@#bar");
  selectorsEqual("foo.example.com", ["turnip"]);
  selectorsEqual("example.com", []);
  selectorsEqual("com", ["bar"]);
  selectorsEqual("", []);

  removeFilter("example.com#@#foo");
  selectorsEqual("foo.example.com", ["turnip"]);
  selectorsEqual("example.com", ["foo"]);
  selectorsEqual("com", ["bar"]);
  selectorsEqual("", []);

  removeFilter("example.com#@#bar");
  selectorsEqual("foo.example.com", ["turnip", "bar"]);
  selectorsEqual("example.com", ["foo", "bar"]);
  selectorsEqual("com", ["bar"]);
  selectorsEqual("", []);

  addFilter("##generic");
  selectorsEqual("foo.example.com", ["turnip", "bar", "generic"]);
  selectorsEqual("example.com", ["foo", "bar", "generic"]);
  selectorsEqual("com", ["bar", "generic"]);
  selectorsEqual("", ["generic"]);
  selectorsEqual("foo.example.com", ["turnip", "bar"], true);
  selectorsEqual("example.com", ["foo", "bar"], true);
  selectorsEqual("com", ["bar"], true);
  selectorsEqual("", [], true);
  removeFilter("##generic");

  addFilter("~adblockplus.org##example");
  selectorsEqual("adblockplus.org", []);
  selectorsEqual("", ["example"]);
  selectorsEqual("foo.example.com", ["turnip", "bar", "example"]);
  selectorsEqual("foo.example.com", ["turnip", "bar"], true);
  removeFilter("~adblockplus.org##example");

  removeFilter("~foo.example.com,example.com##foo");
  selectorsEqual("foo.example.com", ["turnip", "bar"]);
  selectorsEqual("example.com", ["bar"]);
  selectorsEqual("com", ["bar"]);
  selectorsEqual("", []);

  removeFilter("com##bar");
  selectorsEqual("foo.example.com", ["turnip"]);
  selectorsEqual("example.com", []);
  selectorsEqual("com", []);
  selectorsEqual("", []);

  removeFilter("foo.example.com##turnip");
  selectorsEqual("foo.example.com", []);
  selectorsEqual("example.com", []);
  selectorsEqual("com", []);
  selectorsEqual("", []);

  addFilter("example.com##dupe");
  addFilter("example.com##dupe");
  selectorsEqual("example.com", ["dupe"]);
  removeFilter("example.com##dupe");
  selectorsEqual("example.com", []);
  removeFilter("example.com##dupe");

  addFilter("~foo.example.com,example.com##foo");

  addFilter("##foo");
  selectorsEqual("foo.example.com", ["foo"]);
  selectorsEqual("example.com", ["foo"]);
  selectorsEqual("com", ["foo"]);
  selectorsEqual("", ["foo"]);
  removeFilter("##foo");

  addFilter("example.org##foo");
  selectorsEqual("foo.example.com", []);
  selectorsEqual("example.com", ["foo"]);
  selectorsEqual("com", []);
  selectorsEqual("", []);
  removeFilter("example.org##foo");

  addFilter("~example.com##foo");
  selectorsEqual("foo.example.com", []);
  selectorsEqual("example.com", ["foo"]);
  selectorsEqual("com", ["foo"]);
  selectorsEqual("", ["foo"]);
  removeFilter("example.org##foo");

  test.done();
};
