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
  createReadStream,
  createWriteStream,
  promises: {readdir, rm, unlink, writeFile, mkdir}
} = require("fs");
const {exists, download} = require("./utils");
const path = require("path");
const readline = require("readline");
const https = require("https");
const tar = require("tar");
const yargs = require("yargs/yargs");
const {hideBin} = require("yargs/helpers");

const listUrl = "https://gitlab.com/eyeo/filterlists/subscriptionlist/" +
                "-/archive/master/subscriptionlist-master.tar.gz";
const backendUrlMv3 = "https://easylist-downloads.adblockplus.org/v3/index.json";
const filenameMv2 = "data/subscriptions.json";
const filenameMv3 = "build/data/subscriptions_mv3.json";

const resultingKeys = new Set([
  "title",
  "url",
  "homepage",
  "languages",
  "type"
]);

function untar(remoteUrl) {
  return new Promise((resolve, reject) => {
    let file = path.join(__dirname, path.basename(remoteUrl));
    let writableStream = createWriteStream(file);

    https.get(remoteUrl, response => {
      if (response.statusCode != 200) {
        reject(new Error(`HTTPS server response code: ${response.statusCode}`));
      }
      else {
        response.pipe(writableStream);
        writableStream.on("close", () => {
          tar.x({file, cwd: __dirname}).then(() => {
            unlink(file).then(() => {
              resolve(file.replace(/\.[^/]+$/, ""));
            });
          });
        });
      }
    });
  });
}

function parseSubscriptionFile(file, validLanguages) {
  // Bypass parsing remaining lines in the ReadStream's buffer
  let continuing = true;
  return new Promise(resolve => {
    let parsed = {
      name: path.basename(file).replace(/\.\w+$/, "")
    };

    let reader = readline.createInterface({
      input: createReadStream(file, {encoding: "utf8"})
    });

    reader.on("line", line => {
      if (!line.match(/\S/g) || !continuing)
        return;

      let index = line.indexOf("=");
      let key;
      let value;
      if (index > 0) {
        key = line.substring(0, index);
        value = line.substring(index + 1);
      }
      else {
        key = line;
      }
      key = key.trim();

      if (key == "unavailable" || key == "deprecated") {
        parsed = null;
        console.warn(`No list locations given in ${file}`);
        reader.close();
        continuing = false;
        return;
      }

      if (value)
        value = value.trim();

      if (value == "")
        console.warn(`Empty value given for attribute ${key} in ${file}`);

      if (key != "name" && key in parsed)
        console.warn(`Value for attribute ${key} is duplicated in ${file}`);

      if (key == "supplements") {
        if (!("supplements" in parsed))
          parsed["supplements"] = [];
        parsed["supplements"].push(value);
      }
      else if (key == "list" || key == "variant") {
        let name = parsed["name"];
        let url = null;
        let keywords = {
          recommendation: false,
          complete: false
        };
        let keywordsRegex = /\s*\[((?:\w+,)*\w+)\]$/;
        let variantRegex = /(.+?)\s+(\S+)$/;

        let keywordsMatch = value.match(keywordsRegex);
        if (keywordsMatch) {
          value = value.replace(keywordsRegex, "");
          url = value;

          for (let keyword of keywordsMatch[1].split(",")) {
            keyword = keyword.toLowerCase();
            if (keyword in keywords)
              keywords[keyword] = true;
          }
        }

        if (key == "variant") {
          let variantMatch = value.match(variantRegex);
          if (variantMatch) {
            name = variantMatch[1];
            url = variantMatch[2];
          }
          else {
            console.warn(`Invalid variant format in ${file}, no name` +
                         " given?");
          }
        }
        if (!("variants" in parsed))
          parsed["variants"] = [];
        parsed["variants"].push([name, url, keywords["complete"]]);

        if (keywords["recommendation"]) {
          parsed["title"] = name;
          parsed["url"] = url;
        }
      }
      else if (key == "languages") {
        parsed["languages"] = value.split(",");
        for (let language of parsed["languages"]) {
          if (!validLanguages.has(language))
            console.warn(`Unknown language code ${language} in ${file}`);
        }
      }
      else {
        parsed[key] = value;
      }
    });
    reader.on("close", () => {
      if (!parsed) {
        resolve(parsed);
        return;
      }
      if (typeof parsed["variants"] !== "undefined") {
        if (parsed["variants"].length == 0)
          console.warn(`No list locations given in ${file}`);

        if ("title" in parsed && parsed["type"] == "ads" &&
          parsed["languages"] == null)
          console.warn(`Recommendation without languages in ${file}`);

        if (!("supplements" in parsed)) {
          for (let variant of parsed["variants"]) {
            if (variant[2]) {
              console.warn("Variant marked as complete for non-supplemental " +
                         `subscription in ${file}`);
            }
          }
        }
      }
      else {
        console.warn(`Invalid format of the file ${file},
        cannot find variants in proper format in the file`);
      }
      resolve(parsed);
    });
  });
}

