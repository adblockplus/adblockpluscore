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

/** @module */

"use strict";

const {filterNotifier} = require("./filterNotifier");

/**
 * `{@link module:filterState filterState}` implementation.
 */

class FilterState {
  constructor() {
    /**
     * Internal map containing filter state.
     * @type {Map.<string, FilterStateEntry>}
     */
    this.map = new Map();
  }

  /**
   * Gets which subscriptions this filters has been disabled for.
   * @param {string} filterText The text of the filter.
   * @returns {Set<string>} Set of subscription urls that this filter
   * has been disabled for.
   */
  disabledSubscriptions(filterText) {
    let state = this.map.get(filterText);
    if (!state || typeof state.disabledSubscriptions !== "object")
      return new Set();
    return state.disabledSubscriptions;
  }

  /**
   * Reset the disabled status of this filter to the default of
   * enabled for all subscriptions.
   * @param {string} filterText The text of the filter.
   */
  resetEnabled(filterText) {
    this._updateStateObject(filterText, state => {
      state.resetEnabled();
    });
  }

  /**
   * Checks whether a filter is disabled for a subscription.
   * @param {string} filterText The text of the filter.
   * @param {string} subscriptionUrl The subscription to check for
   * enabled / disabled state.
   * @returns {boolean} Whether the filter is disabled.
   */
  isDisabledForSubscription(filterText, subscriptionUrl) {
    let state = this.map.get(filterText);
    if (state)
      return state.isDisabledForSubscription(subscriptionUrl);
    return false;
  }

  /**
   * Sets the disabled state of a filter for a subscription.
   * @param {string} filterText The text of the filter.
   * @param {string} subscriptionUrl The subscription to enable /
   * disable the filter in.
   * @param {boolean} disabled The new disabled state of the filter.
   */
  setDisabledForSubscription(filterText, subscriptionUrl, disabled) {
    this._updateStateObject(filterText, state => {
      state.setDisabledForSubscription(subscriptionUrl, disabled);
    });
  }

  /**
   * Checks whether a filter is enabled.
   * @param {string} filterText The text of the filter.
   * @returns {boolean} Whether the filter is enabled.
   * @deprecated Use
   * {@link module:filterState~FilterState#isDisabledForSubscription} instead
   */
  isEnabled(filterText) {
    let state = this.map.get(filterText);
    if (state)
      return state.enabled;
    return true;
  }

  /**
   * Sets the enabled state of a filter.
   * @param {string} filterText The text of the filter.
   * @param {boolean} enabled The new enabled state of the filter.
   * @deprecated Use
   * {@link module:filterState~FilterState#setDisabledForSubscription} instead
   */
  setEnabled(filterText, enabled) {
    this._updateStateObject(filterText, state => {
      state.enabled = enabled;
    });
  }

  /**
   * Toggles the enabled state of a filter.
   * @param {string} filterText The text of the filter.
   * @deprecated Use
   * {@link module:filterState~FilterState#setDisabledForSubscription} instead
   */
  toggleEnabled(filterText) {
    let newValue = !this.isEnabled(filterText);
    this.setEnabled(filterText, newValue);
  }

  /**
   * Returns the hit count of a filter.
   * @param {string} filterText The text of the filter.
   * @returns {number} The hit count of the filter.
   */
  getHitCount(filterText) {
    let state = this.map.get(filterText);
    if (state)
      return state.hitCount;

    return 0;
  }

  /**
   * Sets the hit count of a filter.
   * @param {string} filterText The text of the filter.
   * @param {number} hitCount The new hit count of the filter.
   */
  setHitCount(filterText, hitCount) {
    this._updateStateObject(filterText, state => {
      state.hitCount = hitCount;
    });
  }

  /**
   * Resets the hit count of a filter.
   * @param {string} filterText The text of the filter.
   */
  resetHitCount(filterText) {
    this.setHitCount(filterText, 0);
  }

  /**
   * Returns the last hit time of a filter.
   * @param {string} filterText The text of the filter.
   * @returns {number} The last hit time of the filter in milliseconds since
   *   the Unix epoch.
   */
  getLastHit(filterText) {
    let state = this.map.get(filterText);
    if (state)
      return state.lastHit;

    return 0;
  }

