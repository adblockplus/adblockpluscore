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

let filterNotifier = null;
let filterState = null;

beforeEach(function() {
  let sandboxedRequire = createSandbox();
  (
    {filterNotifier} = sandboxedRequire(LIB_FOLDER + "/filterNotifier"),
    {filterState} = sandboxedRequire(LIB_FOLDER + "/filterState")
  );
});

describe("filterState.isEnabled() without subscription", function() {
  context("No state", function() {
    it("should return true for enabled filter", function() {
      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return true after filter's enabled state is reset", function() {
      filterState.resetEnabled("||example.com^");

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return false after filter is disabled", function() {
      filterState.setEnabled("||example.com^", false);

      assert.strictEqual(filterState.isEnabled("||example.com^"), false);
    });

    it("should return true after filter is re-enabled", function() {
      filterState.setEnabled("||example.com^", false);
      filterState.setEnabled("||example.com^", true);

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return false after filter is re-disabled", function() {
      filterState.setEnabled("||example.com^", false);
      filterState.setEnabled("||example.com^", true);
      filterState.setEnabled("||example.com^", false);

      assert.strictEqual(filterState.isEnabled("||example.com^"), false);
    });

    it("should return true after filter is disabled and filter's enabled state is reset", function() {
      filterState.setEnabled("||example.com^", false);
      filterState.resetEnabled("||example.com^");

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return false after filter's enabled state is toggled", function() {
      filterState.toggleEnabled("||example.com^");

      assert.strictEqual(filterState.isEnabled("||example.com^"), false);
    });

    it("should return true after filter's enabled state is re-toggled", function() {
      filterState.toggleEnabled("||example.com^");
      filterState.toggleEnabled("||example.com^");

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return true after filter's enabled state is toggled and reset", function() {
      filterState.toggleEnabled("||example.com^");
      filterState.resetEnabled("||example.com^");

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return true after filter's hit count is reset", function() {
      filterState.resetHitCount("||example.com^");

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return true after filter's hit count is set to 1", function() {
      filterState.setHitCount("||example.com^", 1);

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return false after filter's hit count is set to 1 and filter is disabled", function() {
      filterState.setHitCount("||example.com^", 1);
      filterState.setEnabled("||example.com^", false);

      assert.strictEqual(filterState.isEnabled("||example.com^"), false);
    });

    it("should return false after filter's hit count is set to 1, filter is disabled, and filter's hit count is reset", function() {
      filterState.setHitCount("||example.com^", 1);
      filterState.setEnabled("||example.com^", false);
      filterState.resetHitCount("||example.com^");

      assert.strictEqual(filterState.isEnabled("||example.com^"), false);
    });

    it("should return true after filter's last hit time is reset", function() {
      filterState.resetLastHit("||example.com^");

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return true after filter's last hit time is set to 946684800000", function() {
      filterState.setLastHit("||example.com^", 946684800000);

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return false after filter's last hit time is set to 946684800000 and filter is disabled", function() {
      filterState.setLastHit("||example.com^", 946684800000);
      filterState.setEnabled("||example.com^", false);

      assert.strictEqual(filterState.isEnabled("||example.com^"), false);
    });

    it("should return false after filter's last hit time is set to 946684800000, filter is disabled, and filter's last hit time is reset", function() {
      filterState.setLastHit("||example.com^", 946684800000);
      filterState.setEnabled("||example.com^", false);
      filterState.resetLastHit("||example.com^");

      assert.strictEqual(filterState.isEnabled("||example.com^"), false);
    });

    it("should return true after filter hits are reset", function() {
      filterState.resetHits("||example.com^");

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return true after filter hit is registered", function() {
      filterState.registerHit("||example.com^");

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return false after filter hit is registered and filter is disabled", function() {
      filterState.registerHit("||example.com^");
      filterState.setEnabled("||example.com^", false);

      assert.strictEqual(filterState.isEnabled("||example.com^"), false);
    });

    it("should return false after filter hit is registered, filter is disabled, and filter hits are reset", function() {
      filterState.registerHit("||example.com^");
      filterState.setEnabled("||example.com^", false);
      filterState.resetHits("||example.com^");

      assert.strictEqual(filterState.isEnabled("||example.com^"), false);
    });

    it("should return true after filter state is reset", function() {
      filterState.reset("||example.com^");

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return true after filter is disabled and filter state is reset", function() {
      filterState.setEnabled("||example.com^", false);
      filterState.reset("||example.com^");

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return true after filter state is serialized", function() {
      [...filterState.serialize("||example.com^")];

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return false after filter is disabled and filter state is serialized", function() {
      filterState.setEnabled("||example.com^", false);
      [...filterState.serialize("||example.com^")];

      assert.strictEqual(filterState.isEnabled("||example.com^"), false);
    });

    it("should return true after filter state is serialized and filter is re-enabled", function() {
      filterState.setEnabled("||example.com^", false);
      [...filterState.serialize("||example.com^")];
      filterState.setEnabled("||example.com^", true);

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });
  });

  context("State: disabled = true", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {disabled: true});
    });

    it("should return false for disabled filter", function() {
      assert.strictEqual(filterState.isEnabled("||example.com^"), false);
    });

    it("should return true after filter's enabled state is reset", function() {
      filterState.resetEnabled("||example.com^");

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return true after filter is enabled", function() {
      filterState.setEnabled("||example.com^", true);

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return false after filter is re-disabled", function() {
      filterState.setEnabled("||example.com^", true);
      filterState.setEnabled("||example.com^", false);

      assert.strictEqual(filterState.isEnabled("||example.com^"), false);
    });

    it("should return true after filter is re-enabled", function() {
      filterState.setEnabled("||example.com^", true);
      filterState.setEnabled("||example.com^", false);
      filterState.setEnabled("||example.com^", true);

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return true after filter is enabled and filter's enabled state is reset", function() {
      filterState.setEnabled("||example.com^", true);
      filterState.resetEnabled("||example.com^");

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return true after filter's enabled state is toggled", function() {
      filterState.toggleEnabled("||example.com^");

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return false after filter's enabled state is re-toggled", function() {
      filterState.toggleEnabled("||example.com^");
      filterState.toggleEnabled("||example.com^");

      assert.strictEqual(filterState.isEnabled("||example.com^"), false);
    });

    it("should return true after filter's enabled state is toggled and reset", function() {
      filterState.toggleEnabled("||example.com^");
      filterState.resetEnabled("||example.com^");

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return false after filter's hit count is reset", function() {
      filterState.resetHitCount("||example.com^");

      assert.strictEqual(filterState.isEnabled("||example.com^"), false);
    });

    it("should return false after filter's hit count is set to 1", function() {
      filterState.setHitCount("||example.com^", 1);

      assert.strictEqual(filterState.isEnabled("||example.com^"), false);
    });

    it("should return true after filter's hit count is set to 1 and filter is enabled", function() {
      filterState.setHitCount("||example.com^", 1);
      filterState.setEnabled("||example.com^", true);

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return true after filter's hit count is set to 1, filter is enabled, and filter's hit count is reset", function() {
      filterState.setHitCount("||example.com^", 1);
      filterState.setEnabled("||example.com^", true);
      filterState.resetHitCount("||example.com^");

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return false after filter's last hit time is reset", function() {
      filterState.resetLastHit("||example.com^");

      assert.strictEqual(filterState.isEnabled("||example.com^"), false);
    });

    it("should return false after filter's last hit time is set to 946684800000", function() {
      filterState.setLastHit("||example.com^", 946684800000);

      assert.strictEqual(filterState.isEnabled("||example.com^"), false);
    });

    it("should return true after filter's last hit time is set to 946684800000 and filter is enabled", function() {
      filterState.setLastHit("||example.com^", 946684800000);
      filterState.setEnabled("||example.com^", true);

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return true after filter's last hit time is set to 946684800000, filter is enabled, and filter's last hit time is reset", function() {
      filterState.setLastHit("||example.com^", 946684800000);
      filterState.setEnabled("||example.com^", true);
      filterState.resetLastHit("||example.com^");

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return false after filter hits are reset", function() {
      filterState.resetHits("||example.com^");

      assert.strictEqual(filterState.isEnabled("||example.com^"), false);
    });

    it("should return false after filter hit is registered", function() {
      filterState.registerHit("||example.com^");

      assert.strictEqual(filterState.isEnabled("||example.com^"), false);
    });

    it("should return true after filter hit is registered and filter is enabled", function() {
      filterState.registerHit("||example.com^");
      filterState.setEnabled("||example.com^", true);

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return true after filter hit is registered, filter is enabled, and filter hits are reset", function() {
      filterState.registerHit("||example.com^");
      filterState.setEnabled("||example.com^", true);
      filterState.resetHits("||example.com^");

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return true after filter state is reset", function() {
      filterState.reset("||example.com^");

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return true after filter is enabled and filter state is reset", function() {
      filterState.setEnabled("||example.com^", true);
      filterState.reset("||example.com^");

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return false after filter state is serialized", function() {
      [...filterState.serialize("||example.com^")];

      assert.strictEqual(filterState.isEnabled("||example.com^"), false);
    });

    it("should return true after filter is enabled and filter state is serialized", function() {
      filterState.setEnabled("||example.com^", true);
      [...filterState.serialize("||example.com^")];

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return false after filter state is serialized and filter is re-disabled", function() {
      filterState.setEnabled("||example.com^", true);
      [...filterState.serialize("||example.com^")];
      filterState.setEnabled("||example.com^", false);

      assert.strictEqual(filterState.isEnabled("||example.com^"), false);
    });
  });

  context("State: disabledSubscriptions = ['~user']", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {disabledSubscriptions: ["~user"]});
    });

    it("should return true for disabled filter", function() {
      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return false after filter is disabled globally", function() {
      filterState.setEnabled("||example.com^", false);

      assert.strictEqual(filterState.isEnabled("||example.com^"), false);
    });
  });
});

