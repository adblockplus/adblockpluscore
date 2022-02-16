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

/* eslint no-console: "off" */
/* global self */

/** @module */

"use strict";

const {performance, PerformanceObserver} = require("perf_hooks");

/**
 * Default profiler("...") returned object when profile mode is disabled.
 * @type {Profiler}
 * @private
 */
let noopProfiler = {
  start() {},
  mark() {},
  end() {},
  toString() {
    return "{start(){},mark(){},end(){}}";
  }
};

let inactiveProfiling = true;
let obs = null;

/** Enable or disable profiling
 *
 * @param {bool} enable the profiling is enabled. If true it will
 * create a PerformanceObserver and start observing, profiler() will then
 * create a proper profiler object. If false, observing is cancelled and
 * the profiler object will be a noop.
 * @param {?Function} reporter The reporter function called by the observer.
 * If falsy, the default reporter will be used.
 */
function enableProfiling(enable, reporter) {
  inactiveProfiling = !enable;
  if (enable) {
    performance.mark("start_profile");
    if (!reporter) {
      reporter = list => {
        for (let entry of list.getEntriesByType("measure"))
          console.log(`${entry.name}: ${entry.duration}ms`);
      };
    }
    obs = new PerformanceObserver(reporter);

    obs.observe({entryTypes: ["measure"]});
  }
  else if (obs) {
    obs.disconnect();
    obs = null;
  }
}

/**
 * Create a profiler object with `start()` `mark()` and `end()` methods to
 * either start, keep marking a specific profiled name, or ending it.
 *
 * @example
 * let {mark, end} = profiler('console.log');
 * mark();
 * console.log(1, 2, 3);
 * end();
 *
 * @param {string} id the unique ID to profile.
 * @returns {Profiler} The profiler with `start()`, `mark()` and
 * `end(clear = false)` methods.
 * @private
 */
function profiler(id) {
  if (inactiveProfiling)
    return noopProfiler;

  return {
    id,
    start() {
      performance.mark(`${id}:start`);
      performance.measure(`${id}:startup`, "start_profile", `${id}:start`);
    },
    mark(event) {
      performance.mark(`${id}:${event}`);
      performance.measure(
        `${id}:${event}_measure`, "start_profile", `${id}:${event}`
      );
    },
    end() {
      performance.mark(`${id}:end`);
      performance.measure(id, "start_profile", `${id}:end`);
    }
  };
}

function isProfilingEnabled() {
  return !inactiveProfiling;
}

exports.profiler = profiler;
exports.enable = enableProfiling;
exports.isEnabled = isProfilingEnabled;
