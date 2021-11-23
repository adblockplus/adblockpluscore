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

const {filenameMv3} = require("./updateSubscriptions");
const {
  createWriteStream, existsSync,
  promises: {readFile, rmdir, unlink, mkdir}
} = require("fs");
const http = require("http");
const https = require("https");

const outputDir = "build/data/subscriptions/ABP";

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

    // The destination stream is ended by the time it's called
    file.on("finish", () => resolve(fileInfo));

    request.on("error", err => {
      unlink(toFile).then(() => reject(err));
    });

    file.on("error", err => {
      unlink(toFile).then(() => reject(err));
    });

    request.end();
  });
}

function getSubscriptionFile(subscription) {
  return subscription.url.replace(/[^a-z0-9]/gi, "_").toLowerCase();
}

async function fetchSubscriptions(fromFile, toDir) {
  if (existsSync(toDir)) {
    console.warn("Cleaning subscriptions dir ...");
    await rmdir(toDir, {recursive: true});
  }
  await mkdir(toDir, {recursive: true});

  if (!existsSync(fromFile)) {
    throw new Error(
      `Subscriptions file (${fromFile}) does not exist. ` +
      "Run `npm run \"update-subscriptions:mv3\"` to generate it.");
  }

  console.info("Downloading started");
  let subscriptions = await JSON.parse(await readFile(fromFile));
  for (let subscription of subscriptions) {
    let toFile = `${toDir}/${getSubscriptionFile(subscription)}.txt`;
    await download(subscription.url, toFile);
  }
  console.info("Downloading finished");
}

async function main() {
  let fromFile = process.argv[2] || filenameMv3;
  let toDir = process.argv[3] || outputDir;
  await fetchSubscriptions(fromFile, toDir);
}

if (require.main == module)
  main();

exports.outputDir = outputDir;
exports.fetchSubscriptions = fetchSubscriptions;