describe("filterState.isDisabledForSubscription()", function() {
  context("No state", function() {
    it("should return false for enabled filter", function() {
      assert.strictEqual(filterState.isDisabledForSubscription("||example.com^", "~user"), false);
    });

    it("should return false after filter's enabled state is reset", function() {
      filterState.resetEnabled("||example.com^");

      assert.strictEqual(filterState.isDisabledForSubscription("||example.com^", "~user"), false);
    });

    it("should return true after filter is disabled", function() {
      filterState.setDisabledForSubscription("||example.com^", "~user", true);

      assert.strictEqual(filterState.isDisabledForSubscription("||example.com^", "~user"), true);
    });

    it("should return false after filter is disabled for a different subscription", function() {
      filterState.setDisabledForSubscription("||example.com^", "~user", true);

      assert.strictEqual(filterState.isDisabledForSubscription("||example.com^", "~easylist"), false);
    });

    it("should still return true for isEnabled without a subscription if a filter is disabled for a specified subscription", function() {
      filterState.setDisabledForSubscription("||example.com^", "~user", false);

      assert.strictEqual(filterState.isEnabled("||example.com^"), true);
    });

    it("should return false after filter is re-enabled", function() {
      filterState.setDisabledForSubscription("||example.com^", "~user", true);
      filterState.setDisabledForSubscription("||example.com^", "~user", false);

      assert.strictEqual(filterState.isDisabledForSubscription("||example.com^", "~user"), false);
    });

    it("should return true after filter is re-disabled", function() {
      filterState.setDisabledForSubscription("||example.com^", "~user", true);
      filterState.setDisabledForSubscription("||example.com^", "~easylist", true);
      filterState.setDisabledForSubscription("||example.com^", "~user", false);
      filterState.setDisabledForSubscription("||example.com^", "~easylist", false);
      filterState.setDisabledForSubscription("||example.com^", "~user", true);

      assert.strictEqual(filterState.isDisabledForSubscription("||example.com^", "~user"), true);
      assert.strictEqual(filterState.isDisabledForSubscription("||example.com^", "~easylist"), false);
    });

    it("should return false after filter is disabled and filter's enabled state is reset", function() {
      filterState.setDisabledForSubscription("||example.com^", "~user", true);
      filterState.resetEnabled("||example.com^");

      assert.strictEqual(filterState.isDisabledForSubscription("||example.com^", "~user"), false);
    });
  });

  context("State: disabled = true, for migrating from old disabling method", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {disabled: true});
    });

    it("should return true for disabled filter", function() {
      assert.strictEqual(filterState.isDisabledForSubscription("||example.com^", "~user"), true);
    });

    it("should return false after filter is enabled", function() {
      filterState.setDisabledForSubscription("||example.com^", "~user", false);

      assert.strictEqual(filterState.isDisabledForSubscription("||example.com^", "~user"), false);
    });

    it("should only disable one subscription if disable is called again", function() {
      filterState.setDisabledForSubscription("||example.com^", "~user", true);

      assert.strictEqual(filterState.isDisabledForSubscription("||example.com^", "~user"), true);
      assert.strictEqual(filterState.isDisabledForSubscription("||example.com^", "~easylist"), false);
    });
  });

  context("State: disabledSubscriptions = ['~user']", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {disabledSubscriptions: ["~user"]});
    });

    it("should return true for disabled filter", function() {
      assert.strictEqual(filterState.isDisabledForSubscription("||example.com^", "~user"), true);
    });

    it("should return false for disabled filter on other subscriptions", function() {
      assert.strictEqual(filterState.isDisabledForSubscription("||example.com^", "~easylist"), false);
    });

    it("should return false after filter's enabled state is reset", function() {
      filterState.resetEnabled("||example.com^");

      assert.strictEqual(filterState.isDisabledForSubscription("||example.com^", "~user"), false);
    });

    it("should return false after filter is enabled", function() {
      filterState.setDisabledForSubscription("||example.com^", "~user", false);

      assert.strictEqual(filterState.isDisabledForSubscription("||example.com^", "~user"), false);
    });

    it("should return true after filter is re-disabled", function() {
      filterState.setDisabledForSubscription("||example.com^", "~user", false);
      filterState.setDisabledForSubscription("||example.com^", "~user", true);

      assert.strictEqual(filterState.isDisabledForSubscription("||example.com^", "~user"), true);
    });

    it("should return false after filter is re-enabled", function() {
      filterState.setDisabledForSubscription("||example.com^", "~user", false);
      filterState.setDisabledForSubscription("||example.com^", "~user", true);
      filterState.setDisabledForSubscription("||example.com^", "~user", false);

      assert.strictEqual(filterState.isDisabledForSubscription("||example.com^", "~user"), false);
    });

    it("should return false after filter is enabled and filter's enabled state is reset", function() {
      filterState.setDisabledForSubscription("||example.com^", "~user", false);
      filterState.resetEnabled("||example.com^");

      assert.strictEqual(filterState.isDisabledForSubscription("||example.com^", "~user"), false);
    });
  });
});

describe("filterState.setEnabled() without subscription", function() {
  let events = null;

  function checkEvents(func, expectedEvents = []) {
    events = [];

    func();

    assert.deepEqual(events, expectedEvents);
  }

  beforeEach(function() {
    let sandboxedRequire = createSandbox();
    (
      {filterState} = sandboxedRequire(LIB_FOLDER + "/filterState"),
      {filterNotifier} = sandboxedRequire(LIB_FOLDER + "/filterNotifier")
    );

    filterNotifier.on("filterState.enabled", (...args) => events.push(args));
  });

  context("No state", function() {
    it("should emit filterState.enabled when filter is disabled", function() {
      checkEvents(() => filterState.setEnabled("||example.com^", false),
                  [["||example.com^", false, true]]);
    });

    it("should not emit filterState.enabled when filter is enabled", function() {
      checkEvents(() => filterState.setEnabled("||example.com^", true));
    });

    it("should emit filterState.enabled when filter is re-enabled", function() {
      filterState.setEnabled("||example.com^", false);

      checkEvents(() => filterState.setEnabled("||example.com^", true),
                  [["||example.com^", true, false]]);
    });

    it("should emit filterState.enabled when filter is re-disabled", function() {
      filterState.setEnabled("||example.com^", false);
      filterState.setEnabled("||example.com^", true);

      checkEvents(() => filterState.setEnabled("||example.com^", false),
                  [["||example.com^", false, true]]);
    });

    it("should emit filterState.enabled when filter is disabled after filter's enabled state is reset", function() {
      filterState.resetEnabled("||example.com^");

      checkEvents(() => filterState.setEnabled("||example.com^", false),
                  [["||example.com^", false, true]]);
    });

    it("should not emit filterState.enabled when filter is disabled after filter's enabled state is toggled", function() {
      filterState.toggleEnabled("||example.com^");

      checkEvents(() => filterState.setEnabled("||example.com^", false));
    });

    it("should emit filterState.enabled when filter is disabled after filter's hit count is set to 1", function() {
      filterState.setHitCount("||example.com^", 1);

      checkEvents(() => filterState.setEnabled("||example.com^", false),
                  [["||example.com^", false, true]]);
    });

    it("should emit filterState.enabled when filter is disabled after filter's hit count is reset", function() {
      filterState.resetHitCount("||example.com^");

      checkEvents(() => filterState.setEnabled("||example.com^", false),
                  [["||example.com^", false, true]]);
    });

    it("should emit filterState.enabled when filter is disabled after filter's last hit time is set to 946684800000", function() {
      filterState.setLastHit("||example.com^", 946684800000);

      checkEvents(() => filterState.setEnabled("||example.com^", false),
                  [["||example.com^", false, true]]);
    });

    it("should emit filterState.enabled when filter is disabled after filter's last hit time is reset", function() {
      filterState.resetLastHit("||example.com^");

      checkEvents(() => filterState.setEnabled("||example.com^", false),
                  [["||example.com^", false, true]]);
    });

    it("should emit filterState.enabled when filter is disabled after filter hit is registered", function() {
      filterState.registerHit("||example.com^");

      checkEvents(() => filterState.setEnabled("||example.com^", false),
                  [["||example.com^", false, true]]);
    });

    it("should emit filterState.enabled when filter is disabled after filter hits are reset", function() {
      filterState.resetHits("||example.com^");

      checkEvents(() => filterState.setEnabled("||example.com^", false),
                  [["||example.com^", false, true]]);
    });

    it("should emit filterState.enabled when filter is disabled after filter state is reset", function() {
      filterState.reset("||example.com^");

      checkEvents(() => filterState.setEnabled("||example.com^", false),
                  [["||example.com^", false, true]]);
    });

    it("should emit filterState.enabled when filter is disabled after filter state is serialized", function() {
      [...filterState.serialize("||example.com^")];

      checkEvents(() => filterState.setEnabled("||example.com^", false),
                  [["||example.com^", false, true]]);
    });
  });

  context("State: disabled = true", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {disabled: true});
    });

    it("should emit filterState.enabled when filter is enabled", function() {
      checkEvents(() => filterState.setEnabled("||example.com^", true),
                  [["||example.com^", true, false]]);
    });

    it("should not emit filterState.enabled when filter is disabled", function() {
      checkEvents(() => filterState.setEnabled("||example.com^", false));
    });

    it("should emit filterState.enabled when filter is re-disabled", function() {
      filterState.setEnabled("||example.com^", true);

      checkEvents(() => filterState.setEnabled("||example.com^", false),
                  [["||example.com^", false, true]]);
    });

    it("should emit filterState.enabled when filter is re-enabled", function() {
      filterState.setEnabled("||example.com^", true);
      filterState.setEnabled("||example.com^", false);

      checkEvents(() => filterState.setEnabled("||example.com^", true),
                  [["||example.com^", true, false]]);
    });

    it("should not emit filterState.enabled when filter is enabled for a subscription", function() {
      checkEvents(() => filterState.setDisabledForSubscription("||example.com^", "~user", false),
                  [["||example.com^", true, false]]);
    });

    it("should not emit filterState.enabled when filter is enabled after filter's enabled state is reset", function() {
      filterState.resetEnabled("||example.com^");

      checkEvents(() => filterState.setEnabled("||example.com^", true));
    });

    it("should not emit filterState.enabled when filter is enabled after filter's enabled state is toggled", function() {
      filterState.toggleEnabled("||example.com^");

      checkEvents(() => filterState.setEnabled("||example.com^", true));
    });

    it("should emit filterState.enabled when filter is enabled after filter's hit count is set to 1", function() {
      filterState.setHitCount("||example.com^", 1);

      checkEvents(() => filterState.setEnabled("||example.com^", true),
                  [["||example.com^", true, false]]);
    });

    it("should emit filterState.enabled when filter is enabled after filter's hit count is reset", function() {
      filterState.resetHitCount("||example.com^");

      checkEvents(() => filterState.setEnabled("||example.com^", true),
                  [["||example.com^", true, false]]);
    });

    it("should emit filterState.enabled when filter is enabled after filter's last hit time is set to 946684800000", function() {
      filterState.setLastHit("||example.com^", 946684800000);

      checkEvents(() => filterState.setEnabled("||example.com^", true),
                  [["||example.com^", true, false]]);
    });

    it("should emit filterState.enabled when filter is enabled after filter's last hit time is reset", function() {
      filterState.resetLastHit("||example.com^");

      checkEvents(() => filterState.setEnabled("||example.com^", true),
                  [["||example.com^", true, false]]);
    });

    it("should emit filterState.enabled when filter is enabled after filter hit is registered", function() {
      filterState.registerHit("||example.com^");

      checkEvents(() => filterState.setEnabled("||example.com^", true),
                  [["||example.com^", true, false]]);
    });

    it("should emit filterState.enabled when filter is enabled after filter hits are reset", function() {
      filterState.resetHits("||example.com^");

      checkEvents(() => filterState.setEnabled("||example.com^", true),
                  [["||example.com^", true, false]]);
    });

    it("should not emit filterState.enabled when filter is enabled after filter state is reset", function() {
      filterState.reset("||example.com^");

      checkEvents(() => filterState.setEnabled("||example.com^", true));
    });

    it("should emit filterState.enabled when filter is enabled after filter state is serialized", function() {
      [...filterState.serialize("||example.com^")];

      checkEvents(() => filterState.setEnabled("||example.com^", true),
                  [["||example.com^", true, false]]);
    });
  });

  context("State: disabledSubscriptions = ['~user']", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {disabledSubscriptions: ["~user"]});
    });

    it("should not emit filterState.enabled when filter is enabled", function() {
      checkEvents(() => filterState.setEnabled("||example.com^", true),
                  []);
    });

    it("should emit filterState.enabled when filter is disabled", function() {
      checkEvents(() => filterState.setEnabled("||example.com^", false),
                  [["||example.com^", false, true]]);
    });
  });
});

