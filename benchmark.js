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
const profiler = require("./lib/profiler");
profiler.enable(true, profilerReporter);

const {filterEngine} = require("./lib/filterEngine");

const EASY_LIST = {
  path: "benchmark/easylist.txt",
  url: "https://easylist-downloads.adblockplus.org/easylist.txt"
};
const AA = {
  path: "benchmark/exceptionrules.txt",
  url: "https://easylist-downloads.adblockplus.org/exceptionrules.txt"
};
const EASYPRIVACY = {
  path: "benchmark/easyprivacy.txt",
  url: "https://easylist.to/easylist/easyprivacy.txt"
};
const TESTPAGES = {
  path: "benchmark/testpages.txt",
  url: "https://testpages.adblockplus.org/en/abp-testcase-subscription.txt"
};

const BENCHMARK_RESULTS = path.join(
  __dirname,
  "/benchmark/benchmarkresults.json"
);
const TEMP_BENCHMARK_RESULTS = path.join(
  __dirname,
  "/benchmark/tempresults.json"
);

let filterListName = process.argv[2];
let benchmarkDate = process.argv[3];

// Holds benchmark results that will be merged into json file
let benchmarkResults = {};
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
dataToSaveForTimestamp[filterListName] = {};

let filterBenchmarkData = dataToSaveForTimestamp[filterListName];
let benchmarkDataToSave;

function sliceString(str)
{
  // Create a new string in V8 to free up the parent string.
  return JSON.parse(JSON.stringify(str));
}

function toMiB(numBytes)
{
  return new Intl.NumberFormat().format(numBytes / 1024 / 1024);
}

function mergeAndSaveData(dataToMerge)
{
  if (saveData)
  {
    benchmarkDataToSave =
    helpers.mergeToBenchmarkResults(dataToMerge, BENCHMARK_RESULTS);
    helpers.saveToFile(benchmarkDataToSave, false, BENCHMARK_RESULTS);
  }
  // saving data to temporary file only
  let tempBenchmarkDataToSave =
    helpers.mergeToBenchmarkResults(dataToMerge, TEMP_BENCHMARK_RESULTS);
  helpers.saveToFile(tempBenchmarkDataToSave, false, TEMP_BENCHMARK_RESULTS);
}

function printMemory()
{
  gc();
  let {heapUsed, heapTotal} = process.memoryUsage();
  console.log(`Heap (used): ${toMiB(heapUsed)} MiB`);
  console.log(`Heap (total): ${toMiB(heapTotal)} MiB`);

  console.log();

  filterBenchmarkData["HeapUsed"] = toMiB(heapUsed);
  filterBenchmarkData["HeapTotal"] = toMiB(heapTotal);
  mergeAndSaveData(benchmarkResults);
  if (process.argv.some(arg => /^--compare$/.test(arg)))
    helpers.compareResults(benchmarkDate);
  // deleting temporary file to keep it clean
  if (process.argv.some(arg => /^--dt$/.test(arg)))
    helpers.deleteFile(TEMP_BENCHMARK_RESULTS);
  console.log();
}

function profilerReporter(list)
{
  for (let entry of list.getEntriesByType("measure"))
  {
    console.log(`${entry.name}: ${entry.duration}ms`);
    filterBenchmarkData[entry.name] = entry.duration;
    mergeAndSaveData(benchmarkResults);
  }
}


async function main()
{
  if (process.argv.some(arg => /^--cleanup$/.test(arg)))
    await helpers.cleanBenchmarkData();
  if (process.argv.some(arg => /^--save$/.test(arg)))
  {
    saveData = true;
    // Saving data that was initialized at the begining
    mergeAndSaveData(benchmarkResults);
  }

  let lists = [];
  console.log("## " + filterListName);
  switch (filterListName)
  {
    case "EasyList":
      lists.push(EASY_LIST);
      break;
    case "EasyList+AA":
      lists.push(EASY_LIST);
      lists.push(AA);
      break;
    case "All":
      lists.push(EASY_LIST);
      lists.push(AA);
      lists.push(EASYPRIVACY);
      lists.push(TESTPAGES);
      break;
  }

  let filters = [];

  if (lists.length > 0)
  {
    for (let list of lists)
    {
      let content = await helpers.loadFile(list);
      filters = filters.concat(content.split(/\r?\n/).map(sliceString));
    }
  }

  if (filters.length > 0)
  {
    await filterEngine.initialize(filters);
    // Call printMemory() asynchronously so GC can clean up any objects from
    // here.
    setTimeout(printMemory, 1000);
  }
}

if (require.main == module)
  main();

