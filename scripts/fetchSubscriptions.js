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

const {filenameMv3} = require("./updateSubscriptions");
const {
  createWriteStream,
  promises: {readFile, unlink, mkdir, access}
} = require("fs");
const http = require("http");
const https = require("https");
const yargs = require("yargs/yargs");
const {hideBin} = require("yargs/helpers");

const OUTPUT_DIR = "build/data/subscriptions/ABP";

async function download(url, toFile) {
  console.info(`Downloading ${url} to ${toFile} ...`);
  const proto = url.startsWith("https") ? https : http;

  return new Promise((resolve, reject) => {
    const file = createWriteStream(toFile);
    let fileInfo = null;

    const request = proto.get(url, response => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
        return;
      }

      fileInfo = {
        mime: response.headers["content-type"],
        size: parseInt(response.headers["content-length"], 10)
      };

      response.pipe(file);
    });

    file.on("finish", () => resolve(fileInfo));

    request.on("error", err => {
      unlink(toFile)
        .then(() => reject(err))
        .catch(() => reject(err));
    });

    file.on("error", err => {
      unlink(toFile)
        .then(() => reject(err))
        .catch(() => reject(err));
    });

    request.end();
  });
}

function getSubscriptionFile(subscription) {
  return subscription.url.replace(/[^a-z0-9]/gi, "_").toLowerCase();
}

async function exists(filename) {
  try {
    await access(filename);
    return true;
  }
  catch (error) {
    return false;
  }
}

async function fetchSubscriptions(fromFile, toDir) {
  if (await exists(toDir))
    console.warn("The output directory exists");
  else
    await mkdir(toDir, {recursive: true});

  if (!(await exists(fromFile))) {
    throw new Error(
      `Subscriptions file (${fromFile}) does not exist. ` +
      "Run `npm run \"update-subscriptions:mv3\"` to generate it.");
  }

  console.info("Downloading started");
  let subscriptions = await JSON.parse(await readFile(fromFile));
  for (let subscription of subscriptions) {
    let toFile = `${toDir}/${getSubscriptionFile(subscription)}`;
    await download(subscription.url, toFile);
  }
  console.info("Downloading finished");
}

async function main() {
  const args = yargs(hideBin(process.argv))
    .option("input", {
      alias: "i",
      type: "string",
      requiresArg: true,
      description: "Input file"
    })
    .option("output", {
      alias: "o",
      type: "string",
      requiresArg: true,
      description: "Output directory"
    })
    .parse();
  let fromFile = args.input || filenameMv3;
  let toDir = args.output || OUTPUT_DIR;
  await fetchSubscriptions(fromFile, toDir);
}

if (require.main == module)
  main();

exports.OUTPUT_DIR = OUTPUT_DIR;
exports.getSubscriptionFile = getSubscriptionFile;
exports.fetchSubscriptions = fetchSubscriptions;