describe("filterState.setDisabledForSubscription()", function() {
  let events = null;

  function checkEvents(func, expectedEvents = []) {
    events = [];

    func();

    assert.deepEqual(events, expectedEvents);
  }

  beforeEach(function() {
    let sandboxedRequire = createSandbox();
    (
      {filterState} = sandboxedRequire(LIB_FOLDER + "/filterState"),
      {filterNotifier} = sandboxedRequire(LIB_FOLDER + "/filterNotifier")
    );

    filterNotifier.on("filterState.disabledSubscriptions", (...args) => events.push(args));
  });

  context("No state", function() {
    it("should emit filterState.disabledSubscriptions when filter is disabled", function() {
      checkEvents(() => filterState.setDisabledForSubscription("||example.com^", "~user", true),
                  [["||example.com^", new Set(["~user"]), new Set()]]);
    });

    it("should emit filterState.disabledSubscriptions when filter is reenabled for one subscription", function() {
      filterState.setDisabledForSubscription("||example.com^", "~user", true);
      filterState.setDisabledForSubscription("||example.com^", "~easylist", true);
      checkEvents(() => filterState.setDisabledForSubscription("||example.com^", "~user", false),
                  [["||example.com^", new Set(["~easylist"]), new Set(["~user", "~easylist"])]]);
    });

    it("should not emit filterState.disabledSubscriptions when filter is enabled", function() {
      checkEvents(() => filterState.setDisabledForSubscription("||example.com^", "~user", false));
    });

    it("should emit filterState.disabledSubscriptions when filter is re-enabled", function() {
      filterState.setDisabledForSubscription("||example.com^", "~user", true);

      checkEvents(() => filterState.setDisabledForSubscription("||example.com^", "~user", false),
                  [["||example.com^", new Set(), new Set(["~user"])]]);
    });

    it("should emit filterState.disabledSubscriptions when filter is re-disabled", function() {
      filterState.setDisabledForSubscription("||example.com^", "~user", true);
      filterState.setDisabledForSubscription("||example.com^", "~user", false);

      checkEvents(() => filterState.setDisabledForSubscription("||example.com^", "~user", true),
                  [["||example.com^", new Set(["~user"]), new Set()]]);
    });

    it("should emit filterState.disabledSubscriptions when filter is disabled after filter's enabled state is reset", function() {
      filterState.resetEnabled("||example.com^");

      checkEvents(() => filterState.setDisabledForSubscription("||example.com^", "~user", true),
                  [["||example.com^", new Set(["~user"]), new Set()]]);
    });

    it("should emit filterState.disabledSubscriptions when filter is disabled after filter state is reset", function() {
      filterState.setDisabledForSubscription("||example.com^", "~user", true);
      filterState.reset("||example.com^");

      checkEvents(() => filterState.setDisabledForSubscription("||example.com^", "~user", true),
                  [["||example.com^", new Set(["~user"]), new Set()]]);
    });
  });

  context("State: disabled = true", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {disabled: true});
    });

    it("should not emit filterState.disabledSubscriptions when filter is enabled", function() {
      checkEvents(() => filterState.setDisabledForSubscription("||example.com^", "~user", false),
                  []);
    });

    it("should emit filterState.disabledSubscriptions when filter is disabled for a specific subscription", function() {
      checkEvents(() => filterState.setDisabledForSubscription("||example.com^", "~user", true),
                  [["||example.com^", new Set(["~user"]), new Set()]]);
    });
  });

  context("State: disabledSubscriptions = ['~user']", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {disabledSubscriptions: ["~user"]});
    });

    it("should emit filterState.disabledSubscriptions when filter is enabled", function() {
      checkEvents(() => filterState.setDisabledForSubscription("||example.com^", "~user", false),
                  [["||example.com^", new Set(), new Set(["~user"])]]);
    });

    it("should emit filterState.disabledSubscriptions when filter is disabled for a second subscription", function() {
      checkEvents(() => filterState.setDisabledForSubscription("||example.com^", "~easylist", true),
                  [["||example.com^", new Set(["~user", "~easylist"]), new Set(["~user"])]]);
    });

    it("should not emit filterState.disabledSubscriptions when filter is disabled", function() {
      checkEvents(() => filterState.setDisabledForSubscription("||example.com^", "~user", true));
    });

    it("should emit filterState.disabledSubscriptions when filter is re-disabled", function() {
      filterState.setDisabledForSubscription("||example.com^", "~user", false);

      checkEvents(() => filterState.setDisabledForSubscription("||example.com^", "~user", true),
                  [["||example.com^", new Set(["~user"]), new Set()]]);
    });

    it("should emit filterState.disabledSubscriptions when filter is re-enabled", function() {
      filterState.setDisabledForSubscription("||example.com^", "~user", false);
      filterState.setDisabledForSubscription("||example.com^", "~user", true);

      checkEvents(() => filterState.setDisabledForSubscription("||example.com^", "~user", false),
                  [["||example.com^", new Set(), new Set(["~user"])]]);
    });

    it("should not emit filterState.disabledSubscriptions when filter is enabled after filter's enabled state is reset", function() {
      filterState.resetEnabled("||example.com^");

      checkEvents(() => filterState.setDisabledForSubscription("||example.com^", "~user", false));
    });

    it("should not emit filterState.disabledSubscriptions when filter is enabled after filter state is reset", function() {
      filterState.reset("||example.com^");

      checkEvents(() => filterState.setDisabledForSubscription("||example.com^", "~user", false));
    });
  });
});

describe("filterState.toggleEnabled()", function() {
  let events = null;

  function checkEvents(func, expectedEvents = []) {
    events = [];

    func();

    assert.deepEqual(events, expectedEvents);
  }

  beforeEach(function() {
    let sandboxedRequire = createSandbox();
    (
      {filterState} = sandboxedRequire(LIB_FOLDER + "/filterState"),
      {filterNotifier} = sandboxedRequire(LIB_FOLDER + "/filterNotifier")
    );

    filterNotifier.on("filterState.enabled", (...args) => events.push(args));
  });

  context("No state", function() {
    it("should emit filterState.enabled when filter's enabled state is toggled", function() {
      checkEvents(() => filterState.toggleEnabled("||example.com^"),
                  [["||example.com^", false, true]]);
    });

    it("should emit filterState.enabled when filter's enabled state is re-toggled", function() {
      filterState.toggleEnabled("||example.com^");

      checkEvents(() => filterState.toggleEnabled("||example.com^"),
                  [["||example.com^", true, false]]);
    });

    it("should emit filterState.enabled when filter's enabled state is toggled after filter is disabled", function() {
      filterState.setEnabled("||example.com^", false);

      checkEvents(() => filterState.toggleEnabled("||example.com^"),
                  [["||example.com^", true, false]]);
    });

    it("should emit filterState.enabled when filter's enabled state is toggled after filter's enabled state is reset", function() {
      filterState.resetEnabled("||example.com^");

      checkEvents(() => filterState.toggleEnabled("||example.com^"),
                  [["||example.com^", false, true]]);
    });

    it("should emit filterState.enabled when filter's enabled state is toggled after filter's hit count is set to 1", function() {
      filterState.setHitCount("||example.com^", 1);

      checkEvents(() => filterState.toggleEnabled("||example.com^"),
                  [["||example.com^", false, true]]);
    });

    it("should emit filterState.enabled when filter's enabled state is toggled after filter's hit count is reset", function() {
      filterState.resetHitCount("||example.com^");

      checkEvents(() => filterState.toggleEnabled("||example.com^"),
                  [["||example.com^", false, true]]);
    });

    it("should emit filterState.enabled when filter's enabled state is toggled after filter's last hit time is set to 946684800000", function() {
      filterState.setLastHit("||example.com^", 946684800000);

      checkEvents(() => filterState.toggleEnabled("||example.com^"),
                  [["||example.com^", false, true]]);
    });

    it("should emit filterState.enabled when filter's enabled state is toggled after filter's last hit time is reset", function() {
      filterState.resetLastHit("||example.com^");

      checkEvents(() => filterState.toggleEnabled("||example.com^"),
                  [["||example.com^", false, true]]);
    });

    it("should emit filterState.enabled when filter's enabled state is toggled after filter hit is registered", function() {
      filterState.registerHit("||example.com^");

      checkEvents(() => filterState.toggleEnabled("||example.com^"),
                  [["||example.com^", false, true]]);
    });

    it("should emit filterState.enabled when filter's enabled state is toggled after filter hits are reset", function() {
      filterState.resetHits("||example.com^");

      checkEvents(() => filterState.toggleEnabled("||example.com^"),
                  [["||example.com^", false, true]]);
    });

    it("should emit filterState.enabled when filter's enabled state is toggled after filter state is reset", function() {
      filterState.reset("||example.com^");

      checkEvents(() => filterState.toggleEnabled("||example.com^"),
                  [["||example.com^", false, true]]);
    });

    it("should emit filterState.enabled when filter's enabled state is toggled after filter state is serialized", function() {
      [...filterState.serialize("||example.com^")];

      checkEvents(() => filterState.toggleEnabled("||example.com^"),
                  [["||example.com^", false, true]]);
    });
  });

  context("State: disabled = true", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {disabled: true});
    });

    it("should emit filterState.enabled when filter's enabled state is toggled", function() {
      checkEvents(() => filterState.toggleEnabled("||example.com^"),
                  [["||example.com^", true, false]]);
    });

    it("should emit filterState.enabled when filter's enabled state is re-toggled", function() {
      filterState.toggleEnabled("||example.com^");

      checkEvents(() => filterState.toggleEnabled("||example.com^"),
                  [["||example.com^", false, true]]);
    });

    it("should emit filterState.enabled when filter's enabled state is toggled after filter is enabled", function() {
      filterState.setEnabled("||example.com^", true);

      checkEvents(() => filterState.toggleEnabled("||example.com^"),
                  [["||example.com^", false, true]]);
    });

    it("should emit filterState.enabled when filter's enabled state is toggled after filter's enabled state is reset", function() {
      filterState.resetEnabled("||example.com^");

      checkEvents(() => filterState.toggleEnabled("||example.com^"),
                  [["||example.com^", false, true]]);
    });

    it("should emit filterState.enabled when filter's enabled state is toggled after filter's hit count is set to 1", function() {
      filterState.setHitCount("||example.com^", 1);

      checkEvents(() => filterState.toggleEnabled("||example.com^"),
                  [["||example.com^", true, false]]);
    });

    it("should emit filterState.enabled when filter's enabled state is toggled after filter's hit count is reset", function() {
      filterState.resetHitCount("||example.com^");

      checkEvents(() => filterState.toggleEnabled("||example.com^"),
                  [["||example.com^", true, false]]);
    });

    it("should emit filterState.enabled when filter's enabled state is toggled after filter's last hit time is set to 946684800000", function() {
      filterState.setLastHit("||example.com^", 946684800000);

      checkEvents(() => filterState.toggleEnabled("||example.com^"),
                  [["||example.com^", true, false]]);
    });

    it("should emit filterState.enabled when filter's enabled state is toggled after filter's last hit time is reset", function() {
      filterState.resetLastHit("||example.com^");

      checkEvents(() => filterState.toggleEnabled("||example.com^"),
                  [["||example.com^", true, false]]);
    });

    it("should emit filterState.enabled when filter's enabled state is toggled after filter hit is registered", function() {
      filterState.registerHit("||example.com^");

      checkEvents(() => filterState.toggleEnabled("||example.com^"),
                  [["||example.com^", true, false]]);
    });

    it("should emit filterState.enabled when filter's enabled state is toggled after filter hits are reset", function() {
      filterState.resetHits("||example.com^");

      checkEvents(() => filterState.toggleEnabled("||example.com^"),
                  [["||example.com^", true, false]]);
    });

    it("should emit filterState.enabled when filter's enabled state is toggled after filter state is reset", function() {
      filterState.reset("||example.com^");

      checkEvents(() => filterState.toggleEnabled("||example.com^"),
                  [["||example.com^", false, true]]);
    });

    it("should emit filterState.enabled when filter's enabled state is toggled after filter state is serialized", function() {
      [...filterState.serialize("||example.com^")];

      checkEvents(() => filterState.toggleEnabled("||example.com^"),
                  [["||example.com^", true, false]]);
    });
  });

  context("State: disabledSubscriptions = ['~user']", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {disabledSubscriptions: ["~user"]});
    });

    it("should emit filterState.enabled when filter's enabled state is toggled", function() {
      checkEvents(() => filterState.toggleEnabled("||example.com^"),
                  [["||example.com^", false, true]]);
    });
  });
});

