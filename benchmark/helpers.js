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
const {promisify} = require("util");
const exec = promisify(require("child_process").exec);

const EASY_LIST = {
  path: "./benchmark/easylist.txt",
  url: "https://easylist-downloads.adblockplus.org/easylist.txt"
};
const AA = {
  path: "./benchmark/exceptionrules.txt",
  url: "https://easylist-downloads.adblockplus.org/exceptionrules.txt"
};
const EASYPRIVACY = {
  path: "./benchmark/easyprivacy.txt",
  url: "https://easylist.to/easylist/easyprivacy.txt"
};
const TESTPAGES = {
  path: "./benchmark/testpages.txt",
  url: "https://testpages.adblockplus.org/en/abp-testcase-subscription.txt"
};

const TIMERIFY_KEYS = [
  "TimeMin",
  "TimeMean",
  "TimeMax"
];
const HEAP_RESULTS_KEYS = [
  "HeapUsed",
  "HeapTotal"
];
const RESULTS_KEYS = TIMERIFY_KEYS
      .concat(HEAP_RESULTS_KEYS);

function keyUnit(key) {
  if (TIMERIFY_KEYS.includes(key))
    return "ms";
  else if (HEAP_RESULTS_KEYS.includes(key))
    return "MB";
  return "";
}

let dataToSave = {};

exports.loadDataFromFile = function loadDataFromFile(pathToLoad) {
  let data = {};
  try {
    data = require(pathToLoad);
  }
  catch (e) {
    if (e.code !== "MODULE_NOT_FOUND")
      throw e;
  }
  return data;
};

exports.getFlagExists = function getFlagExists(flag) {
  return process.argv.includes(`--${flag}`);
};

exports.getFlagValue = function getFlagValue(flag) {
  let value;
  process.argv
        .slice(2, process.argv.length)
        .forEach(arg => {
          if (arg.slice(0, 2) === "--") {
            const longArg = arg.split("=");
            if (longArg[0].slice(2, longArg[0].length) == flag)
              value = longArg.length > 1 ? longArg[1] : true;
          }
        });

  return value;
};

exports.saveToFile = async function
saveToFile(data, pathToFile) {
  let json = JSON.stringify(data, null, 2);
  await fs.promises.writeFile(pathToFile, json, "utf8");
};

exports.loadFile = async function loadFile(list) {
  try {
    return await fs.promises.readFile(list.path, "utf8");
  }
  catch (error) {
    console.log(`Hey, looks like you don't have filter list ${list.path} cached.
    Please run benchmark-entrypoint.sh --filter-list=<filterList> to download it`);
  }
};

exports.checkIfFileExists = function checkIfFileExists(pathToFile) {
  try {
    if (fs.existsSync(pathToFile))
      return true;
  }
  catch (err) {
    return false;
  }
};

exports.downloadFile = async function downloadFile(url) {
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
};

