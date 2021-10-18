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

/** @module */

"use strict";

const path = require("path");
const BENCHMARK_RESULTS = path.join(__dirname, "benchmarkresults.json");
const TEMP_BENCHMARK_RESULTS = path.join(__dirname, "tempresults.json");
const fs = require("fs");
const https = require("https");
const {performance} = require("perf_hooks");

const PROFILING_RESULTS_KEYS = [
  "FilterEngine:startup",
  "FilterEngine:initialize_measure",
  "FilterEngine:download_done_measure"
];
const HEAP_RESULTS_KEYS = [
  "HeapUsed",
  "HeapTotal"
];
const RESULTS_KEYS = PROFILING_RESULTS_KEYS.concat(HEAP_RESULTS_KEYS);

let dataToSave = {};

function loadDataFromFile(pathToLoad) {
  let data = {};
  try {
    data = require(pathToLoad);
  }
  catch (e) {
    if (e.code !== "MODULE_NOT_FOUND")
      throw e;
  }
  return data;
}

exports.saveToFile = async function
saveToFile(data, fileCleanup = false, pathToFile) {
  if (fileCleanup)
    await this.deleteFile(BENCHMARK_RESULTS);
  let json = JSON.stringify(data);
  fs.promises.writeFile(pathToFile, json, "utf8");
};

exports.loadFile = async function loadFile(list) {
  try {
    return await fs.promises.readFile(list.path, "utf8");
  }
  catch (error) {
    console.log(`Hey, we're downloading the file once, 
    hold on for a second. Downloading from url: ${list.url}`);
    let data = await download(list.url);
    let listPath = path.join(__dirname, list.path.replace("benchmark", ""));
    await fs.promises.writeFile(listPath, data);
    return data;
  }
};

function download(url) {
  return new Promise((resolve, reject) => {
    let request = https.request(url);

    request.on("error", reject);
    request.on("response", response => {
      let {statusCode} = response;
      if (statusCode != 200) {
        reject(`Download failed for ${url} with status ${statusCode}`);
        return;
      }

      let body = [];
      response.on("data", body.push.bind(body));
      response.on("end", () => {
        resolve(body.join(""));
      });
    });

    request.end();
  });
}

function deepMerge(object1, object2) {
  for (let key of Object.keys(object2)) {
    try {
      if (object2[key] instanceof Object)
        object1[key] = deepMerge(object1[key], object2[key]);
      else
        object1[key] = object2[key];
    }
    catch (e) {
      object1[key] = object2[key];
    }
  }
  return object1;
}

exports.mergeToBenchmarkResults = function mergeToBenchmarkResults(
  dataToMege,
  pathForData) {
  let benchmarkData = {};
  benchmarkData = loadDataFromFile(pathForData);
  return deepMerge(benchmarkData, dataToMege);
};


exports.cleanBenchmarkData = async function cleanBenchmarkData() {
  console.log("Wait a sec, I am cleaning benchmark Data... ");

  let minValues = {};

  for (let key of RESULTS_KEYS) {
    minValues[`${key}Min`] = Number.MAX_SAFE_INTEGER;
    minValues[`${key}Timestamp`] = null;
  }

  let timestampsToSave = [];
  let dataToAnalyze = loadDataFromFile(BENCHMARK_RESULTS);
  let filterList = await getValuesKeys(dataToAnalyze);
  for (let i = 0; i < filterList.length; i++) {
    let filter = filterList[i];
    for (let timestamp in dataToAnalyze) {
      if (typeof (dataToAnalyze[timestamp][filter]) == "undefined")
        continue;
      for (let key in dataToAnalyze[timestamp][filter]) {
        let valueToCompare =
          parseFloat(dataToAnalyze[timestamp][filter][key]);
        if (minValues[`${key}Min`] == null) {
          continue;
        }
        else if (minValues[`${key}Min`] > valueToCompare) {
          minValues[`${key}Timestamp`] = timestamp;
          minValues[`${key}Min`] = valueToCompare;
          continue;
        }
      }
    }
  }
  console.log("Min Values", minValues);
  for (let key of RESULTS_KEYS) {
    if (!timestampsToSave.includes(minValues[`${key}Timestamp`]))
      timestampsToSave.push(minValues[`${key}Timestamp`]);
  }

  for (let timestamp of timestampsToSave)
    dataToSave[timestamp] = dataToAnalyze[timestamp];

  await this.saveToFile(dataToSave, true, BENCHMARK_RESULTS);
  console.log("Data is cleaned.");
};

function printTableSeparator(separator, startSign = "┣", endSign = "┫") {
  console.log(`${startSign}${"━".repeat(35)}${separator}${"━".repeat(14)}${separator}${"━".repeat(14)}${separator}${"━".repeat(21)}${endSign}`);
}

function fillTab(col1, col2, col3, col4) {
  console.log(`┃ ${col1.padEnd(34, " ")}┃ ${col2.padEnd(13, " ")}┃ ${col3.padEnd(13, " ")}┃${col4.padStart(19, " ")}% ┃ `);
}

