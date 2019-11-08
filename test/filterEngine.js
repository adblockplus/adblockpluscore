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
const {URL} = require("url");
const {createSandbox} = require("./_common");

describe("filterEngine", function()
{
  let filterEngine = null;
  let defaultMatcher = null;
  let contentTypes = null;
  let elemHide = null;
  let elemHideEmulation = null;
  let snippets = null;
  let Filter = null;

  function checkFilters(...details)
  {
    for (let detail of details)
    {
      let {type, expected} = detail;

      switch (type)
      {
        case "blocking":
          let {resource} = detail;
          let url = new URL(`https://example.com${resource}`);
          let filter = defaultMatcher.matchesAny(url,
                                                 contentTypes.SCRIPT,
                                                 "example.com");
          assert.equal(filter ? filter.text : null, expected);
          break;

        case "elemhide":
          let {selectors} =
            elemHide.generateStyleSheetForDomain("example.com", false, true);
          assert.deepEqual(selectors, expected);
          break;

        case "elemhideemulation":
          let rules = elemHideEmulation.getRulesForDomain("example.com");
          assert.deepEqual(rules.map(({selector}) => selector), expected);
          break;

        case "snippet":
          let filters = snippets.getFiltersForDomain("example.com");
          assert.deepEqual(filters.map(({script}) => script), expected);
          break;

        default:
          assert.fail(`Unknown filter type "${type}"`);
      }
    }
  }

  beforeEach(function()
  {
    let sandboxedRequire = createSandbox();
    (
      {filterEngine} = sandboxedRequire("../lib/filterEngine.js"),
      {defaultMatcher} = sandboxedRequire("../lib/matcher.js"),
      {contentTypes} = sandboxedRequire("../lib/contentTypes.js"),
      {elemHide} = sandboxedRequire("../lib/elemHide.js"),
      {elemHideEmulation} = sandboxedRequire("../lib/elemHideEmulation.js"),
      {snippets} = sandboxedRequire("../lib/snippets.js"),
      {Filter} = sandboxedRequire("../lib/filterClasses.js")
    );
  });

  describe("#add()", function()
  {
    it("should add a filter", function()
    {
      checkFilters({type: "blocking", resource: "/foo.js", expected: null});

      filterEngine.add(Filter.fromText("^foo."));
      checkFilters({
        type: "blocking",
        resource: "/foo.js",
        expected: "^foo."
      });
    });

    it("should add multiple filters", function()
    {
      checkFilters({type: "blocking", resource: "/foo.js", expected: null},
                   {type: "blocking", resource: "/bar.js", expected: null});

      filterEngine.add(Filter.fromText("^foo."));
      checkFilters(
        {
          type: "blocking",
          resource: "/foo.js",
          expected: "^foo."
        },
        {
          type: "blocking",
          resource: "/bar.js",
          expected: null
        }
      );

      filterEngine.add(Filter.fromText("^bar."));
      checkFilters(
        {
          type: "blocking",
          resource: "/foo.js",
          expected: "^foo."
        },
        {
          type: "blocking",
          resource: "/bar.js",
          expected: "^bar."
        }
      );
    });

    it("should add filters of different types", function()
    {
      checkFilters({type: "blocking", resource: "/foo.js", expected: null},
                   {type: "elemhide", expected: []},
                   {type: "elemhideemulation", expected: []},
                   {type: "snippet", expected: []});

      filterEngine.add(Filter.fromText("^foo."));
      checkFilters(
        {
          type: "blocking",
          resource: "/foo.js",
          expected: "^foo." // added
        },
        {
          type: "elemhide",
          expected: []
        },
        {
          type: "elemhideemulation",
          expected: []
        },
        {
          type: "snippet",
          expected: []
        }
      );

      filterEngine.add(Filter.fromText("##.foo"));
      checkFilters(
        {
          type: "blocking",
          resource: "/foo.js",
          expected: "^foo."
        },
        {
          type: "elemhide",
          expected: [".foo"] // added
        },
        {
          type: "elemhideemulation",
          expected: []
        },
        {
          type: "snippet",
          expected: []
        }
      );

      filterEngine.add(Filter.fromText("example.com#?#div:abp-has(> .foo)"));
      checkFilters(
        {
          type: "blocking",
          resource: "/foo.js",
          expected: "^foo."
        },
        {
          type: "elemhide",
          expected: [".foo"]
        },
        {
          type: "elemhideemulation",
          expected: ["div:abp-has(> .foo)"] // added
        },
        {
          type: "snippet",
          expected: []
        }
      );

      filterEngine.add(Filter.fromText("example.com#$#snippet-1"));
      checkFilters(
        {
          type: "blocking",
          resource: "/foo.js",
          expected: "^foo."
        },
        {
          type: "elemhide",
          expected: [".foo"]
        },
        {
          type: "elemhideemulation",
          expected: ["div:abp-has(> .foo)"]
        },
        {
          type: "snippet",
          expected: ["snippet-1"] // added
        }
      );
    });

    it("should do nothing for an existing filter", function()
    {
      checkFilters({type: "blocking", resource: "/foo.js", expected: null});

      filterEngine.add(Filter.fromText("^foo."));
      checkFilters({
        type: "blocking",
        resource: "/foo.js",
        expected: "^foo."
      });

      // Repeat.
      filterEngine.add(Filter.fromText("^foo."));
      checkFilters({
        type: "blocking",
        resource: "/foo.js",
        expected: "^foo."
      });

      filterEngine.remove(Filter.fromText("^foo."));
      checkFilters({type: "blocking", resource: "/foo.js", expected: null});
    });
  });

  describe("#remove()", function()
  {
    beforeEach(function()
    {
      filterEngine.add(Filter.fromText("^foo."));
      filterEngine.add(Filter.fromText("^bar."));
      filterEngine.add(Filter.fromText("##.foo"));
      filterEngine.add(Filter.fromText("example.com#?#div:abp-has(> .foo)"));
      filterEngine.add(Filter.fromText("example.com#$#snippet-1"));
    });

    it("should remove a filter", function()
    {
      checkFilters({
        type: "blocking",
        resource: "/foo.js",
        expected: "^foo."
      });

      filterEngine.remove(Filter.fromText("^foo."));
      checkFilters({type: "blocking", resource: "/foo.js", expected: null});
    });

    it("should remove multiple filters", function()
    {
      checkFilters(
        {
          type: "blocking",
          resource: "/foo.js",
          expected: "^foo."
        },
        {
          type: "blocking",
          resource: "/bar.js",
          expected: "^bar."
        }
      );

      filterEngine.remove(Filter.fromText("^foo."));
      checkFilters(
        {
          type: "blocking",
          resource: "/foo.js",
          expected: null
        },
        {
          type: "blocking",
          resource: "/bar.js",
          expected: "^bar."
        }
      );

      filterEngine.remove(Filter.fromText("^bar."));
      checkFilters({type: "blocking", resource: "/foo.js", expected: null},
                   {type: "blocking", resource: "/bar.js", expected: null});
    });

    it("should remove filters of different types", function()
    {
      checkFilters(
        {
          type: "blocking",
          resource: "/foo.js",
          expected: "^foo."
        },
        {
          type: "elemhide",
          expected: [".foo"]
        },
        {
          type: "elemhideemulation",
          expected: ["div:abp-has(> .foo)"]
        },
        {
          type: "snippet",
          expected: ["snippet-1"]
        }
      );

      filterEngine.remove(Filter.fromText("^foo."));
      checkFilters(
        {
          type: "blocking",
          resource: "/foo.js",
          expected: null // removed
        },
        {
          type: "elemhide",
          expected: [".foo"]
        },
        {
          type: "elemhideemulation",
          expected: ["div:abp-has(> .foo)"]
        },
        {
          type: "snippet",
          expected: ["snippet-1"]
        }
      );

      filterEngine.remove(Filter.fromText("##.foo"));
      checkFilters(
        {
          type: "blocking",
          resource: "/foo.js",
          expected: null
        },
        {
          type: "elemhide",
          expected: [] // removed
        },
        {
          type: "elemhideemulation",
          expected: ["div:abp-has(> .foo)"]
        },
        {
          type: "snippet",
          expected: ["snippet-1"]
        }
      );

      filterEngine.remove(Filter.fromText("example.com#?#div:abp-has(> .foo)"));
      checkFilters(
        {
          type: "blocking",
          resource: "/foo.js",
          expected: null
        },
        {
          type: "elemhide",
          expected: []
        },
        {
          type: "elemhideemulation",
          expected: [] // removed
        },
        {
          type: "snippet",
          expected: ["snippet-1"]
        }
      );

      filterEngine.remove(Filter.fromText("example.com#$#snippet-1"));
      checkFilters(
        {
          type: "blocking",
          resource: "/foo.js",
          expected: null
        },
        {
          type: "elemhide",
          expected: []
        },
        {
          type: "elemhideemulation",
          expected: []
        },
        {
          type: "snippet",
          expected: [] // removed
        }
      );
    });

    it("should do nothing for a non-existing filter", function()
    {
      checkFilters({
        type: "blocking",
        resource: "/foo.js",
        expected: "^foo."
      });

      filterEngine.remove(Filter.fromText("^foo."));
      checkFilters({type: "blocking", resource: "/foo.js", expected: null});

      // Repeat.
      filterEngine.remove(Filter.fromText("^foo."));
      checkFilters({type: "blocking", resource: "/foo.js", expected: null});
    });
  });

  describe("#clear()", function()
  {
    beforeEach(function()
    {
      filterEngine.add(Filter.fromText("^foo."));
      filterEngine.add(Filter.fromText("^bar."));
      filterEngine.add(Filter.fromText("##.foo"));
      filterEngine.add(Filter.fromText("example.com#?#div:abp-has(> .foo)"));
      filterEngine.add(Filter.fromText("example.com#$#snippet-1"));
    });

    it("should clear all filters", function()
    {
      checkFilters(
        {
          type: "blocking",
          resource: "/foo.js",
          expected: "^foo."
        },
        {
          type: "blocking",
          resource: "/bar.js",
          expected: "^bar."
        },
        {
          type: "elemhide",
          expected: [".foo"]
        },
        {
          type: "elemhideemulation",
          expected: ["div:abp-has(> .foo)"]
        },
        {
          type: "snippet",
          expected: ["snippet-1"]
        }
      );

      filterEngine.clear();
      checkFilters({type: "blocking", resource: "/foo.js", expected: null},
                   {type: "blocking", resource: "/bar.js", expected: null},
                   {type: "elemhide", expected: []},
                   {type: "elemhideemulation", expected: []},
                   {type: "snippet", expected: []});
    });

    it("should do nothing if no filters exist", function()
    {
      checkFilters(
        {
          type: "blocking",
          resource: "/foo.js",
          expected: "^foo."
        },
        {
          type: "blocking",
          resource: "/bar.js",
          expected: "^bar."
        },
        {
          type: "elemhide",
          expected: [".foo"]
        },
        {
          type: "elemhideemulation",
          expected: ["div:abp-has(> .foo)"]
        },
        {
          type: "snippet",
          expected: ["snippet-1"]
        }
      );

      filterEngine.clear();
      checkFilters({type: "blocking", resource: "/foo.js", expected: null},
                   {type: "blocking", resource: "/bar.js", expected: null},
                   {type: "elemhide", expected: []},
                   {type: "elemhideemulation", expected: []},
                   {type: "snippet", expected: []});

      // Repeat.
      filterEngine.clear();
      checkFilters({type: "blocking", resource: "/foo.js", expected: null},
                   {type: "blocking", resource: "/bar.js", expected: null},
                   {type: "elemhide", expected: []},
                   {type: "elemhideemulation", expected: []},
                   {type: "snippet", expected: []});
    });
  });
});