exports.divideSetToArray = function divideSetToArray(setName) {
  switch (setName) {
    case "EasyList":
      return [EASY_LIST];
    case "EasyList+AA":
      return [EASY_LIST, AA];
    case "All":
      return [EASY_LIST, AA, EASYPRIVACY, TESTPAGES];
    default:
      throw new Error(`Sorry, cannot find set ${setName}.`);
  }
};

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
  benchmarkData = this.loadDataFromFile(pathForData);
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
  let dataToAnalyze = this.loadDataFromFile(BENCHMARK_RESULTS);
  let filterList = await getValuesKeys(dataToAnalyze);
  for (let i = 0; i < filterList.length; i++) {
    let filter = filterList[i];
    for (let timestamp in dataToAnalyze) {
      if (typeof (dataToAnalyze[timestamp][filter]) != "number")
        continue;
      for (let key in dataToAnalyze[timestamp][filter]) {
        let valueToCompare =
          dataToAnalyze[timestamp][filter][key];
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

  await this.saveToFile(dataToSave, BENCHMARK_RESULTS);
  console.log("Data is cleaned.");
};

exports.printTableSeparator =
function printTableSeparator(separator, startSign = "┣", endSign = "┫") {
  console.log(`${startSign}${"━".repeat(35)}${separator}${"━".repeat(14)}${separator}${"━".repeat(14)}${separator}${"━".repeat(21)}${endSign}`);
};

exports.fillTab = function fillTab(col1, col2, col3, col4) {
  console.log(`┃ ${col1.padEnd(34, " ")}┃ ${col2.padEnd(13, " ")}┃ ${col3.padEnd(13, " ")}┃${col4.padStart(19, " ")}% ┃ `);
};

function getValuesKeys(obj) {
  let valueKeys = [];
  for (let timestamp in obj)
    valueKeys = Object.keys(obj[timestamp]);

  let uniqueWithoutGitKeys = valueKeys.filter(
    word => (word !== "Refs" && word !== "CommitHash"));
  return uniqueWithoutGitKeys;
}

exports.compareResults = function compareResults(currentRunTimestamp) {
  let currentRunData = this.loadDataFromFile(TEMP_BENCHMARK_RESULTS);
  let dataToAnalyze = this.loadDataFromFile(BENCHMARK_RESULTS);
  let filterList = getValuesKeys(dataToAnalyze);

  console.log(`┏${"━".repeat(87)}┓`);

  for (let j = 0; j < RESULTS_KEYS.length; j++) {
    let key = RESULTS_KEYS[j];
    let unit = keyUnit(key);
    let heading = `${key} (${unit})`;

    console.log(`┃${" ".repeat(33)}${heading.padEnd(54, " ")}┃`);
    this.printTableSeparator("┳");
    this.fillTab(" ", "Current", "Min", "Diff");
    this.printTableSeparator("╋");

    for (let i = 0; i < filterList.length; i++) {
      let filter = filterList[i];
      let currentRunValue = currentRunData[currentRunTimestamp][filter][key];
      if (!currentRunValue)
        continue;

      let valueMin = Number.MAX_SAFE_INTEGER;
      for (let timestamp of Object.keys(dataToAnalyze)) {
        if (timestamp == currentRunTimestamp)
          continue;
        if (typeof (dataToAnalyze[timestamp][filter]) == "undefined")
          continue;
        if (typeof (dataToAnalyze[timestamp][filter][key]) != "number")
          continue;

        let valueToCompare =
        dataToAnalyze[timestamp][filter][key];
        if (valueMin > valueToCompare)
          valueMin = valueToCompare;
      }
      if (valueMin == Number.MAX_SAFE_INTEGER) {
        console.log(`Missing historical data to compare for ${filter}: ${key}`);
        console.log("Please run 'npm run benchmark:save' to create one.");
        throw new Error("Missing historical data to compare. " +
                        "Please run 'npm run benchmark:save'");
      }
      // eslint-disable-next-line max-len
      if ((typeof (currentRunData[currentRunTimestamp][filter]) == "undefined") ||
        // eslint-disable-next-line max-len
        typeof (currentRunData[currentRunTimestamp][filter][key]) == "undefined")
        continue;

      let diff = ((currentRunValue - valueMin) / valueMin) * 100;

      this.fillTab(
        filter,
        currentRunValue.toFixed(3),
        valueMin.toFixed(3),
        diff.toFixed(3)
      );

      if (j == (RESULTS_KEYS.length - 1) && i == (filterList.length - 1)) {
        this.printTableSeparator("┻", "┗", "┛");
        continue;
      }
      this.printTableSeparator("╋");
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
      sum += heap[i];

    let average = sum / heap.length;
    let margin = getMargin(heap, average);
    return {
      average,
      margin
    };
  };

exports.populateGitMetadata =
async function populateGitMetadata(dataToSaveForTimestamp) {
  // see https://git-scm.com/docs/git-rev-parse
  dataToSaveForTimestamp["Refs"] =
    (await exec("git rev-parse --symbolic-full-name HEAD")).stdout.trim();
  dataToSaveForTimestamp["CommitHash"] =
    (await exec("git rev-parse HEAD")).stdout.trim();
};
