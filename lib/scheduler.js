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

/**
 * @fileOverview Manages scheduling.
 */

/**
 * Scheduler implementation based on `setTimeout()`
 */
exports.TimeoutScheduler = class TimeoutScheduler {
  constructor() {
    /**
     * Store the timeout ID for scheduled checks.
     * @type {number}
     */
    this._timeout = 0;
  }

  /**
   * Set a callback
   * (must be set before `start()` call)
   * @param {function} callback  function to be called
   */
  setCallback(callback) {
    this._callback = callback;
  }

  /**
   * Schedules checks at regular time intervals.
   *
   * @param {number} interval The interval between checks in milliseconds.
   * @param {number} delay The delay before the initial check in milliseconds.
   */
  start(interval, delay) {
    // clear previous timeouts if called too many times
    this.stop();

    let check = () => {
      try {
        this._callback();
      }
      finally {
        // Schedule the next check only after the callback has finished with
        // the current check.
        this._timeout =
          setTimeout(check, interval); // eslint-disable-line no-undef
      }
    };

    // Note: test/_common.js overrides setTimeout() for the tests; if this
    // global function is used anywhere else, it may give incorrect results.
    // This is why we disable ESLint's no-undef rule locally.
    // https://gitlab.com/eyeo/adblockplus/adblockpluscore/issues/43
    this._timeout = setTimeout(check, delay); // eslint-disable-line no-undef
  }

  /**
   * Clear previously scheduled checks, if any.
   */
  stop() {
    if (this._timeout) {
      clearTimeout(this._timeout); // eslint-disable-line no-undef
      this._timeout = 0;
    }
  }
};
