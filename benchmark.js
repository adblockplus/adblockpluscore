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

const fs = require("fs");
const path = require("path");
const helpers = require("./benchmark/helpers.js");

let saveData = false;
let filterListName = helpers.getFlagValue("filter-list");
let matchListCase = helpers.getFlagValue("match-list");
let benchmarkDate = setTimestamp();

// Holds benchmark results that will be merged into json file
let benchmarkResults = {};
let matchResults = {};
benchmarkResults[benchmarkDate] = {};
let dataToSaveForTimestamp = benchmarkResults[benchmarkDate];

// Get git data about branch and commit
const rev = fs.readFileSync(".git/HEAD").toString().replace(/\n/g, "");
let refs = rev;
let commitHash = rev;
if (rev.includes(":"))
  commitHash = fs.readFileSync(".git/" + rev.substring(5).replace(/\n/g, "")).toString().replace(/\n/g, "");
dataToSaveForTimestamp["Refs"] = refs;
dataToSaveForTimestamp["CommitHash"] = commitHash;

let benchmarkDataEntryName = `FilterList_${filterListName}`;
if (filterListName == null) {
  filterListName = matchListCase;
  benchmarkDataEntryName = `Matching_${filterListName}`;
}
dataToSaveForTimestamp[benchmarkDataEntryName] = {};
let filterBenchmarkData =
  benchmarkResults[benchmarkDate][benchmarkDataEntryName];

// Gathers data from profiler & passes it to benchmark
let profilerReporter = function(list) {
  for (let entry of list.getEntriesByType("measure")) {
    console.log(`${entry.name}: ${entry.duration}ms`);
    this[entry.name] = entry.duration;
  }
}.bind(filterBenchmarkData);

const profiler = require("./lib/profiler");
profiler.enable(true, profilerReporter);

const {filterEngine} = require("./lib/filterEngine");
const {Filter} = require("./lib/filterClasses");
const {parseURL} = require("./lib/url");
const {contentTypes} = require("./lib/contentTypes");

const BENCHMARK_RESULTS = path.join(
  __dirname,
  "/benchmark/benchmarkresults.json"
);
const TEMP_BENCHMARK_RESULTS = path.join(
  __dirname,
  "/benchmark/tempresults.json"
);

let benchmarkDataToSave;

function sliceString(str) {
  // Create a new string in V8 to free up the parent string.
  return JSON.parse(JSON.stringify(str));
}

function toMiB(numBytes) {
  return new Intl.NumberFormat().format(numBytes / 1024 / 1024);
}

function setTimestamp() {
  let date = helpers.getFlagValue("ts");
  if (date == null) {
    let currentdate = new Date();
    date = currentdate.toISOString();
  }
  console.log("Date", date);
  return date;
}

function mergeAndSaveData(dataToMerge) {
  if (saveData) {
    benchmarkDataToSave =
    helpers.mergeToBenchmarkResults(dataToMerge, BENCHMARK_RESULTS);
    helpers.saveToFile(benchmarkDataToSave, false, BENCHMARK_RESULTS);
  }
  // saving data to temporary file only
  let tempBenchmarkDataToSave =
    helpers.mergeToBenchmarkResults(dataToMerge, TEMP_BENCHMARK_RESULTS);
  helpers.saveToFile(tempBenchmarkDataToSave, false, TEMP_BENCHMARK_RESULTS);
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

  mergeAndSaveData(benchmarkResults);
  // deleting temporary file to keep it clean
  if (process.argv.some(arg => /^--dt$/.test(arg)))
    helpers.deleteFile(TEMP_BENCHMARK_RESULTS);
}

function runMatch(
  filters, location, contentType, docDomain, sitekey, specificOnly) {
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

async function performMatchingBenchmark() {
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
  dataToSaveForTimestamp[`Matching_${matchListCase}`] = {};
  console.log(`Matching Filter List: ${matchListCase}`);
  for (let filter of matchFilterList) {
    let filterToMatch = require(`./benchmark/${filter}.json`);
    for (let key in filterToMatch) {
      let rounds = helpers.getFlagValue("rounds");
      if (rounds == null)
        rounds = 3;

      for (let i = 1; i <= rounds; i++) {
        let args = filterToMatch[key]["args"];
        await runMatch(...args);
        await Promise.resolve().then(printMemory("Matching", i));
      }
    }
  }
  // Counting average and margin for runs
  let matchingHeapUsed =
    await helpers.countStatisticsOfRuns(matchResults, "HeapUsed");
  let matchingHeapTotal =
    await helpers.countStatisticsOfRuns(matchResults, "HeapTotal");
  dataToSaveForTimestamp[`Matching_${matchListCase}`]["HeapTotal"] = `${matchingHeapTotal["average"]} MiB +/- ${matchingHeapTotal["margin"]} MiB`;
  dataToSaveForTimestamp[`Matching_${matchListCase}`]["HeapUsed"] = `${matchingHeapUsed["average"]} MiB +/-${matchingHeapUsed["margin"]} MiB`;
  console.log(`Matching heap (used): ${dataToSaveForTimestamp[`Matching_${matchListCase}`]["HeapUsed"]}`);
  console.log(`Matching heap (total): ${dataToSaveForTimestamp[`Matching_${matchListCase}`]["HeapTotal"]}`);
}

async function performInitializationBenchmark(filters) {
  await filterEngine.initialize(filters);
  // From Node16 onwards, the profiler doesn't provide a synchronous
  // interface to profiling data. We register a callback in the
  // benchmark initialization to provide the profiling measurements
  // as they're available, and here we wait for them to actually be
  // available before continuing.
  await helpers.waitForProfilingResults(filterBenchmarkData);
  // Call printMemory() asynchronously so GC can clean up any objects from
  // here.
  await new Promise(resolve => setTimeout(() => {
    printMemory(); resolve();
  }, 1000));
}

async function main() {
  // Extract filter set to  array of filter lists
  console.log("## " + filterListName);
  let lists = helpers.divideSetToArray(filterListName);

  let filters = [];

  if (lists.length > 0) {
    for (let list of lists) {
      let content = await helpers.loadFile(list);
      filters = filters.concat(content.split(/[\r\n]+/).map(sliceString));
    }
  }
  if (process.argv.some(arg => /^--cleanup$/.test(arg))) {
    await helpers.cleanBenchmarkData();
    return;
  }

  if (process.argv.some(arg => /^--save$/.test(arg))) {
    saveData = true;
    // Saving data that was initialized at the begining
    mergeAndSaveData(benchmarkResults);
  }

  if (process.argv.some(arg => /^--match$/.test(arg))) {
    await performMatchingBenchmark();
    mergeAndSaveData(benchmarkResults);
  }
  else if (lists.length > 0) {
    await performInitializationBenchmark(filters);
    mergeAndSaveData(benchmarkResults);
  }

  if (process.argv.some(arg => /^--compare$/.test(arg)))
    helpers.compareResults(benchmarkDate);
}

if (require.main == module)
  main();
