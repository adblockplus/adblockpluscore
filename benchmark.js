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

const {promisify} = require("util");

const request = require("request");

const {filterEngine} = require("./lib/filterEngine");

const EASY_LIST = "https://easylist-downloads.adblockplus.org/easylist.txt";
const AA = "https://easylist-downloads.adblockplus.org/exceptionrules.txt";

function toMiB(numBytes)
{
  return new Intl.NumberFormat().format(numBytes / 1024 / 1024);
}

function printMemory()
{
  gc();

  let {heapUsed, heapTotal} = process.memoryUsage();

  console.log(`Heap (used): ${toMiB(heapUsed)} MiB`);
  console.log(`Heap (total): ${toMiB(heapTotal)} MiB`);
}

async function main()
{
  let lists = [];

  switch (process.argv[2])
  {
    case "EasyList":
      lists.push(EASY_LIST);
      break;
    case "EasyList+AA":
      lists.push(EASY_LIST);
      lists.push(AA);
      break;
  }

  let filters = [];

  if (lists.length > 0)
  {
    for (let list of lists)
    {
      console.debug(`Downloading ${list} ...`);

      let {statusCode, body} = await promisify(request)(list);
      if (statusCode != 200)
        throw new Error(`Download failed for ${list}`);

      filters = filters.concat(body.split(/\r?\n/));
    }

    console.debug();
  }

  if (filters.length > 0)
  {
    console.log("# " + process.argv[2]);
    console.log();

    console.time("Initialization");
    await filterEngine.initialize(filters);
    console.timeEnd("Initialization");
    console.log();

    filters = null;

    printMemory();

    console.log();
  }
}

if (require.main == module)
  main();