  /**
   * Sets the last hit time of a filter.
   * @param {string} filterText The text of the filter.
   * @param {number} lastHit The new last hit time of the filter in
   *   milliseconds since the Unix epoch.
   */
  setLastHit(filterText, lastHit) {
    this._updateStateObject(filterText, state => {
      state.lastHit = lastHit;
    });
  }

  /**
   * Resets the last hit time of a filter.
   * @param {string} filterText The text of the filter.
   */
  resetLastHit(filterText) {
    this.setLastHit(filterText, 0);
  }

  /**
   * Registers a filter hit by incrementing the hit count of the filter and
   * setting the last hit time of the filter to the current time.
   * @param {string} filterText The text of the filter.
   */
  registerHit(filterText) {
    let now = Date.now();
    this._updateStateObject(filterText, state => {
      state.hitCount++;
      state.lastHit = now;
    });
  }

  /**
   * Resets the hit count and last hit time of a filter.
   * @param {string} filterText The text of the filter.
   */
  resetHits(filterText) {
    this._updateStateObject(filterText, state => {
      state.hitCount = 0;
      state.lastHit = 0;
    });
  }

  /**
   * Resets the enabled state, hit count, and last hit time of a filter.
   * @param {string} filterText The text of the filter.
   */
  reset(filterText) {
    let state = this.map.get(filterText);
    if (!state)
      return;

    this.map.delete(filterText);

    if (state.enabled !== true) {
      filterNotifier.emit("filterState.enabled",
                          filterText,
                          true,
                          state.enabled);
    }

    if (state.disabledSubscriptions && state.disabledSubscriptions.size > 0) {
      filterNotifier.emit("filterState.disabledSubscriptions",
                          filterText,
                          new Set(),
                          state.disabledSubscriptions);
    }

    if (state.hitCount != 0) {
      filterNotifier.emit("filterState.hitCount",
                          filterText,
                          0,
                          state.hitCount);
    }

    if (state.lastHit != 0)
      filterNotifier.emit("filterState.lastHit", filterText, 0, state.lastHit);
  }

  /**
   * Serializes the state of a filter.
   * @param {string} filterText The text of the filter.
   * @yields {string} The next line in the serialized representation of the
   *   state of the filter.
   * @see module:filterState~FilterState#fromObject
   * @package
   */
  *serialize(filterText) {
    let state = this.map.get(filterText);
    if (!state)
      return;

    yield "[Filter]";
    yield "text=" + filterText;

    if (state.disabled) {
      yield "disabled=true";
    }
    else if (typeof state.disabledSubscriptions === "object") {
      for (let disabledSubscription of state.disabledSubscriptions)
        yield "disabledSubscriptions[]=" + disabledSubscription;
    }

    if (state.hitCount != 0)
      yield "hitCount=" + state.hitCount;
    if (state.lastHit != 0)
      yield "lastHit=" + state.lastHit;
  }

  /**
   * Reads the state of a filter from an object representation.
   * @param {string} filterText The text of the filter.
   * @param {object} object An object containing at least one of `disabled`,
   *   `hitCount`, and `lastHit` properties and their appropriate values.
   * @see module:filterState~FilterState#serialize
   * @package
   */
  fromObject(filterText, object) {
    if (!("disabled" in object ||
          "disabledSubscriptions" in object ||
          "hitCount" in object ||
          "lastHit" in object))
      return;

    let state = new FilterStateEntry();
    if (String(object.disabled) == "true")
      state.disabled = true;
    else if (typeof object.disabledSubscriptions === "object")
      state.disabledSubscriptions = new Set(object.disabledSubscriptions);

    state.hitCount = parseInt(object.hitCount, 10) || 0;
    state.lastHit = parseInt(object.lastHit, 10) || 0;
    if (!state.isEmpty())
      this.map.set(filterText, state);
  }

