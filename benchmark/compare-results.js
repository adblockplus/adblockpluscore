
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

/* eslint-disable prefer-arrow-callback */
/* eslint-env node */
/* eslint no-console: "off" */

/* global gc */

"use strict";

const assert = require("assert");
const helpers = require("./helpers.js");
const path = require("path");
const {describe, it} = require("mocha");

const BENCHMARK_RESULTS = path.join(__dirname, "benchmarkresults.json");
const THRESHOLDS = path.join(__dirname, "benchmarkThresholds.json");

let timestampsToAnalyze;
let dataToAnalyze = {};
let thresholds = {};
let timestampCurrentBranch;
let timestampRefBranch;


async function getDataForMetrics(metrics, key) {
  let currentBranchValue;
  let refBranchValue;
  let diff;
  currentBranchValue =
          dataToAnalyze[timestampCurrentBranch][key][metrics];
  currentBranchValue.toFixed(3);
  refBranchValue = dataToAnalyze[timestampRefBranch][key][metrics];
  refBranchValue.toFixed(3);
  diff = currentBranchValue - refBranchValue;
  diff.toFixed(3);
  return {currentBranchValue, refBranchValue, diff};
}
describe("Measure performance", async function() {
  dataToAnalyze = await helpers.loadDataFromFile(BENCHMARK_RESULTS);
  thresholds = await helpers.loadDataFromFile(THRESHOLDS);
  timestampsToAnalyze = Object.keys(dataToAnalyze);
  let valueKeysWithGitMeta = [];
  for (let timestamp in dataToAnalyze)
    valueKeysWithGitMeta = Object.keys(dataToAnalyze[timestamp]);

  // Filter out all git details
  const valueKeys = valueKeysWithGitMeta.filter(
    word => (word !== "Refs" && word !== "CommitHash"));

  // Code will only compare last two entries in benchmark results.
  // That should be proper outcome of benchmark-entrypoint.sh
  const timestampsLength = timestampsToAnalyze.length;
  timestampCurrentBranch = timestampsToAnalyze[timestampsLength - 2];
  timestampRefBranch = timestampsToAnalyze[timestampsLength - 1];

  it("Compare Results between master and current commit", async function() {
    let extendedDiffArray = [];
    console.log(`┏${"━".repeat(87)}┓`);
    helpers.printTableSeparator("┳");
    helpers.fillTab("", "Current", "Master", "Diff");
    for (let key of valueKeys){
      console.log(`┏${"━".repeat(30)}${key.padEnd(57, "━")}┓`);
      let currentBranchValue;
      let refBranchValue;
      for (let metrics in dataToAnalyze[timestampCurrentBranch][key]){
        if (metrics == "TimeMean")
          continue;
        let diff;
        ({currentBranchValue, refBranchValue, diff} =
          await getDataForMetrics(metrics, key));
        diff = (diff / refBranchValue) * 100;
        helpers.printTableSeparator("╋");
        helpers.fillTab(
          metrics,
          currentBranchValue.toFixed(3),
          refBranchValue.toFixed(3),
          diff.toFixed(3)
        );
        if (diff.toFixed(3) > 10)
          extendedDiffArray.push(`Measured data: ${key}, Metrics: ${metrics}`);
      }
      helpers.printTableSeparator("┻", "┗", "┛");
      assert.equal(extendedDiffArray.length > 0, false, `Performance got worse. Metrics to check: ${extendedDiffArray}`);
    }
  });

  for (let key of valueKeys) {
    for (let metrics in dataToAnalyze[timestampCurrentBranch][key]){
      // eslint-disable-next-line no-undefined
      if (thresholds[key][metrics] == undefined)
        continue;
      it(`Checks if in ${key} for ${metrics} extended threshold`, async function() {
        let diff;
        ({diff} =
          await getDataForMetrics(metrics, key));
        assert.equal(diff > thresholds[key][metrics], false, `${metrics} in ${key} extended threshold`);
      });
    }
  }
});

