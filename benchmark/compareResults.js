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
const {describe, it, before} = require("mocha");

const BENCHMARK_RESULTS = path.join(__dirname, "benchmark_results.json");
const THRESHOLDS = path.join(__dirname, "benchmark_thresholds.json");
const MASTER_CURRENT_DIFF_PERCENT = 15;

let timestampsToAnalyze;
let dataToAnalyze = {};
let thresholds = {};
let timestampCurrentBranch = process.env.npm_config_current;
let timestampRefBranch = process.env.npm_config_refs;


function getDataForMetrics(metrics, key) {
  let currentBranchValue =
          dataToAnalyze[timestampCurrentBranch][key][metrics];
  let refBranchValue = dataToAnalyze[timestampRefBranch][key][metrics];
  return {currentBranchValue, refBranchValue};
}

describe("Measure performance", function() {
  before(async function() {
    dataToAnalyze = await helpers.loadDataFromFile(BENCHMARK_RESULTS);
    thresholds = await helpers.loadDataFromFile(THRESHOLDS);
  });

  let valueKeysWithGitMeta = [];
  // If no flag with Timestamps passed
  // code will only compare last two entries in benchmark results or fail.
  // That should be proper outcome of benchmark-entrypoint.sh
  if (typeof dataToAnalyze[timestampCurrentBranch] == "undefined" ||
    typeof dataToAnalyze[timestampRefBranch] == "undefined") {
    timestampsToAnalyze = Object.keys(dataToAnalyze);
    const timestampsLength = timestampsToAnalyze.length;

    if (timestampsLength < 2) {
      it("Fail if there is no data to compare", async function() {
        assert.fail("Not enough data to compare, please run" +
          " ``` sh benchmarkEntrypoint.sh to create data ```.");
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

  it(`Check if difference between master & current code is less than ${ MASTER_CURRENT_DIFF_PERCENT}%`,
     async function() {
       let extendedDiffArray = [];
       for (let key of valueKeys) {
         for (let metrics in dataToAnalyze[timestampCurrentBranch][key]) {
           let {currentBranchValue, refBranchValue} =
             await getDataForMetrics(metrics, key);
           let diffPercent =
             ((currentBranchValue - refBranchValue) / refBranchValue) * 100;

           if (diffPercent > MASTER_CURRENT_DIFF_PERCENT) {
             extendedDiffArray.push(`Measured data: ${key}, Metrics: ${metrics}` +
               `CurrentBranch value: ${currentBranchValue}, Ref branch value: ${refBranchValue}`);
           }
         }
         assert.equal(extendedDiffArray.length > 0, false, `Performance got worse. Metrics to check: ${extendedDiffArray}`);
       }
     });

  for (let key of valueKeys) {
    for (let metrics in dataToAnalyze[timestampCurrentBranch][key]) {
      let thresholdForMetric = thresholds[key][metrics];
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

