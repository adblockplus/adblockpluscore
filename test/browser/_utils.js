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

function timeout(delay) {
  return new Promise(resolve => {
    setTimeout(resolve, delay);
  });
}

exports.timeout = timeout;

/**
 * Promise that resolves after a predicate becomes true. The
 * `predicate` is called every `pollingInverval` ms, until it returns
 * true. If this does not happen within `maxTimeout` ms, then the
 * promise is rejected.
 * @param {function} predicate This function will be called at regular intervals until it returns `true`
 * @param {number} [pollingInterval] How often in ms to call `predicate`
 * @param {number} [maxTimeout] How long in ms to keep polling before rejecting the promise.
 * @returns {Promise} A promise resolved after `predicate` returns `true`.
 */
exports.waitFor = async function(predicate, pollingInterval = 10, maxTimeout = 1000) {
  let startTime = performance.now();
  while (!predicate()) {
    if (performance.now() - startTime > maxTimeout)
      throw new Error("Timeout");

    await timeout(pollingInterval);
  }
};
