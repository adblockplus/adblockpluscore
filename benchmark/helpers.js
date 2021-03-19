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
let dataToSave = {};

function loadBenchmarkData(pathToLoad)
{
  let benchmarkData = {};
  try
  {
    benchmarkData = require(pathToLoad);
  }
  catch (e)
  {
    if (e.code !== "MODULE_NOT_FOUND")
      throw e;
  }
  return benchmarkData;
}

exports.saveToFile = async function
saveToFile(data, fileCleanup = false, pathToFile)
{
  if (fileCleanup)
    await this.deleteFile(BENCHMARK_RESULTS);
  let json = JSON.stringify(data);
  fs.promises.writeFile(pathToFile, json, "utf8");
};

exports.loadFile = async function loadFile(list)
{
  try
  {
    return await fs.promises.readFile(list.path, "utf8");
  }
  catch (error)
  {
    console.log(`Hey, we're downloading the file once, 
    hold on for a second. Downloading from url: ${list.url}`);
    let data = await download(list.url);
    let listPath = path.join(__dirname, list.path.replace("benchmark", ""));
    await fs.promises.writeFile(listPath, data);
    return data;
  }
};

function download(url)
{
  return new Promise((resolve, reject) =>
  {
    let request = https.request(url);

    request.on("error", reject);
    request.on("response", response =>
    {
      let {statusCode} = response;
      if (statusCode != 200)
      {
        reject(`Download failed for ${url} with status ${statusCode}`);
        return;
      }

      let body = [];
      response.on("data", body.push.bind(body));
      response.on("end", () => { resolve(body.join("")); });
    });

    request.end();
  });
}

function deepMerge(object1, object2)
{
  for (let key of Object.keys(object2))
  {
    try
    {
      if (object2[key] instanceof Object)
        object1[key] = deepMerge(object1[key], object2[key]);
      else
        object1[key] = object2[key];
    }
    catch (e)
    {
      object1[key] = object2[key];
    }
  }
  return object1;
}

exports.mergeToBenchmarkResults = function mergeToBenchmarkResults(
  dataToMege,
  pathForData)
{
  let benchmarkData = {};
  benchmarkData = loadBenchmarkData(pathForData);
  return deepMerge(benchmarkData, dataToMege);
};


exports.cleanBenchmarkData = async function cleanBenchmarkData()
{
  console.log("Wait a sec, I am cleaning benchmark Data... ");

  let heapTotalMin = Number.MAX_SAFE_INTEGER;
  let heapTotalMinTimestamp;
  let heapUsedMin = Number.MAX_SAFE_INTEGER;
  let heapUsedMinTimestamp;
  let filterEngStartupMin = Number.MAX_SAFE_INTEGER;
  let filterEngStartupTime;
  let filterEngDownloadMin = Number.MAX_SAFE_INTEGER;
  let filterEngDownloadTime;
  let filterEngInitMin = Number.MAX_SAFE_INTEGER;
  let filterEngInitTime;
  let timestampsToSave = [];
  let filterList = ["EasyList+AA", "EasyList", "All"];
  let dataToAnalyze = loadBenchmarkData(BENCHMARK_RESULTS);

  for (let i = 0; i < filterList.length; i++)
  {
    let filter = filterList[i];
    for (let timestamp in dataToAnalyze)
    {
      if (typeof (dataToAnalyze[timestamp][filter]) == "undefined")
        continue;
      for (let key in dataToAnalyze[timestamp][filter])
      {
        let valueToCompare =
          parseFloat(dataToAnalyze[timestamp][filter][key]);
        switch (key)
        {
          case "HeapUsed":
            if (heapUsedMin > valueToCompare)
            {
              heapUsedMinTimestamp = timestamp;
              heapUsedMin = valueToCompare;
            }
            break;
          case "HeapTotal":
            if (heapTotalMin > valueToCompare)
            {
              heapTotalMinTimestamp = timestamp;
              heapTotalMin = valueToCompare;
            }
            break;
          case "FilterEngine:download_done_measure":
            if (filterEngDownloadMin > valueToCompare)
            {
              filterEngDownloadTime = timestamp;
              filterEngDownloadMin = valueToCompare;
            }
            break;
          case "FilterEngine:initialize_measure":
            if (filterEngInitMin > valueToCompare)
            {
              filterEngInitTime = timestamp;
              filterEngInitMin = valueToCompare;
            }
            break;
          case "FilterEngine:startup":
            if (filterEngStartupMin > valueToCompare)
            {
              filterEngStartupTime = timestamp;
              filterEngStartupMin = valueToCompare;
            }
            break;
        }
      }
    }
    if (!timestampsToSave.includes(heapTotalMinTimestamp))
      timestampsToSave.push(heapTotalMinTimestamp);
    if (!timestampsToSave.includes(heapUsedMinTimestamp))
      timestampsToSave.push(heapUsedMinTimestamp);
    if (!timestampsToSave.includes(filterEngDownloadTime))
      timestampsToSave.push(filterEngDownloadTime);
    if (!timestampsToSave.includes(filterEngInitTime))
      timestampsToSave.push(filterEngInitTime);
    if (!timestampsToSave.includes(filterEngStartupTime))
      timestampsToSave.push(filterEngStartupTime);
  }

  for (let timestamp of timestampsToSave)
    dataToSave[timestamp] = dataToAnalyze[timestamp];

  await this.saveToFile(dataToSave, true, BENCHMARK_RESULTS);
};

