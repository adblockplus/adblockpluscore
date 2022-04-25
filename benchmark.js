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

const path = require("path");
const helpers = require("./benchmark/helpers.js");
const {createHistogram, performance} = require("perf_hooks");

let saveData = helpers.getFlagExists("save");
let saveTempData = helpers.getFlagExists("save-temp");
let deleteTempData = helpers.getFlagValue("dt");
let filterListName = helpers.getFlagValue("filter-list");
let matchListCase = helpers.getFlagValue("match-list");
let runMatchingBenchmark = helpers.getFlagExists("match");
let benchmarkDate = helpers.getFlagValue("ts") || new Date().toISOString();
let benchmarkDataEntryName;
if (runMatchingBenchmark) {
  if (filterListName)
    benchmarkDataEntryName = `Matching_${matchListCase}_${filterListName}`;
  else
    benchmarkDataEntryName = `Matching_${matchListCase}`;
}
else {
  benchmarkDataEntryName = `FilterList_${filterListName}`;
}

// Holds benchmark results that will be merged into json file
let benchmarkResults = {};
let matchResults = {};
benchmarkResults[benchmarkDate] = {};
let dataToSaveForTimestamp = benchmarkResults[benchmarkDate];
dataToSaveForTimestamp[benchmarkDataEntryName] = {};
let filterBenchmarkData = dataToSaveForTimestamp[benchmarkDataEntryName];

const {Filter} = require("./lib/filterClasses");
const {parseURL} = require("./lib/url");
const {contentTypes} = require("./lib/contentTypes");

const BENCHMARK_RESULTS = path.join(
  __dirname,
  "/benchmark/benchmark_results.json"
);
const TEMP_BENCHMARK_RESULTS = path.join(
  __dirname,
  "/benchmark/temp_results.json"
);

function sliceString(str) {
  // Create a new string in V8 to free up the parent string.
  return JSON.parse(JSON.stringify(str));
}

function toMiB(numBytes) {
  return numBytes / 1024 / 1024;
}

function nanosToMillis(nanos) {
  return nanos / 1e6;
}

async function mergeAndSaveData(dataToMerge) {
  if (saveData) {
    let benchmarkDataToSave =
        helpers.mergeToBenchmarkResults(dataToMerge, BENCHMARK_RESULTS);
    await helpers.saveToFile(benchmarkDataToSave, BENCHMARK_RESULTS);
  }
  if (saveTempData) {
    let tempBenchmarkDataToSave =
        helpers.mergeToBenchmarkResults(dataToMerge, TEMP_BENCHMARK_RESULTS);
    await helpers.saveToFile(tempBenchmarkDataToSave, TEMP_BENCHMARK_RESULTS);
  }
}

function printMemory(type = "filterEngine", index = 1) {
  gc();
  let {heapUsed, heapTotal} = process.memoryUsage();
  if (type != "Matching") {
    console.log(`Heap (used): ${toMiB(heapUsed)} MiB`);
    console.log(`Heap (total): ${toMiB(heapTotal)} MiB`);
    console.log();
    filterBenchmarkData["HeapUsed"] = toMiB(heapUsed);
    filterBenchmarkData["HeapTotal"] = toMiB(heapTotal);
  }

  // For counting match results
  matchResults[`${type}_HeapUsed_${index}`] = toMiB(heapUsed);
  matchResults[`${type}_HeapTotal_${index}`] = toMiB(heapTotal);
}

function runMatch(filterEngine, filters, location, contentType, docDomain,
                  sitekey, specificOnly) {
  let url = parseURL(location);
  for (let filter of filters)
    filterEngine.add(Filter.fromText(filter));

  for (let arg of [url, location]) {
    filterEngine.match(arg,
                       contentTypes[contentType],
                       docDomain,
                       sitekey,
                       specificOnly);
  }
}

