#!/usr/bin/env node
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

"use strict";

const {
  existsSync,
  promises: {writeFile, readFile}
} = require("fs");

const yargs = require("yargs/yargs");
const {hideBin} = require("yargs/helpers");

const filename = "data/subscriptions.json";
const {filenameMv2} = require("./updateSubscriptions");

async function merge(fromFiles, toFile, space = 2) {
  let result = [];
  for (let fromFile of fromFiles) {
    if (!existsSync(fromFile)) {
      throw new Error(
        `Subscriptions file (${fromFile}) does not exist.`);
    }
    let fromFileContent = JSON.parse(await readFile(fromFile));
    result = result.concat(fromFileContent);
  }
  await writeFile(toFile, JSON.stringify(result, null, space));
}

async function main() {
  const args = yargs(hideBin(process.argv))
    .option("add_default", {
      alias: "a",
      type: "boolean",
      description: "Add default subscriptions file " +
        "('data/subscriptions.json') to input files list"
    })
    .option("input", {
      alias: "i",
      type: "string",
      array: true,
      requiresArg: true,
      description: "Input file(s)"
    })
    .option("output", {
      alias: "o",
      type: "string",
      requiresArg: true,
      description: "Output file"
    })
    .option("space", {
      alias: "s",
      type: "number",
      requiresArg: true,
      description: "JSON space (indentation)"
    })
    .parse();

  if (args.add_default) {
    if (args.input) {
      args.input.push(filenameMv2);
    }
    else {
      console.error(
        "Use '-a' argument with a combination of '-i' argument only.");
    }
  }
  let inFiles = args.input ? args.input : [filenameMv2];
  let outFile = args.output || filename;
  await merge(inFiles, outFile, args.space);
}

if (require.main == module)
  main();

exports.filenameMv2 = filenameMv2;
exports.merge = merge;