function getValuesKeys(obj) {
  let valueKeys = [];
  for (let timestamp in obj)
    valueKeys = Object.keys(obj[timestamp]);

  let uniqueWithoutGitKeys = valueKeys.filter(
    word => (word !== "Refs" & word !== "CommitHash"));
  return uniqueWithoutGitKeys;
}

exports.waitForProfilingResults =
async function waitForProfilingResults(filterBenchmarkData,
                                       pollingInterval = 10,
                                       timeout = 1000) {
  let missingProfileResults = () => PROFILING_RESULTS_KEYS
    .filter(key => typeof filterBenchmarkData[key] === "undefined");
  let profileResultsAllExist = () => missingProfileResults().length === 0;

  let startTime = performance.now();
  while (!profileResultsAllExist()) {
    if (performance.now() - startTime > timeout) {
      throw new Error("Timeout waiting for profiler results. " +
                      `Missing measurements: ${missingProfileResults()}`);
    }
    await new Promise(resolve => setTimeout(resolve, pollingInterval));
  }
};

exports.compareResults = async function compareResults(currentRunTimestamp) {
  let currentRunData = loadDataFromFile(TEMP_BENCHMARK_RESULTS);
  let dataToAnalyze = loadDataFromFile(BENCHMARK_RESULTS);
  let filterList = await getValuesKeys(dataToAnalyze);
  console.log(`┏${"━".repeat(87)}┓`);

  for (let j = 0; j < RESULTS_KEYS.length; j++) {
    let key = RESULTS_KEYS[j];

    console.log(`┃${" ".repeat(33)}${key.padEnd(54, " ")}┃`);
    printTableSeparator("┳");
    fillTab(" ", "Current", "Min", "Diff");
    printTableSeparator("╋");

    for (let i = 0; i < filterList.length; i++) {
      let filter = filterList[i];
      if (!key.includes("Heap")) {
        if (filter.includes("Matching"))
          continue;
      }
      let valueMin = Number.MAX_SAFE_INTEGER;
      for (let timestamp of Object.keys(dataToAnalyze)) {
        if (timestamp == currentRunTimestamp)
          continue;
        if (typeof (dataToAnalyze[timestamp][filter]) == "undefined")
          continue;
        if (typeof (dataToAnalyze[timestamp][filter][key]) == "undefined")
          continue;

        let valueToCompare =
        parseFloat(dataToAnalyze[timestamp][filter][key]);
        if (valueMin > valueToCompare)
          valueMin = valueToCompare;
      }
      if (valueMin == Number.MAX_SAFE_INTEGER) {
        console.log(` Missing historical data to compare,
          please run 'npm benchmark-save' to create one`);
        this.deleteFile(TEMP_BENCHMARK_RESULTS)
            .finally(() => process.exit(1));
        process.exit(1);
      }
      // eslint-disable-next-line max-len
      if ((typeof (currentRunData[currentRunTimestamp][filter]) == "undefined") ||
        // eslint-disable-next-line max-len
        typeof (currentRunData[currentRunTimestamp][filter][key]) == "undefined")
        continue;

      let currentRunValue =
        parseFloat(currentRunData[currentRunTimestamp][filter][key]);
      let diff = ((currentRunValue - valueMin) / valueMin) * 100;

      fillTab(
        filter,
        currentRunValue.toFixed(3),
        valueMin.toFixed(3),
        diff.toFixed(3)
      );

      if (j == (RESULTS_KEYS.length - 1) && i == (filterList.length - 1)) {
        printTableSeparator("┻", "┗", "┛");
        continue;
      }
      printTableSeparator("╋");
    }
  }
};

exports.deleteFile = async function deleteFile(pathToDelete) {
  try {
    return await fs.promises.unlink(pathToDelete);
  }
  catch (error) {
  }
};

async function extractHeapDataFromMatchingResults(matchResults, parameter) {
  let resultsArray = [];
  for (let result in matchResults) {
    if (result.includes(parameter))
      resultsArray.push(matchResults[result]);
  }
  return resultsArray;
}

function getMargin(array, mean) {
  let marginToMaxValue = (Math.max(...array)) - mean;
  let marginToMinValue = mean - (Math.min(...array));
  let margin = Math.max(marginToMaxValue, marginToMinValue);

  return margin;
}

exports.countStatisticsOfRuns =
  async function countStatisticsOfRuns(matchResults, parameter) {
    let heap =
    await extractHeapDataFromMatchingResults(matchResults, parameter);
    let sum = 0;
    for (let i = 0; i < heap.length; i++)
      sum += parseFloat(heap[i], 10);

    let average = parseInt(sum / heap.length, 10).toFixed(3);
    let margin = parseFloat(getMargin(heap, average)).toFixed(3);
    return {
      average,
      margin
    };
  };