describe("filterState.resetEnabled()", function() {
  let events = null;

  function checkEvents(func, expectedEvents = []) {
    events = [];

    func();

    assert.deepEqual(events, expectedEvents);
  }

  beforeEach(function() {
    let sandboxedRequire = createSandbox();
    (
      {filterState} = sandboxedRequire(LIB_FOLDER + "/filterState"),
      {filterNotifier} = sandboxedRequire(LIB_FOLDER + "/filterNotifier")
    );

    filterNotifier.on("filterState.enabled", (...args) => events.push(args));
  });

  context("No state", function() {
    it("should not emit filterState.enabled when filter's enabled state is reset", function() {
      checkEvents(() => filterState.resetEnabled("||example.com^"), []);
    });

    it("should not emit filterState.enabled when filter's enabled state is re-reset", function() {
      filterState.resetEnabled("||example.com^");

      checkEvents(() => filterState.resetEnabled("||example.com^"), []);
    });

    it("should emit filterState.enabled when filter's enabled state is reset after filter is disabled", function() {
      filterState.setEnabled("||example.com^", false);

      checkEvents(() => filterState.resetEnabled("||example.com^"),
                  [["||example.com^", true, false]]);
    });

    it("should emit filterState.enabled when filter's enabled state is reset after filter's enabled state is toggled", function() {
      filterState.toggleEnabled("||example.com^");

      checkEvents(() => filterState.resetEnabled("||example.com^"),
                  [["||example.com^", true, false]]);
    });

    it("should not emit filterState.enabled when filter's enabled state is reset after filter's hit count is set to 1", function() {
      filterState.setHitCount("||example.com^", 1);

      checkEvents(() => filterState.resetEnabled("||example.com^"), []);
    });

    it("should not emit filterState.enabled when filter's enabled state is reset after filter's hit count is reset", function() {
      filterState.resetHitCount("||example.com^");

      checkEvents(() => filterState.resetEnabled("||example.com^"), []);
    });

    it("should not emit filterState.enabled when filter's enabled state is reset after filter's last hit time is set to 946684800000", function() {
      filterState.setLastHit("||example.com^", 946684800000);

      checkEvents(() => filterState.resetEnabled("||example.com^"), []);
    });

    it("should not emit filterState.enabled when filter's enabled state is reset after filter's last hit time is reset", function() {
      filterState.resetLastHit("||example.com^");

      checkEvents(() => filterState.resetEnabled("||example.com^"), []);
    });

    it("should not emit filterState.enabled when filter's enabled state is reset after filter hit is registered", function() {
      filterState.registerHit("||example.com^");

      checkEvents(() => filterState.resetEnabled("||example.com^"), []);
    });

    it("should not emit filterState.enabled when filter's enabled state is reset after filter hits are reset", function() {
      filterState.resetHits("||example.com^");

      checkEvents(() => filterState.resetEnabled("||example.com^"), []);
    });

    it("should not emit filterState.enabled when filter's enabled state is reset after filter state is reset", function() {
      filterState.reset("||example.com^");

      checkEvents(() => filterState.resetEnabled("||example.com^"), []);
    });

    it("should not emit filterState.enabled when filter's enabled state is reset after filter state is serialized", function() {
      [...filterState.serialize("||example.com^")];

      checkEvents(() => filterState.resetEnabled("||example.com^"), []);
    });
  });

  context("State: disabled = true", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {disabled: true});
    });

    it("should emit filterState.enabled when filter's enabled state is reset", function() {
      checkEvents(() => filterState.resetEnabled("||example.com^"),
                  [["||example.com^", true, false]]);
    });

    it("should not emit filterState.enabled when filter's enabled state is re-reset", function() {
      filterState.resetEnabled("||example.com^");

      checkEvents(() => filterState.resetEnabled("||example.com^"), []);
    });

    it("should not emit filterState.enabled when filter's enabled state is reset after filter is enabled", function() {
      filterState.setEnabled("||example.com^", true);

      checkEvents(() => filterState.resetEnabled("||example.com^"), []);
    });

    it("should not emit filterState.enabled when filter's enabled state is reset after filter's enabled state is toggled", function() {
      filterState.toggleEnabled("||example.com^");

      checkEvents(() => filterState.resetEnabled("||example.com^"), []);
    });

    it("should emit filterState.enabled when filter's enabled state is reset after filter's hit count is set to 1", function() {
      filterState.setHitCount("||example.com^", 1);

      checkEvents(() => filterState.resetEnabled("||example.com^"),
                  [["||example.com^", true, false]]);
    });

    it("should emit filterState.enabled when filter's enabled state is reset after filter's hit count is reset", function() {
      filterState.resetHitCount("||example.com^");

      checkEvents(() => filterState.resetEnabled("||example.com^"),
                  [["||example.com^", true, false]]);
    });

    it("should emit filterState.enabled when filter's enabled state is reset after filter's last hit time is set to 946684800000", function() {
      filterState.setLastHit("||example.com^", 946684800000);

      checkEvents(() => filterState.resetEnabled("||example.com^"),
                  [["||example.com^", true, false]]);
    });

    it("should emit filterState.enabled when filter's enabled state is reset after filter's last hit time is reset", function() {
      filterState.resetLastHit("||example.com^");

      checkEvents(() => filterState.resetEnabled("||example.com^"),
                  [["||example.com^", true, false]]);
    });

    it("should emit filterState.enabled when filter's enabled state is reset after filter hit is registered", function() {
      filterState.registerHit("||example.com^");

      checkEvents(() => filterState.resetEnabled("||example.com^"),
                  [["||example.com^", true, false]]);
    });

    it("should emit filterState.enabled when filter's enabled state is reset after filter hits are reset", function() {
      filterState.resetHits("||example.com^");

      checkEvents(() => filterState.resetEnabled("||example.com^"),
                  [["||example.com^", true, false]]);
    });

    it("should not emit filterState.enabled when filter's enabled state is reset after filter state is reset", function() {
      filterState.reset("||example.com^");

      checkEvents(() => filterState.resetEnabled("||example.com^"), []);
    });

    it("should emit filterState.enabled when filter's enabled state is reset after filter state is serialized", function() {
      [...filterState.serialize("||example.com^")];

      checkEvents(() => filterState.resetEnabled("||example.com^"),
                  [["||example.com^", true, false]]);
    });
  });
});