async function parseValidLanguages(root) {
  let rootPath = path.join(root, "settings");
  if (await exists(rootPath)) {
    return new Promise(resolve => {
      let languageRegex = /(\S{2})=(.*)/;
      let languages = new Set();
      let reader = readline.createInterface({
        input: createReadStream(rootPath, {encoding: "utf8"})
      });

      reader.on("line", line => {
        let match = line.match(languageRegex);
        if (match)
          languages.add(match[1]);
      });

      reader.on("close", () => resolve(languages));
    });
  }
  console.warn("Settings file doesn't exist");
}

function postProcessSubscription(subscription) {
  subscription["homepage"] = subscription["homepage"] ||
                             subscription["forum"] ||
                             subscription["blog"] ||
                             subscription["faq"] ||
                             subscription["contact"];

  for (let key in subscription) {
    if (!resultingKeys.has(key))
      delete subscription[key];
  }
}

async function updateMv3(filename) {
  if (await exists(filename)) {
    console.warn("The output file exists and will be overwritten");
    await unlink(filename);
  }
  let toDir = path.dirname(filename);
  if (!(await exists(toDir)))
    await mkdir(toDir, {recursive: true});
  await download(backendUrlMv3, filename);
}

async function updateMv2(filename) {
  let root = await untar(listUrl);

  let languages = await parseValidLanguages(root);
  let tarFiles = await readdir(root);

  let parsed = await Promise.all(
    tarFiles
      .filter(file => file.match(".subscription"))
      .map(file => parseSubscriptionFile(root + "/" + file, languages))
  );

  parsed = parsed.filter(subscription =>
    subscription != null && "title" in subscription
  );

  for (let subscription of parsed)
    postProcessSubscription(subscription);

  parsed.sort((a, b) =>
    a["type"].toLowerCase().localeCompare(b["type"]) ||
    a["title"].localeCompare(b["title"])
  );

  let toDir = path.dirname(filename);
  if (!(await exists(toDir)))
    await mkdir(toDir, {recursive: true});
  await writeFile(filename, JSON.stringify(parsed, null, 2), "utf8");
  await rm(root, {recursive: true});
}

async function main() {
  const args = yargs(hideBin(process.argv))
    .option("type", {
      alias: "t",
      type: "string",
      requiresArg: true,
      demandOption: true,
      choices: ["mv2", "mv3"],
      description: "Manifest version"
    })
    .option("output", {
      alias: "o",
      type: "string",
      requiresArg: true,
      description: "Output file"
    })
    .parse();

  let filename;
  if (args.type === "mv3") {
    filename = args.output || filenameMv3;
    await updateMv3(filename);
  }
  else {
    filename = filenameMv2;
    await updateMv2(filename);
  }
  console.log(`Subscriptions file (${filename}) generated.`);
}

if (require.main == module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

exports.listUrl = listUrl;
exports.filenameMv2 = filenameMv2;
exports.filenameMv3 = filenameMv3;
exports.backendUrlMv3 = backendUrlMv3;
exports.updateMv2 = updateMv2;
exports.updateMv3 = updateMv3;