async function performMatchingBenchmark(initialFilters) {
  const {filterEngine} = require("./lib/filterEngine");
  filterEngine.initialize(initialFilters);

  let matchFilterList = [];
  switch (matchListCase) {
    case "slowlist":
      matchFilterList.push("slowlist");
      break;
    case "unitlist":
      matchFilterList.push("unitlist");
      break;
    case "all":
      matchFilterList.push("slowlist");
      matchFilterList.push("unitlist");
      break;
  }

  let performanceHistogram = createHistogram();
  filterEngine.match = performance.timerify(filterEngine.match, {
    histogram: performanceHistogram
  });
  for (let filter of matchFilterList) {
    let filterToMatch = require(`./benchmark/${filter}.json`);
    for (let key in filterToMatch) {
      let rounds = helpers.getFlagValue("rounds");
      if (rounds == null)
        rounds = 3;

      for (let i = 1; i <= rounds; i++) {
        let args = filterToMatch[key]["args"];
        await runMatch(filterEngine, ...args);
        await Promise.resolve().then(printMemory("Matching", i));
      }
    }
  }
  // Counting average and margin for runs
  let matchingHeapUsed =
    await helpers.countStatisticsOfRuns(matchResults, "HeapUsed");
  let matchingHeapTotal =
    await helpers.countStatisticsOfRuns(matchResults, "HeapTotal");

  filterBenchmarkData["TimeMin"] = nanosToMillis(performanceHistogram.min);
  filterBenchmarkData["TimeMean"] = nanosToMillis(performanceHistogram.mean);
  filterBenchmarkData["TimeMax"] = nanosToMillis(performanceHistogram.max);
  filterBenchmarkData["HeapUsed"] = matchingHeapUsed.average;
  filterBenchmarkData["HeapTotal"] = matchingHeapTotal.average;

  console.log(`Matching time (min): ${filterBenchmarkData["TimeMin"]}ms`);
  console.log(`Matching time (mean): ${filterBenchmarkData["TimeMean"]}ms`);
  console.log(`Matching time (max): ${filterBenchmarkData["TimeMax"]}ms`);
  console.log(`Matching heap (used): ${filterBenchmarkData["HeapUsed"]} MiB +/- ${matchingHeapUsed.margin} MiB`);
  console.log(`Matching heap (total): ${filterBenchmarkData["HeapTotal"]} MiB +/- ${matchingHeapTotal.margin} MiB`);
}

async function performInitializationBenchmark(filters) {
  const {filterEngine} = require("./lib/filterEngine");
  let performanceHistogram = createHistogram();
  filterEngine.initialize = performance.timerify(filterEngine.initialize, {
    histogram: performanceHistogram
  });
  await filterEngine.initialize(filters);
  filterBenchmarkData["TimeMean"] = nanosToMillis(performanceHistogram.mean);
  console.log(`Initialization time: ${filterBenchmarkData["TimeMean"]}ms`);
  // Call printMemory() asynchronously so GC can clean up any objects from
  // here.
  await new Promise(resolve => setTimeout(() => {
    printMemory(); resolve();
  }, 1000));
}

async function main() {
  try {
    console.log("Date", benchmarkDate);
    await helpers.populateGitMetadata(dataToSaveForTimestamp);

    let filters = [];
    if (filterListName) {
      let lists = helpers.divideSetToArray(filterListName);
      for (let list of lists) {
        let content = await helpers.loadFile(list);
        filters = filters.concat(content.split(/[\r\n]+/).map(sliceString));
      }
    }

    if (helpers.getFlagValue("cleanup")) {
      await helpers.cleanBenchmarkData();
      return;
    }

    if (saveData) {
      // Saving data that was initialized at the begining
      await mergeAndSaveData(benchmarkResults);
    }

    if (runMatchingBenchmark) {
      if (filterListName)
        console.log(`## Matching ${matchListCase} matches with ${filterListName} filters`);
      else
        console.log(`## Matching ${matchListCase} matches`);

      await performMatchingBenchmark(filters);
      await mergeAndSaveData(benchmarkResults);
    }
    else {
      console.log(`## Initializing with ${filterListName} filters`);
      await performInitializationBenchmark(filters);
      await mergeAndSaveData(benchmarkResults);
    }

    if (helpers.getFlagValue("compare"))
      helpers.compareResults(benchmarkDate);
  }
  finally {
    // deleting temporary file to keep it clean
    if (deleteTempData)
      await helpers.deleteFile(TEMP_BENCHMARK_RESULTS);
  }
}

if (require.main == module)
  main();