function printTableSeparator(separator, startSign = "┣", endSign = "┫")
{
  console.log(`${startSign}${"━".repeat(35)}${separator}${"━".repeat(14)}${separator}${"━".repeat(14)}${separator}${"━".repeat(21)}${endSign}`);
}

function fillTab(col1, col2, col3, col4)
{
  console.log(`┃ ${col1.padEnd(34, " ")}┃ ${col2.padEnd(13, " ")}┃ ${col3.padEnd(13, " ")}┃${col4.padStart(19, " ")}% ┃ `);
}

exports.compareResults = function compareResults(currentRunTimestamp)
{
  let keys = [
    "HeapUsed",
    "HeapTotal",
    "FilterEngine:download_done_measure",
    "FilterEngine:initialize_measure",
    "FilterEngine:download_done_measure"
  ];
  let filterList = ["EasyList+AA", "EasyList", "All"];

  console.log(`┏${"━".repeat(87)}┓`);

  for (let j = 0; j < keys.length; j++)
  {
    let key = keys[j];

    console.log(`┃${" ".repeat(33)}${key.padEnd(54, " ")}┃`);
    printTableSeparator("┳");
    fillTab(" ", "Current", "Min", "Diff");
    printTableSeparator("╋");

    for (let i = 0; i < filterList.length; i++)
    {
      let filter = filterList[i];
      let valueMin = Number.MAX_SAFE_INTEGER;
      let dataToAnalyze = loadBenchmarkData(BENCHMARK_RESULTS);
      let currentRunData = loadBenchmarkData(TEMP_BENCHMARK_RESULTS);
      for (let timestamp of Object.keys(dataToAnalyze))
      {
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
      if (valueMin == Number.MAX_SAFE_INTEGER)
      {
        console.log(` Missing historical data to compare,
          please run 'npm benchmark-save' to create one`);
        this.deleteFile(TEMP_BENCHMARK_RESULTS)
            .finally(() => process.exit(1));
        process.exit(1);
      }
      let currentRunValue =
        parseFloat(currentRunData[currentRunTimestamp][filter][key]);
      let diff = ((currentRunValue - valueMin) / valueMin) * 100;

      fillTab(
        filter,
        currentRunValue.toFixed(3),
        valueMin.toFixed(3),
        diff.toFixed(3)
      );

      if (j == (keys.length - 1) && i == (filterList.length - 1))
      {
        printTableSeparator("┻", "┗", "┛");
        continue;
      }
      printTableSeparator("╋");
    }
  }
};

exports.deleteFile = async function deleteFile(pathToDelete)
{
  try
  {
    return await fs.promises.unlink(pathToDelete);
  }
  catch (error)
  {
    console.log("Looks like there is no file to delete, skipping");
  }
};
