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

const fs = require("fs");
const path = require("path");
const url = require("url");

const nodeunit = require("nodeunit");

const chromiumProcess = require("./chromium_process");

let unitFiles = [];
let browserFiles = [];

function addTestPaths(testPaths, recurse)
{
  for (let testPath of testPaths)
  {
    let stat = fs.statSync(testPath);
    if (stat.isDirectory())
    {
      if (recurse)
      {
        addTestPaths(fs.readdirSync(testPath).map(
          file => path.join(testPath, file)));
      }
      continue;
    }
    if (path.basename(testPath).startsWith("_"))
      continue;
    if (path.extname(testPath) == ".js")
    {
      if (testPath.split(path.sep).includes("browser"))
        browserFiles.push(testPath);
      else
        unitFiles.push(testPath);
    }
  }
}

function getFileURL(filePath)
{
  return url.format({
    protocol: "file",
    slashes: "true",
    pathname: path.resolve(process.cwd(), filePath).split(path.sep).join("/")
  });
}

function runBrowserTests()
{
  if (!browserFiles.length)
    return;

  // Navigate to this directory because about:blank won't be allowed to load
  // file:/// URLs.
  let initialPage = getFileURL(__dirname);
  let bootstrapPath = path.join(__dirname, "test", "browser",
                                "_bootstrap.js");
  let nodeunitPath = path.join(
    path.dirname(require.resolve("nodeunit")),
    "examples", "browser", "nodeunit.js"
  );
  let args = [
    getFileURL(nodeunitPath),
    ...browserFiles.map(getFileURL)
  ];
  return chromiumProcess(initialPage, bootstrapPath, args);
}

if (process.argv.length > 2)
  addTestPaths(process.argv.slice(2), true);
else
{
  addTestPaths(
    [path.join(__dirname, "test"), path.join(__dirname, "test", "browser")],
    true
  );
}

Promise.resolve(runBrowserTests()).catch(error =>
{
  console.error("Failed running browser tests");
  console.error(error);
}).then(() =>
{
  if (unitFiles.length)
    nodeunit.reporters.default.run(unitFiles);
});