describe("filterState.getHitCount()", function() {
  context("No state", function() {
    it("should return 0 for filter with no hits", function() {
      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });

    it("should return 0 after filter's hit count is reset", function() {
      filterState.resetHitCount("||example.com^");

      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });

    it("should return 1 after filter's hit count is set to 1", function() {
      filterState.setHitCount("||example.com^", 1);

      assert.strictEqual(filterState.getHitCount("||example.com^"), 1);
    });

    it("should return 0 after filter's hit count is re-set to 0", function() {
      filterState.setHitCount("||example.com^", 1);
      filterState.setHitCount("||example.com^", 0);

      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });

    it("should return 1 after filter's hit count is re-set to 1", function() {
      filterState.setHitCount("||example.com^", 1);
      filterState.setHitCount("||example.com^", 0);
      filterState.setHitCount("||example.com^", 1);

      assert.strictEqual(filterState.getHitCount("||example.com^"), 1);
    });

    it("should return 0 after filter's hit count is set to 1 and then reset", function() {
      filterState.setHitCount("||example.com^", 1);
      filterState.resetHitCount("||example.com^");

      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });

    it("should return 0 after filter hits are reset", function() {
      filterState.resetHits("||example.com^");

      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });

    it("should return 1 after filter hit is registered", function() {
      filterState.registerHit("||example.com^");

      assert.strictEqual(filterState.getHitCount("||example.com^"), 1);
    });

    it("should return 2 after two filter hits are registered", function() {
      filterState.registerHit("||example.com^");
      filterState.registerHit("||example.com^");

      assert.strictEqual(filterState.getHitCount("||example.com^"), 2);
    });

    it("should return 0 after filter hit is registered and filter hits are reset", function() {
      filterState.registerHit("||example.com^");
      filterState.resetHits("||example.com^");

      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });

    it("should return 0 after filter's enabled state is reset", function() {
      filterState.resetEnabled("||example.com^");

      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });

    it("should return 0 after filter is disabled", function() {
      filterState.setEnabled("||example.com^", false);

      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });

    it("should return 1 after filter is disabled and filter's hit count is set to 1", function() {
      filterState.setEnabled("||example.com^", false);
      filterState.setHitCount("||example.com^", 1);

      assert.strictEqual(filterState.getHitCount("||example.com^"), 1);
    });

    it("should return 1 after filter is disabled, filter's hit count is set to 1, and filter's enabled state is reset", function() {
      filterState.setEnabled("||example.com^", false);
      filterState.setHitCount("||example.com^", 1);
      filterState.resetEnabled("||example.com^");

      assert.strictEqual(filterState.getHitCount("||example.com^"), 1);
    });

    it("should return 0 after filter's enabled state is toggled", function() {
      filterState.toggleEnabled("||example.com^");

      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });

    it("should return 1 after filter's enabled state is toggled and filter's hit count is set to 1", function() {
      filterState.toggleEnabled("||example.com^");
      filterState.setHitCount("||example.com^", 1);

      assert.strictEqual(filterState.getHitCount("||example.com^"), 1);
    });

    it("should return 1 after filter's enabled state is toggled, filter's hit count is set to 1, and filter's enabled state is reset", function() {
      filterState.toggleEnabled("||example.com^");
      filterState.setHitCount("||example.com^", 1);
      filterState.resetEnabled("||example.com^");

      assert.strictEqual(filterState.getHitCount("||example.com^"), 1);
    });

    it("should return 0 after filter's last hit time is reset", function() {
      filterState.resetLastHit("||example.com^");

      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });

    it("should return 0 after filter's last hit time is set to 946684800000", function() {
      filterState.setLastHit("||example.com^", 946684800000);

      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });

    it("should return 1 after filter's last hit time is set to 946684800000 and filter's hit count is set to 1", function() {
      filterState.setLastHit("||example.com^", 946684800000);
      filterState.setHitCount("||example.com^", 1);

      assert.strictEqual(filterState.getHitCount("||example.com^"), 1);
    });

    it("should return 1 after filter's last hit time is set to 946684800000, filter's hit count is set to 1, and filter's last hit time is reset", function() {
      filterState.setLastHit("||example.com^", 946684800000);
      filterState.setHitCount("||example.com^", 1);
      filterState.resetLastHit("||example.com^");

      assert.strictEqual(filterState.getHitCount("||example.com^"), 1);
    });

    it("should return 0 after filter state is reset", function() {
      filterState.reset("||example.com^");

      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });

    it("should return 0 after filter's hit count is set to 1 and filter state is reset", function() {
      filterState.setHitCount("||example.com^", 1);
      filterState.reset("||example.com^");

      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });

    it("should return 0 after filter state is serialized", function() {
      [...filterState.serialize("||example.com^")];

      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });

    it("should return 1 after filter's hit count is set to 1 and filter state is serialized", function() {
      filterState.setHitCount("||example.com^", 1);
      [...filterState.serialize("||example.com^")];

      assert.strictEqual(filterState.getHitCount("||example.com^"), 1);
    });

    it("should return 0 after filter state is serialized and filter's hit count is re-set to 0", function() {
      filterState.setHitCount("||example.com^", 1);
      [...filterState.serialize("||example.com^")];
      filterState.setHitCount("||example.com^", 0);

      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });
  });

  context("State: hitCount = 1", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {hitCount: 1});
    });

    it("should return 1 for filter with one hit", function() {
      assert.strictEqual(filterState.getHitCount("||example.com^"), 1);
    });

    it("should return 0 after filter's hit count is reset", function() {
      filterState.resetHitCount("||example.com^");

      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });

    it("should return 0 after filter's hit count is set to 0", function() {
      filterState.setHitCount("||example.com^", 0);

      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });

    it("should return 1 after filter's hit count is re-set to 1", function() {
      filterState.setHitCount("||example.com^", 0);
      filterState.setHitCount("||example.com^", 1);

      assert.strictEqual(filterState.getHitCount("||example.com^"), 1);
    });

    it("should return 0 after filter's hit count is re-set to 0", function() {
      filterState.setHitCount("||example.com^", 0);
      filterState.setHitCount("||example.com^", 1);
      filterState.setHitCount("||example.com^", 0);

      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });

    it("should return 0 after filter's hit count is set to 0 and then reset", function() {
      filterState.setHitCount("||example.com^", 0);
      filterState.resetHitCount("||example.com^");

      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });

    it("should return 0 after filter hits are reset", function() {
      filterState.resetHits("||example.com^");

      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });

    it("should return 2 after filter hit is registered", function() {
      filterState.registerHit("||example.com^");

      assert.strictEqual(filterState.getHitCount("||example.com^"), 2);
    });

    it("should return 3 after two filter hits are registered", function() {
      filterState.registerHit("||example.com^");
      filterState.registerHit("||example.com^");

      assert.strictEqual(filterState.getHitCount("||example.com^"), 3);
    });

    it("should return 0 after filter hit is registered and filter hits are reset", function() {
      filterState.registerHit("||example.com^");
      filterState.resetHits("||example.com^");

      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });

    it("should return 1 after filter's enabled state is reset", function() {
      filterState.resetEnabled("||example.com^");

      assert.strictEqual(filterState.getHitCount("||example.com^"), 1);
    });

    it("should return 1 after filter is disabled", function() {
      filterState.setEnabled("||example.com^", false);

      assert.strictEqual(filterState.getHitCount("||example.com^"), 1);
    });

    it("should return 0 after filter is disabled and filter's hit count is set to 0", function() {
      filterState.setEnabled("||example.com^", false);
      filterState.setHitCount("||example.com^", 0);

      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });

    it("should return 0 after filter is disabled, filter's hit count is set to 0, and filter's enabled state is reset", function() {
      filterState.setEnabled("||example.com^", false);
      filterState.setHitCount("||example.com^", 0);
      filterState.resetEnabled("||example.com^");

      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });

    it("should return 1 after filter's enabled state is toggled", function() {
      filterState.toggleEnabled("||example.com^");

      assert.strictEqual(filterState.getHitCount("||example.com^"), 1);
    });

    it("should return 0 after filter's enabled state is toggled and filter's hit count is set to 0", function() {
      filterState.toggleEnabled("||example.com^");
      filterState.setHitCount("||example.com^", 0);

      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });

    it("should return 0 after filter's enabled state is toggled, filter's hit count is set to 0, and filter's enabled state is reset", function() {
      filterState.toggleEnabled("||example.com^");
      filterState.setHitCount("||example.com^", 0);
      filterState.resetEnabled("||example.com^");

      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });

    it("should return 1 after filter's last hit time is reset", function() {
      filterState.resetLastHit("||example.com^");

      assert.strictEqual(filterState.getHitCount("||example.com^"), 1);
    });

    it("should return 1 after filter's last hit time is set to 946684800000", function() {
      filterState.setLastHit("||example.com^", 946684800000);

      assert.strictEqual(filterState.getHitCount("||example.com^"), 1);
    });

    it("should return 0 after filter's last hit time is set to 946684800000 and filter's hit count is set to 0", function() {
      filterState.setLastHit("||example.com^", 946684800000);
      filterState.setHitCount("||example.com^", 0);

      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });

    it("should return 0 after filter's last hit time is set to 946684800000, filter's hit count is set to 0, and filter's last hit time is reset", function() {
      filterState.setLastHit("||example.com^", 946684800000);
      filterState.setHitCount("||example.com^", 0);
      filterState.resetLastHit("||example.com^");

      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });

    it("should return 0 after filter state is reset", function() {
      filterState.reset("||example.com^");

      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });

    it("should return 0 after filter's hit count is set to 0 and filter state is reset", function() {
      filterState.setHitCount("||example.com^", 0);
      filterState.reset("||example.com^");

      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });

    it("should return 1 after filter state is serialized", function() {
      [...filterState.serialize("||example.com^")];

      assert.strictEqual(filterState.getHitCount("||example.com^"), 1);
    });

    it("should return 0 after filter's hit count is set to 0 and filter state is serialized", function() {
      filterState.setHitCount("||example.com^", 0);
      [...filterState.serialize("||example.com^")];

      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });

    it("should return 1 after filter state is serialized and filter's hit count is re-set to 1", function() {
      filterState.setHitCount("||example.com^", 0);
      [...filterState.serialize("||example.com^")];
      filterState.setHitCount("||example.com^", 1);

      assert.strictEqual(filterState.getHitCount("||example.com^"), 1);
    });
  });
});

