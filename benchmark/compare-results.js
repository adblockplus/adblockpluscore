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

/* eslint-env node */
/* eslint no-console: "off" */

/* global gc */

"use strict";

const helpers = require("./helpers.js");
const path = require("path");
const BENCHMARK_RESULTS = path.join(__dirname, "benchmarkresults.json");


async function main() {
  let dataToAnalyze = await helpers.loadDataFromFile(BENCHMARK_RESULTS);
  let valueKeysWithGitMeta = [];
  let extendedDiffArray = [];
  let timestampsToAnalyze = Object.keys(dataToAnalyze);
  // eslint-disable-next-line max-len
  for (let timestamp in dataToAnalyze)
    valueKeysWithGitMeta = Object.keys(dataToAnalyze[timestamp]);

  let valueKeys = valueKeysWithGitMeta.filter(
    word => (word !== "Refs" && word !== "CommitHash"));

  // Code will only compare last two entries in benchmark results.
  // That should be proper outcome of benchmark-entrypoint.sh
  let currentBranchValue;
  let nextBranchValue;
  console.log(`┏${"━".repeat(80)}┓`);
  helpers.printTableSeparator("┳");
  helpers.fillTab(" ", "Current Branch", "Next Branch", "Diff");
  for (let key of valueKeys){
    helpers.fillTab("", "", key, "");
    // eslint-disable-next-line max-len
    const timestampCurrentBranch = timestampsToAnalyze[timestampsToAnalyze.length - 2];
    for (let metrics in dataToAnalyze[timestampCurrentBranch][key]){
      if (metrics == "TimeMean")
        continue;
      // eslint-disable-next-line max-len
      currentBranchValue = dataToAnalyze[timestampCurrentBranch][key][metrics];
      // eslint-disable-next-line max-len
      const timestampNextBranch = timestampsToAnalyze[timestampsToAnalyze.length - 1];
      nextBranchValue = dataToAnalyze[timestampNextBranch][key][metrics];
      // eslint-disable-next-line max-len

      let diff =
        ((currentBranchValue - nextBranchValue) / nextBranchValue) * 100;

      helpers.printTableSeparator("╋");
      helpers.fillTab(
        metrics,
        currentBranchValue.toFixed(3),
        nextBranchValue.toFixed(3),
        diff.toFixed(3)
      );
      if (diff.toFixed(3) > 10)
        extendedDiffArray.push(`Measured data: ${key}, Metrics: ${metrics}`);
    }
    helpers.printTableSeparator("┻", "┗", "┛");
    if (extendedDiffArray.length > 0)
      throw new Error(`Performance got worse. Metrics to be fixed: ${extendedDiffArray}`);
  }
}



if (require.main == module)
  main();
