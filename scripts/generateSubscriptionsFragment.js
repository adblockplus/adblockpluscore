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

/* eslint no-console: "off" */

"use strict";

const {
  readdirSync, existsSync,
  promises: {writeFile}
} = require("fs");
const path = require("path");
const {outputDir: convertOutputDir} = require("./convertSubscriptions.js");

const outputFile = "build/data/subscriptions/fragment.json";

function generateFragment(dir, space = 2) {
  if (!existsSync(dir)) {
    throw new Error(`DNR rules directory (${dir}) does not exist. ` +
      "Run `npm run \"convert-subscriptions\"` to generate it.");
  }

  let files = readdirSync(dir);
  let fragment = {rule_resources: []};
  for (let file of files) {
    if (path.extname(file) !== ".json") {
      console.warn(`Not .json file (${file}) skipped`);
      continue;
    }
    fragment.rule_resources.push({
      id: getRuleId(file),
      enabled: false,
      path: getFilePath(file)
    });
  }
  if (fragment.rule_resources.length === 0)
    console.warn("No static rules generated.");
  return JSON.stringify(fragment, null, space);
}

function getRuleId(file) {
  return path.parse(file).name; // without extension
}

function getFilePath(file) {
  return path.parse(file).base;
}

async function main() {
  let toFile = process.argv[2] || outputFile;
  let fragmentJson = generateFragment(convertOutputDir);
  await writeFile(toFile, fragmentJson, "utf8");
  console.log(`Web extension manifest fragment file (${toFile}) generated.`);
}

if (require.main == module)
  main();

exports.outputFile = outputFile;
exports.generateFragment = generateFragment;