  _updateStateObject(filterText, doUpdate) {
    let state = this.map.get(filterText);
    if (!state) {
      state = new FilterStateEntry();
      this.map.set(filterText, state);
    }

    let oldHitCount = state.hitCount;
    let oldLastHit = state.lastHit;
    let oldEnabled = state.enabled;
    let oldDisabledSubscriptions = new Set(state.disabledSubscriptions);

    doUpdate(state);

    let newHitCount = state.hitCount;
    let newLastHit = state.lastHit;
    let newEnabled = state.enabled;
    let newDisabledSubscriptions = new Set(state.disabledSubscriptions);

    if (state.isEmpty())
      this.map.delete(filterText);

    if (oldHitCount !== newHitCount) {
      filterNotifier.emit("filterState.hitCount",
                          filterText,
                          newHitCount,
                          oldHitCount);
    }

    if (oldLastHit !== newLastHit) {
      filterNotifier.emit("filterState.lastHit",
                          filterText,
                          newLastHit,
                          oldLastHit);
    }

    if (oldEnabled !== newEnabled) {
      filterNotifier.emit("filterState.enabled",
                          filterText,
                          newEnabled,
                          oldEnabled);
    }

    if (!disabledSubscriptionsEquals(oldDisabledSubscriptions,
                                     newDisabledSubscriptions)) {
      filterNotifier.emit("filterState.disabledSubscriptions",
                          filterText,
                          newDisabledSubscriptions,
                          oldDisabledSubscriptions);
    }
  }
}

/**
 * Represents the state for a single filter.
 * See {@link module:filterState~FilterState}
 */
class FilterStateEntry {
  constructor() {
    /**
     * The hit count of the filter.
     * @type {number}
     */
    this.hitCount = 0;

    /**
     * The last hit time of the filter in milliseconds since the Unix epoch.
     * @type {number}
     */
    this.lastHit = 0;
  }

  /**
   * Check if the state is empty, so we know if we can clean it up.
   * @returns {boolean}
   */
  isEmpty() {
    return this.hitCount === 0 &&
      this.lastHit === 0 &&
      !this.disabled &&
      !this.disabledSubscriptions;
  }

  /**
   * Check if a filter is disabled for a specified subscription.
   * @param {string} subscriptionUrl The subscription to check for
   * enabled / disabled state.
   * @returns {boolean}
   */
  isDisabledForSubscription(subscriptionUrl) {
    if (this.disabled === true)
      return true;
    return this.disabledSubscriptions &&
      this.disabledSubscriptions.has(subscriptionUrl);
  }

  /**
   * Sets the disabled state of a filter.
   * @param {string} subscriptionUrl The subscription to enable /
   * disable the filter in.
   * @param {boolean} disabled The new disabled state of the filter.
   */
  setDisabledForSubscription(subscriptionUrl, disabled) {
    delete this.disabled;

    if (!this.disabledSubscriptions && !disabled)
      return;

    if (!this.disabledSubscriptions)
      this.disabledSubscriptions = new Set();

    if (disabled) {
      this.disabledSubscriptions.add(subscriptionUrl);
    }
    else {
      this.disabledSubscriptions.delete(subscriptionUrl);
      if (this.disabledSubscriptions.size === 0)
        delete this.disabledSubscriptions;
    }
  }

  /**
   * Reset the disabled status of this filter to the default of
   * enabled for all subscriptions.
   */
  resetEnabled() {
    delete this.disabled;
    delete this.disabledSubscriptions;
  }

  /**
   * Representation of filter state for the deprecated global enabling
   * and disabling of filters, as well as the `filterState.enabled`
   * events.
   * @type {boolean}
   * @deprecated Prefer {@link isDisabledForSubscription}
   */
  get enabled() {
    return !this.disabled;
  }
  set enabled(value) {
    delete this.disabledSubscriptions;
    this.disabled = !value;
  }
}

/**
 * Checks if two sets of disabled subscription urls contain exactly
 * the same subscription urls.
 * @param {Set<string>} oldDisabledSubscriptions
 * @param {Set<string>} newDisabledSubscriptions
 * @returns {boolean}
 */
function disabledSubscriptionsEquals(oldDisabledSubscriptions,
                                     newDisabledSubscriptions) {
  if (oldDisabledSubscriptions.size !== newDisabledSubscriptions.size)
    return false;

  for (let old of oldDisabledSubscriptions) {
    if (!newDisabledSubscriptions.has(old))
      return false;
  }
  return true;
}

/**
 * Maintains filter state.
 * @type {module:filterState~FilterState}
 */
exports.filterState = new FilterState();