describe("filterState.setHitCount()", function() {
  let events = null;

  function checkEvents(func, expectedEvents = []) {
    events = [];

    func();

    assert.deepEqual(events, expectedEvents);
  }

  beforeEach(function() {
    let sandboxedRequire = createSandbox();
    (
      {filterState} = sandboxedRequire(LIB_FOLDER + "/filterState"),
      {filterNotifier} = sandboxedRequire(LIB_FOLDER + "/filterNotifier")
    );

    filterNotifier.on("filterState.hitCount", (...args) => events.push(args));
  });

  context("No state", function() {
    it("should emit filterState.hitCount when filter's hit count is set to 1", function() {
      checkEvents(() => filterState.setHitCount("||example.com^", 1),
                  [["||example.com^", 1, 0]]);
    });

    it("should not emit filterState.hitCount when filter's hit count is set to 0", function() {
      checkEvents(() => filterState.setHitCount("||example.com^", 0));
    });

    it("should emit filterState.hitCount when filter's hit count is re-set to 0", function() {
      filterState.setHitCount("||example.com^", 1);

      checkEvents(() => filterState.setHitCount("||example.com^", 0),
                  [["||example.com^", 0, 1]]);
    });

    it("should emit filterState.hitCount when filter's hit count is re-set to 1", function() {
      filterState.setHitCount("||example.com^", 1);
      filterState.setHitCount("||example.com^", 0);

      checkEvents(() => filterState.setHitCount("||example.com^", 1),
                  [["||example.com^", 1, 0]]);
    });

    it("should emit filterState.hitCount when filter's hit count is set to 1 after filter's hit count is reset", function() {
      filterState.resetHitCount("||example.com^");

      checkEvents(() => filterState.setHitCount("||example.com^", 1),
                  [["||example.com^", 1, 0]]);
    });

    it("should not emit filterState.hitCount when filter's hit count is set to 1 after filter hit is registered", function() {
      filterState.registerHit("||example.com^");

      checkEvents(() => filterState.setHitCount("||example.com^", 1));
    });

    it("should emit filterState.hitCount when filter's hit count is set to 1 after filter hits are reset", function() {
      filterState.resetHits("||example.com^");

      checkEvents(() => filterState.setHitCount("||example.com^", 1),
                  [["||example.com^", 1, 0]]);
    });

    it("should emit filterState.hitCount when filter's hit count is set to 1 after filter is disabled", function() {
      filterState.setEnabled("||example.com^", false);

      checkEvents(() => filterState.setHitCount("||example.com^", 1),
                  [["||example.com^", 1, 0]]);
    });

    it("should emit filterState.hitCount when filter's hit count is set to 1 after filter's enabled state is reset", function() {
      filterState.resetEnabled("||example.com^");

      checkEvents(() => filterState.setHitCount("||example.com^", 1),
                  [["||example.com^", 1, 0]]);
    });

    it("should emit filterState.hitCount when filter's hit count is set to 1 after filter's enabled state is toggled", function() {
      filterState.toggleEnabled("||example.com^");

      checkEvents(() => filterState.setHitCount("||example.com^", 1),
                  [["||example.com^", 1, 0]]);
    });

    it("should emit filterState.hitCount when filter's hit count is set to 1 after filter's last hit time is set to 946684800000", function() {
      filterState.setLastHit("||example.com^", 946684800000);

      checkEvents(() => filterState.setHitCount("||example.com^", 1),
                  [["||example.com^", 1, 0]]);
    });

    it("should emit filterState.hitCount when filter's hit count is set to 1 after filter's last hit time is reset", function() {
      filterState.resetLastHit("||example.com^");

      checkEvents(() => filterState.setHitCount("||example.com^", 1),
                  [["||example.com^", 1, 0]]);
    });

    it("should emit filterState.hitCount when filter's hit count is set to 1 after filter state is reset", function() {
      filterState.reset("||example.com^");

      checkEvents(() => filterState.setHitCount("||example.com^", 1),
                  [["||example.com^", 1, 0]]);
    });

    it("should emit filterState.hitCount when filter's hit count is set to 1 after filter state is serialized", function() {
      [...filterState.serialize("||example.com^")];

      checkEvents(() => filterState.setHitCount("||example.com^", 1),
                  [["||example.com^", 1, 0]]);
    });
  });

  context("State: hitCount = 1", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {hitCount: 1});
    });

    it("should emit filterState.hitCount when filter's hit count is set to 0", function() {
      checkEvents(() => filterState.setHitCount("||example.com^", 0),
                  [["||example.com^", 0, 1]]);
    });

    it("should not emit filterState.hitCount when filter's hit count is set to 1", function() {
      checkEvents(() => filterState.setHitCount("||example.com^", 1));
    });

    it("should emit filterState.hitCount when filter's hit count is re-set to 1", function() {
      filterState.setHitCount("||example.com^", 0);

      checkEvents(() => filterState.setHitCount("||example.com^", 1),
                  [["||example.com^", 1, 0]]);
    });

    it("should emit filterState.hitCount when filter's hit count is re-set to 0", function() {
      filterState.setHitCount("||example.com^", 0);
      filterState.setHitCount("||example.com^", 1);

      checkEvents(() => filterState.setHitCount("||example.com^", 0),
                  [["||example.com^", 0, 1]]);
    });

    it("should not emit filterState.hitCount when filter's hit count is set to 0 after filter's hit count is reset", function() {
      filterState.resetHitCount("||example.com^");

      checkEvents(() => filterState.setHitCount("||example.com^", 0));
    });

    it("should emit filterState.hitCount when filter's hit count is set to 0 after filter hit is registered", function() {
      filterState.registerHit("||example.com^");

      checkEvents(() => filterState.setHitCount("||example.com^", 0),
                  [["||example.com^", 0, 2]]);
    });

    it("should not emit filterState.hitCount when filter's hit count is set to 0 after filter hits are reset", function() {
      filterState.resetHits("||example.com^");

      checkEvents(() => filterState.setHitCount("||example.com^", 0));
    });

    it("should emit filterState.hitCount when filter's hit count is set to 0 after filter is disabled", function() {
      filterState.setEnabled("||example.com^", false);

      checkEvents(() => filterState.setHitCount("||example.com^", 0),
                  [["||example.com^", 0, 1]]);
    });

    it("should emit filterState.hitCount when filter's hit count is set to 0 after filter's enabled state is reset", function() {
      filterState.resetEnabled("||example.com^");

      checkEvents(() => filterState.setHitCount("||example.com^", 0),
                  [["||example.com^", 0, 1]]);
    });

    it("should emit filterState.hitCount when filter's hit count is set to 0 after filter's enabled state is toggled", function() {
      filterState.toggleEnabled("||example.com^");

      checkEvents(() => filterState.setHitCount("||example.com^", 0),
                  [["||example.com^", 0, 1]]);
    });

    it("should emit filterState.hitCount when filter's hit count is set to 0 after filter's last hit time is set to 946684800000", function() {
      filterState.setLastHit("||example.com^", 946684800000);

      checkEvents(() => filterState.setHitCount("||example.com^", 0),
                  [["||example.com^", 0, 1]]);
    });

    it("should emit filterState.hitCount when filter's hit count is set to 0 after filter's last hit time is reset", function() {
      filterState.resetLastHit("||example.com^");

      checkEvents(() => filterState.setHitCount("||example.com^", 0),
                  [["||example.com^", 0, 1]]);
    });

    it("should not emit filterState.hitCount when filter's hit count is set to 0 after filter state is reset", function() {
      filterState.reset("||example.com^");

      checkEvents(() => filterState.setHitCount("||example.com^", 0));
    });

    it("should emit filterState.hitCount when filter's hit count is set to 0 after filter state is serialized", function() {
      [...filterState.serialize("||example.com^")];

      checkEvents(() => filterState.setHitCount("||example.com^", 0),
                  [["||example.com^", 0, 1]]);
    });
  });
});

describe("filterState.resetHitCount()", function() {
  let events = null;

  function checkEvents(func, expectedEvents = []) {
    events = [];

    func();

    assert.deepEqual(events, expectedEvents);
  }

  beforeEach(function() {
    let sandboxedRequire = createSandbox();
    (
      {filterState} = sandboxedRequire(LIB_FOLDER + "/filterState"),
      {filterNotifier} = sandboxedRequire(LIB_FOLDER + "/filterNotifier")
    );

    filterNotifier.on("filterState.hitCount", (...args) => events.push(args));
  });

  context("No state", function() {
    it("should not emit filterState.hitCount when filter's hit count is reset", function() {
      checkEvents(() => filterState.resetHitCount("||example.com^"));
    });

    it("should emit filterState.hitCount when filter's hit count is reset from 1", function() {
      filterState.setHitCount("||example.com^", 1);

      checkEvents(() => filterState.resetHitCount("||example.com^"),
                  [["||example.com^", 0, 1]]);
    });

    it("should not emit filterState.hitCount when filter's hit count is re-reset from 1", function() {
      filterState.setHitCount("||example.com^", 1);
      filterState.resetHitCount("||example.com^");

      checkEvents(() => filterState.resetHitCount("||example.com^"));
    });

    it("should emit filterState.hitCount when filter's hit count is reset after filter hit is registered", function() {
      filterState.registerHit("||example.com^");

      checkEvents(() => filterState.resetHitCount("||example.com^"),
                  [["||example.com^", 0, 1]]);
    });

    it("should not emit filterState.hitCount when filter's hit count is reset after filter hits are reset", function() {
      filterState.resetHits("||example.com^");

      checkEvents(() => filterState.resetHitCount("||example.com^"));
    });

    it("should emit filterState.hitCount when filter's hit count is reset from 1 after filter is disabled", function() {
      filterState.setEnabled("||example.com^", false);
      filterState.setHitCount("||example.com^", 1);

      checkEvents(() => filterState.resetHitCount("||example.com^"),
                  [["||example.com^", 0, 1]]);
    });

    it("should emit filterState.hitCount when filter's hit count is reset from 1 after filter's enabled state is reset", function() {
      filterState.resetEnabled("||example.com^");
      filterState.setHitCount("||example.com^", 1);

      checkEvents(() => filterState.resetHitCount("||example.com^"),
                  [["||example.com^", 0, 1]]);
    });

    it("should emit filterState.hitCount when filter's hit count is reset from 1 after filter's enabled state is toggled", function() {
      filterState.toggleEnabled("||example.com^");
      filterState.setHitCount("||example.com^", 1);

      checkEvents(() => filterState.resetHitCount("||example.com^"),
                  [["||example.com^", 0, 1]]);
    });

    it("should emit filterState.hitCount when filter's hit count is reset from 1 after filter's last hit time is set to 946684800000", function() {
      filterState.setLastHit("||example.com^", 946684800000);
      filterState.setHitCount("||example.com^", 1);

      checkEvents(() => filterState.resetHitCount("||example.com^"),
                  [["||example.com^", 0, 1]]);
    });

    it("should emit filterState.hitCount when filter's hit count is reset from 1 after filter's last hit time is reset", function() {
      filterState.resetLastHit("||example.com^");
      filterState.setHitCount("||example.com^", 1);

      checkEvents(() => filterState.resetHitCount("||example.com^"),
                  [["||example.com^", 0, 1]]);
    });

    it("should emit filterState.hitCount when filter's hit count is reset from 1 after filter state is reset", function() {
      filterState.reset("||example.com^");
      filterState.setHitCount("||example.com^", 1);

      checkEvents(() => filterState.resetHitCount("||example.com^"),
                  [["||example.com^", 0, 1]]);
    });

    it("should emit filterState.hitCount when filter's hit count is reset from 1 after filter state is serialized", function() {
      [...filterState.serialize("||example.com^")];
      filterState.setHitCount("||example.com^", 1);

      checkEvents(() => filterState.resetHitCount("||example.com^"),
                  [["||example.com^", 0, 1]]);
    });
  });

  context("State: hitCount = 1", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {hitCount: 1});
    });

    it("should emit filterState.hitCount when filter's hit count is reset", function() {
      checkEvents(() => filterState.resetHitCount("||example.com^"),
                  [["||example.com^", 0, 1]]);
    });

    it("should not emit filterState.hitCount when filter's hit count is reset from 0", function() {
      filterState.setHitCount("||example.com^", 0);

      checkEvents(() => filterState.resetHitCount("||example.com^"));
    });

    it("should emit filterState.hitCount when filter's hit count is reset after filter hit is registered", function() {
      filterState.registerHit("||example.com^");

      checkEvents(() => filterState.resetHitCount("||example.com^"),
                  [["||example.com^", 0, 2]]);
    });

    it("should not emit filterState.hitCount when filter's hit count is reset after filter hits are reset", function() {
      filterState.resetHits("||example.com^");

      checkEvents(() => filterState.resetHitCount("||example.com^"));
    });

    it("should emit filterState.hitCount when filter's hit count is reset after filter is disabled", function() {
      filterState.setEnabled("||example.com^", false);

      checkEvents(() => filterState.resetHitCount("||example.com^"),
                  [["||example.com^", 0, 1]]);
    });

    it("should emit filterState.hitCount when filter's hit count is reset after filter's enabled state is reset", function() {
      filterState.resetEnabled("||example.com^");

      checkEvents(() => filterState.resetHitCount("||example.com^"),
                  [["||example.com^", 0, 1]]);
    });

    it("should emit filterState.hitCount when filter's hit count is reset after filter's enabled state is toggled", function() {
      filterState.toggleEnabled("||example.com^");

      checkEvents(() => filterState.resetHitCount("||example.com^"),
                  [["||example.com^", 0, 1]]);
    });

    it("should emit filterState.hitCount when filter's hit count is reset after filter's last hit time is set to 946684800000", function() {
      filterState.setLastHit("||example.com^", 946684800000);

      checkEvents(() => filterState.resetHitCount("||example.com^"),
                  [["||example.com^", 0, 1]]);
    });

    it("should emit filterState.hitCount when filter's hit count is reset after filter's last hit time is reset", function() {
      filterState.resetLastHit("||example.com^");

      checkEvents(() => filterState.resetHitCount("||example.com^"),
                  [["||example.com^", 0, 1]]);
    });

    it("should not emit filterState.hitCount when filter's hit count is reset after filter state is reset", function() {
      filterState.reset("||example.com^");

      checkEvents(() => filterState.resetHitCount("||example.com^"));
    });

    it("should emit filterState.hitCount when filter's hit count is reset after filter state is serialized", function() {
      [...filterState.serialize("||example.com^")];

      checkEvents(() => filterState.resetHitCount("||example.com^"),
                  [["||example.com^", 0, 1]]);
    });
  });
});

