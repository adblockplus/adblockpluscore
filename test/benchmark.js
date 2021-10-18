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

let {
  createSandbox, setupTimerAndFetch, setupRandomResult, LIB_FOLDER
} = require("./_common");

let filterStorage = null;
let Subscription = null;
let synchronizer = null;
let profiler = null;


describe("Synchronizer", function() {
  let runner = {};
  let events = [];

  beforeEach(function() {
    runner = {};

    let globals = Object.assign({}, setupTimerAndFetch.call(runner), setupRandomResult.call(runner));

    let sandboxedRequire = createSandbox({globals});
    (
      {filterStorage} = sandboxedRequire(LIB_FOLDER + "/filterStorage"),
      {Subscription} = sandboxedRequire(LIB_FOLDER + "/subscriptionClasses"),
      {synchronizer} = sandboxedRequire(LIB_FOLDER + "/synchronizer"),
      profiler = sandboxedRequire(LIB_FOLDER + "/profiler")
    );

    profiler.enable(true, list => {
      for (let entry of list.getEntriesByType("measure"))
        events.push(entry);
    });
  });

  afterEach(function() {
    profiler.enable(false);
  });

  describe("It starts the synchronizer", function() {
    beforeEach(function() {
      events = [];
      synchronizer.start();
    });

    afterEach(function() {
      synchronizer.stop();
    });

    it("Benchmarking events are fired", async function() {
      runner.registerHandler("/subscription", metadata => {
        return [200, "[Adblock]\n! ExPiREs: 1day\nfoo\nbar"];
      });

      let subscription = Subscription.fromURL("https://example.com/subscription");
      filterStorage.addSubscription(subscription);
      await runner.runScheduledTasks(1);

      // From node 16 onwards, the profiler no longer has a
      // synchronous callback mode. This means that we need to await a
      // timeout here to give the async callback an opportunity to
      // run.
      await new Promise(setImmediate);

      assert.equal(events.length, 7, "Benchmarking events count");
      const eventTypes = events.map(event =>
        event.name.slice(event.name.lastIndexOf(":") + 1));
      assert.deepEqual(eventTypes, [
        "startup",
        "downloading.started_measure",
        "downloading.finished_measure",
        "parsing.started_measure",
        "parsing.finished_measure",
        "processing.started_measure",
        "processing.finished_measure"
      ], "Benchmarking event types");
    });
  });
});
