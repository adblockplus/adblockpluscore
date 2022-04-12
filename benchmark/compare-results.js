
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
let timestampCurrentBranch = process.env.npm_config_current;
let timestampRefBranch = process.env.npm_config_refs;


async function getDataForMetrics(metrics, key) {
  let currentBranchValue =
          dataToAnalyze[timestampCurrentBranch][key][metrics];
  let refBranchValue = dataToAnalyze[timestampRefBranch][key][metrics];
  return {currentBranchValue, refBranchValue};
}

describe("Measure performance", async function() {
  dataToAnalyze = await helpers.loadDataFromFile(BENCHMARK_RESULTS);
  thresholds = await helpers.loadDataFromFile(THRESHOLDS);
  let valueKeysWithGitMeta = [];
  // If no flag with Timestamps passed
  // Code will only compare last two entries in benchmark results or fail.
  // That should be proper outcome of benchmark-entrypoint.sh
  if (typeof dataToAnalyze[timestampCurrentBranch] == "undefined" ||
    typeof dataToAnalyze[timestampRefBranch] == "undefined") {
    timestampsToAnalyze = Object.keys(dataToAnalyze);
    const timestampsLength = timestampsToAnalyze.length;

    if (timestampsLength < 2) {
      it("Fail if there is no data to compare", async function() {
        assert.fail("Not enough data to compare, please run" +
          " ``` sh benchmark-entrypoint.sh to create data ```.");
      });
    }
    else {
      timestampCurrentBranch = timestampsToAnalyze[timestampsLength - 2];
      timestampRefBranch = timestampsToAnalyze[timestampsLength - 1];
      for (let timestamp in dataToAnalyze)
        valueKeysWithGitMeta = Object.keys(dataToAnalyze[timestamp]);
    }
  }
  else {
    valueKeysWithGitMeta = Object.keys(dataToAnalyze[timestampCurrentBranch]);
  }
  // Filter out all git details
  const valueKeys = valueKeysWithGitMeta.filter(
    word => (word !== "Refs" && word !== "CommitHash"));

  it("Compare Results between master and current commit", async function() {
    let extendedDiffArray = [];
    // console.log(`┏${"━".repeat(87)}┓`);
    // helpers.printTableSeparator("┳");
    // helpers.fillTab("", "Current", "Master", "Diff");
    for (let key of valueKeys) {
      //  console.log(`┏${"━".repeat(30)}${key.padEnd(57, "━")}┓`);
      for (let metrics in dataToAnalyze[timestampCurrentBranch][key]) {
        let {currentBranchValue, refBranchValue} =
          await getDataForMetrics(metrics, key);
        let diff =
          ((currentBranchValue - refBranchValue) / refBranchValue) * 100;

        //   helpers.printTableSeparator("╋");
        //   helpers.fillTab(
        //     metrics,
        //     currentBranchValue.toFixed(3),
        //     refBranchValue.toFixed(3),
        //     diff.toFixed(3)
        //   );
        if (diff > 15) {
          extendedDiffArray.push(`Measured data: ${key}, Metrics: ${metrics}` +
          `CurrentBranch value: ${currentBranchValue}, Ref branch value: ${refBranchValue}`);
        }
      }
      //  helpers.printTableSeparator("┻", "┗", "┛");
      assert.equal(extendedDiffArray.length > 0, false, `Performance got worse. Metrics to check: ${extendedDiffArray}`);
    }
  });

  for (let key of valueKeys) {
    for (let metrics in dataToAnalyze[timestampCurrentBranch][key]) {
      let thresholdForMetric = thresholds[key][metrics];
      // eslint-disable-next-line no-undefined
      if (typeof thresholdForMetric == "undefined")
        continue;

      it(`Checks if in ${key} for ${metrics} extended threshold`, async function() {
        let {currentBranchValue, refBranchValue} =
          await getDataForMetrics(metrics, key);
        let diff = (currentBranchValue - refBranchValue);
        assert.equal(diff > thresholdForMetric, false, `${metrics} in ${key} extended threshold` +
          `Threshold ${thresholdForMetric}, Value: ${diff.toFixed(3)}`);
      });
    }
  }
});