describe("filterState.reset()", function() {
  let events = null;

  function argsFor(name) {
    return (...args) => {
      events.push([name, ...args]);
    };
  }

  function checkEvents(func, expectedEvents = []) {
    events = [];
    func();
    assert.deepEqual(events.splice(0), expectedEvents);
  }


  context("No state", function() {
    it("should not emit filterState.enabled when filter is reset", function() {
      filterNotifier.on("filterState.enabled", argsFor("filterState.enabled"));

      checkEvents(() => filterState.reset("||example.com^"));
    });

    it("should not emit filterState.hitCount when filter is reset", function() {
      filterNotifier.on("filterState.hitCount", argsFor("filterState.hitCount"));

      checkEvents(() => filterState.reset("||example.com^"));
    });

    it("should not emit filterState.lastHit when filter is reset", function() {
      filterNotifier.on("filterState.lastHit", argsFor("filterState.lastHit"));

      checkEvents(() => filterState.reset("||example.com^"));
    });
  });

  context("State: disabled = false", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {disabled: false});
    });

    it("should not emit filterState.enabled when filter is reset", function() {
      filterNotifier.on("filterState.enabled", argsFor("filterState.enabled"));
      checkEvents(() => filterState.reset("||example.com^"));
    });
  });

  context("State: disabled = true", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {disabled: true});
    });

    it("should emit filterState.enabled when filter is reset", function() {
      filterNotifier.on("filterState.enabled", argsFor("filterState.enabled"));
      checkEvents(
        () => filterState.reset("||example.com^"),
        [["filterState.enabled", "||example.com^", true, false]]
      );
    });
  });

  context("State: disabledSubscriptions = ['~user']", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {disabledSubscriptions: ["~user"]});
    });

    it("should not filterState.enabled when filter is reset", function() {
      filterNotifier.on("filterState.enabled", argsFor("filterState.enabled"));
      checkEvents(
        () => filterState.reset("||example.com^"),
        []
      );
    });
  });

  context("State: hitCount = 0", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {hitCount: 0});
    });

    it("should not emit filterState.hitCount when filter is reset", function() {
      filterNotifier.on("filterState.hitCount", argsFor("filterState.hitCount"));
      checkEvents(() => filterState.reset("||example.com^"));
    });
  });

  context("State: hitCount = 1", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {hitCount: 1});
    });

    it("should emit filterState.hitCount when filter is reset", function() {
      filterNotifier.on("filterState.hitCount", argsFor("filterState.hitCount"));
      checkEvents(
        () => filterState.reset("||example.com^"),
        [["filterState.hitCount", "||example.com^", 0, 1]]
      );
    });

    it("should delete state when filter is reset", function() {
      filterState.reset("||example.com^");
      assert.strictEqual(filterState.map.size, 0);
    });
  });

  context("State: lastHit = 0", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {lastHit: 0});
    });

    it("should not emit filterState.lastHit when filter is reset", function() {
      filterNotifier.on("filterState.lastHit", argsFor("filterState.lastHit"));
      checkEvents(() => filterState.reset("||example.com^"));
    });
  });

  context("State: lastHit = 1", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {lastHit: 1});
    });

    it("should emit filterState.lastHit when filter is reset", function() {
      filterNotifier.on("filterState.lastHit", argsFor("filterState.lastHit"));
      checkEvents(
        () => filterState.reset("||example.com^"),
        [["filterState.lastHit", "||example.com^", 0, 1]]
      );
    });
  });
});

describe("filterState.resetHits()", function() {
  let events = null;

  function argsFor(name) {
    return (...args) => {
      events.push([name, ...args]);
    };
  }

  function checkEvents(func, expectedEvents = []) {
    events = [];
    func();
    assert.deepEqual(events.splice(0), expectedEvents);
  }

  context("No state", function() {
    it("should not emit filterState.hitCount when hits are reset", function() {
      filterNotifier.on("filterState.hitCount", argsFor("filterState.hitCount"));

      checkEvents(() => filterState.resetHits("||example.com^"));
    });

    it("should not emit filterState.lastHit when hits are reset", function() {
      filterNotifier.on("filterState.lastHit", argsFor("filterState.lastHit"));

      checkEvents(() => filterState.resetHits("||example.com^"));
    });
  });

  context("State: disabled = false", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {disabled: false, hitCount: 1, lastHit: 1});
    });

    it("should delete state when hits are reset", function() {
      filterState.resetHits("||example.com^");
      assert.strictEqual(filterState.map.size, 0);
    });
  });

  context("State: disabled = true", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {disabled: true, hitCount: 1, lastHit: 1});
    });

    it("should not delete state when hits are reset", function() {
      filterState.resetHits("||example.com^");
      assert.strictEqual(filterState.map.size, 1);
    });

    it("should reset hitCount when hits are reset", function() {
      filterState.resetHits("||example.com^");
      assert.strictEqual(filterState.getHitCount("||example.com^"), 0);
    });

    it("should reset lastHit when hits are reset", function() {
      filterState.resetHits("||example.com^");
      assert.strictEqual(filterState.getLastHit("||example.com^"), 0);
    });
  });

  context("State: hitCount = 0", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {hitCount: 0});
    });

    it("should not emit filterState.hitCount when hits are reset", function() {
      filterNotifier.on("filterState.hitCount", argsFor("filterState.hitCount"));

      checkEvents(() => filterState.resetHits("||example.com^"));
    });
  });

  context("State: hitCount = 1", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {hitCount: 1});
    });

    it("should emit filterState.hitCount when hits are reset", function() {
      filterNotifier.on("filterState.hitCount", argsFor("filterState.hitCount"));

      checkEvents(
        () => filterState.resetHits("||example.com^"),
        [["filterState.hitCount", "||example.com^", 0, 1]]
      );
    });
  });

  context("State: lastHit = 0", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {lastHit: 0});
    });

    it("should not emit filterState.lastHit when hits are reset", function() {
      filterNotifier.on("filterState.lastHit", argsFor("filterState.lastHit"));

      checkEvents(() => filterState.resetHits("||example.com^"));
    });
  });

  context("State: lastHit = 1", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {lastHit: 1});
    });

    it("should emit filterState.lastHit when hits are reset", function() {
      filterNotifier.on("filterState.lastHit", argsFor("filterState.lastHit"));

      checkEvents(
        () => filterState.resetHits("||example.com^"),
        [["filterState.lastHit", "||example.com^", 0, 1]]);
    });
  });
});

