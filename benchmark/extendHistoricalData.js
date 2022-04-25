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

"use strict";

const path = require("path");
const helpers = require("./helpers.js");

const BENCHMARK_RESULTS = path.join(
  __dirname,
  "/benchmark_results.json"
);
const HISTORICAL_BENCHMARK_RESULTS = path.join(
  __dirname,
  "/historicalData/historical_data.json"
);

async function main() {
  let timestampToExtract = helpers.getFlagValue("ts");
  let currentRunData = await helpers.loadDataFromFile(BENCHMARK_RESULTS);
  let dataToBeMerged = {};
  dataToBeMerged[timestampToExtract] = currentRunData[timestampToExtract];
  let benchmarkDataToSave =
     helpers.mergeToBenchmarkResults(dataToBeMerged,
                                     HISTORICAL_BENCHMARK_RESULTS);
  await helpers.saveToFile(benchmarkDataToSave, HISTORICAL_BENCHMARK_RESULTS);
}

if (require.main == module)
  main();