describe("filterState.registerHit()", function() {
  let events = null;
  let originalNow = Date.now;
  let nowValue = 9;

  function argsFor(name) {
    return (...args) => {
      events.push([name, ...args]);
    };
  }

  function checkEvents(func, expectedEvents = []) {
    events = [];
    func();
    if (expectedEvents !== null)
      assert.deepEqual(events.splice(0), expectedEvents);

    return events.splice(0);
  }

  before(function() {
    Date.now = () => nowValue;
  });

  after(function() {
    Date.now = originalNow.bind(Date);
  });

  context("No state", function() {
    it("should update state when a hit is registered", function() {
      filterState.registerHit("||example.com^");
      let state = filterState.map.get("||example.com^");
      assert.strictEqual(state.hitCount, 1);
      assert.strictEqual(state.lastHit, nowValue);
    });

    it("should emit filterState.hitCount when a hit is registered", function() {
      filterNotifier.on("filterState.hitCount", argsFor("filterState.hitCount"));

      checkEvents(
        () => filterState.registerHit("||example.com^"),
        [["filterState.hitCount", "||example.com^", 1, 0]]
      );
    });

    it("should emit filterState.lastHit when a hit is registered", function() {
      filterNotifier.on("filterState.lastHit", argsFor("filterState.lastHit"));

      checkEvents(
        () => filterState.registerHit("||example.com^"),
        [["filterState.lastHit", "||example.com^", nowValue, 0]]
      );
    });
  });

  context("State: hitCount = 1, lastHit = 1", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {hitCount: 1, lastHit: 1});
    });

    it("should update state when a hit is registered", function() {
      filterState.registerHit("||example.com^");
      let state = filterState.map.get("||example.com^");
      assert.strictEqual(state.hitCount, 2);
      assert.strictEqual(state.lastHit, nowValue);
    });

    it("should emit filterState.hitCount when a hit is registered", function() {
      filterNotifier.on("filterState.hitCount", argsFor("filterState.hitCount"));

      checkEvents(
        () => filterState.registerHit("||example.com^"),
        [["filterState.hitCount", "||example.com^", 2, 1]]
      );
    });

    it("should emit filterState.lastHit when a hit is registered", function() {
      filterNotifier.on("filterState.lastHit", argsFor("filterState.lastHit"));

      let [event] = checkEvents(
        () => filterState.registerHit("||example.com^"),
        null
      );
      assert.strictEqual(event[0], "filterState.lastHit");
      assert.strictEqual(event[1], "||example.com^");
      assert.notStrictEqual(event[2], 1);
      assert.strictEqual(event[3], 1);
    });

    it("should not emit filterState.lastHit when a hit is registered at the same time as lastHit", function() {
      filterNotifier.on("filterState.lastHit", argsFor("filterState.lastHit"));

      filterState.registerHit("||example.com^");
      checkEvents(() => filterState.registerHit("||example.com^"));
    });
  });
});

describe("filterState.getLastHit()", function() {
  context("No state", function() {
    it("should return 0", function() {
      assert.strictEqual(filterState.getLastHit("||example.com^"), 0);
    });
  });

  context("State: lastHit = 1", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {hitCount: 1, lastHit: 1});
    });

    it("should return lastHit", function() {
      assert.strictEqual(filterState.getLastHit("||example.com^"), 1);
    });
  });
});

describe("filterState.setLastHit()", function() {
  let events = null;

  function argsFor(name) {
    return (...args) => {
      events.push([name, ...args]);
    };
  }

  function checkEvents(func, expectedEvents = []) {
    events = [];
    func();
    assert.deepEqual(events.splice(0), expectedEvents);
  }


  context("No state", function() {
    it("should update state when lastHit is set", function() {
      filterState.setLastHit("||example.com^", 1);
      let state = filterState.map.get("||example.com^");
      assert.strictEqual(state.disabled, undefined);
      assert.strictEqual(state.hitCount, 0);
      assert.strictEqual(state.lastHit, 1);
    });

    it("should emit filterState.lastHit when lastHit is set", function() {
      filterNotifier.on("filterState.lastHit", argsFor("filterState.lastHit"));

      checkEvents(
        () => filterState.setLastHit("||example.com^", 1),
        [["filterState.lastHit", "||example.com^", 1, 0]]
      );
    });

    it("should not update state when lastHit is set to 0", function() {
      filterState.setLastHit("||example.com^", 0);
      let state = filterState.map.get("||example.com^");
      assert.strictEqual(state, undefined);
    });

    it("should not emit filterState.lastHit when lastHit is set to 0", function() {
      filterNotifier.on("filterState.lastHit", argsFor("filterState.lastHit"));

      checkEvents(() => filterState.setLastHit("||example.com^", 0));
    });
  });

  context("State: lastHit = 1", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {hitCount: 1, lastHit: 1});
    });

    it("should emit filterState.lastHit when lastHit is set to 2", function() {
      filterNotifier.on("filterState.lastHit", argsFor("filterState.lastHit"));

      checkEvents(
        () => filterState.setLastHit("||example.com^", 2),
        [["filterState.lastHit", "||example.com^", 2, 1]]
      );
    });

    it("should not emit filterState.lastHit when lastHit is set to 1", function() {
      filterNotifier.on("filterState.lastHit", argsFor("filterState.lastHit"));

      checkEvents(() => filterState.setLastHit("||example.com^", 1));
    });
  });

  context("State: lastHit = 1, disabled = false, hitCount = 0", function() {
    beforeEach(function() {
      filterState.fromObject("||example.com^", {disabled: false, lastHit: 1, hitCount: 0});
    });

    it("should delete state when lastHit is set to 0", function() {
      filterState.setLastHit("||example.com^", 0);
      let state = filterState.map.get("||example.com^");
      assert.strictEqual(state, undefined);
    });

    it("should update state when lastHit is set to 2", function() {
      filterState.setLastHit("||example.com^", 2);
      let state = filterState.map.get("||example.com^");
      assert.strictEqual(state.hitCount, 0);
      assert.strictEqual(state.lastHit, 2);
    });
  });
});

describe("filterState.resetLastHit()", function() {
  it("should call setLastHit when lastHit is reset", function() {
    let calls = [];
    let originalFunc = filterState.setLastHit;
    let wrapperFunc = function(...args) {
      calls.push(args);
      return originalFunc.call(this, args);
    };
    filterState.setLastHit = wrapperFunc.bind(filterState);

    filterState.resetLastHit("||example.com^");
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0][0], "||example.com^");
    assert.strictEqual(calls[0][1], 0);
  });
});

describe("filterState.fromObject()", function() {
  it("does not set state when called without any known properties", function() {
    filterState.fromObject("||example.com^", {});
    let state = filterState.map.get("||example.com^");
    assert.strictEqual(state, undefined);
  });

  it("sets state.disabled from boolean", function() {
    filterState.fromObject("||example.com^", {disabled: true});
    let state = filterState.map.get("||example.com^");
    assert.strictEqual(state.disabled, true);
  });

  it("sets state.disabled from string", function() {
    filterState.fromObject("||example.com^", {disabled: "true"});
    let state = filterState.map.get("||example.com^");
    assert.strictEqual(state.disabled, true);
  });

  it("sets state.disabledSubscriptions from array of strings", function() {
    filterState.fromObject("||example.com^", {disabledSubscriptions: ["~user", "~easylist"]});
    let state = filterState.map.get("||example.com^");
    assert.deepEqual(state.disabledSubscriptions, new Set(["~user", "~easylist"]));
  });

  it("sets state.hitCount", function() {
    filterState.fromObject("||example.com^", {hitCount: 1});
    let state = filterState.map.get("||example.com^");
    assert.strictEqual(state.hitCount, 1);
  });

  it("sets state.lastHit", function() {
    filterState.fromObject("||example.com^", {lastHit: 1});
    let state = filterState.map.get("||example.com^");
    assert.strictEqual(state.lastHit, 1);
  });

  it("sets state from arguments, discarding unknown properties", function() {
    filterState.fromObject("||example.com^", {disabled: true, lastHit: 1, hitCount: 1, unknown: 1});
    let state = filterState.map.get("||example.com^");
    assert.strictEqual(state.disabled, true);
    assert.strictEqual(state.hitCount, 1);
    assert.strictEqual(state.lastHit, 1);
    assert.strictEqual(state.unknown, undefined);
  });

  it("deletes state when it is reset", function() {
    filterState.fromObject("||example.com^", {disabled: false, lastHit: 0, hitCount: 0});
    let state = filterState.map.get("||example.com^");
    assert.strictEqual(state, undefined);
  });

  it("deletes state when it is reset with empty disabled array", function() {
    filterState.fromObject("||example.com^", {disabled: [], lastHit: 0, hitCount: 0});
    let state = filterState.map.get("||example.com^");
    assert.strictEqual(state, undefined);
  });
});

describe("filterState.serialize()", function() {
  context("No state", function() {
    it("returns undefined when serialized", function() {
      assert.strictEqual(filterState.serialize("||example.com^").next().done, true);
    });
  });

  context("With state", function() {
    it("returns header", function() {
      filterState.fromObject("||example.com^", {disabled: true});

      let expectedResults = ["[Filter]", "text=||example.com^", "disabled=true"];
      for (let line of filterState.serialize("||example.com^"))
        assert.strictEqual(line, expectedResults.shift());

      assert.strictEqual(expectedResults.length, 0);
    });

    it("returns disabled, hitCount and lastHit if they are not set to false, 0, 0 respectively", function() {
      filterState.fromObject("||example.com^", {disabled: true, lastHit: 1, hitCount: 1});

      let expectedResults = ["[Filter]", "text=||example.com^", "disabled=true", "hitCount=1", "lastHit=1"];
      for (let line of filterState.serialize("||example.com^"))
        assert.strictEqual(line, expectedResults.shift());

      assert.strictEqual(expectedResults.length, 0);
    });

    it("omits disabled if set to false", function() {
      filterState.fromObject("||example.com^", {disabled: false, lastHit: 1, hitCount: 1});

      let expectedResults = ["[Filter]", "text=||example.com^", "hitCount=1", "lastHit=1"];
      for (let line of filterState.serialize("||example.com^"))
        assert.strictEqual(line, expectedResults.shift());

      assert.strictEqual(expectedResults.length, 0);
    });

    it("returns disabledSubscriptions if it has value", function() {
      filterState.fromObject("||example.com^", {disabledSubscriptions: ["~user", "~easylist"]});

      let expectedResults = ["[Filter]", "text=||example.com^", "disabledSubscriptions[]=~user", "disabledSubscriptions[]=~easylist"];
      for (let line of filterState.serialize("||example.com^"))
        assert.strictEqual(line, expectedResults.shift());

      assert.strictEqual(expectedResults.length, 0);
    });

    it("omits hitCount if set to 0", function() {
      filterState.fromObject("||example.com^", {disabled: true, lastHit: 1, hitCount: 0});

      let expectedResults = ["[Filter]", "text=||example.com^", "disabled=true", "lastHit=1"];
      for (let line of filterState.serialize("||example.com^"))
        assert.strictEqual(line, expectedResults.shift());

      assert.strictEqual(expectedResults.length, 0);
    });

    it("omits lastHit if set to 0", function() {
      filterState.fromObject("||example.com^", {disabled: true, lastHit: 0, hitCount: 1});

      let expectedResults = ["[Filter]", "text=||example.com^", "disabled=true", "hitCount=1"];
      for (let line of filterState.serialize("||example.com^"))
        assert.strictEqual(line, expectedResults.shift());

      assert.strictEqual(expectedResults.length, 0);
    });
  });
});
