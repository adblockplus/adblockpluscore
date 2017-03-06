/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-2016 Eyeo GmbH
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

let childProcess = require("child_process");
let fs = require("fs");
let nodeunit = require("nodeunit");
let path = require("path");
let phantomjs = require("phantomjs2");
let process = require("process");
let url = require("url");

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
if (process.argv.length > 2)
  addTestPaths(process.argv.slice(2), true);
else
{
  addTestPaths(
    [path.join(__dirname, "test"), path.join(__dirname, "test", "browser")],
    true
  );
}

if (browserFiles.length)
{
  let nodeunitPath = path.join(
    path.dirname(require.resolve("nodeunit")),
    "examples", "browser", "nodeunit.js"
  );
  browserFiles.unshift(nodeunitPath);

  let urls = browserFiles.map(file =>
  {
    return url.format({
      protocol: "file",
      slashes: "true",
      pathname: path.resolve(process.cwd(), file).split(path.sep).join("/")
    });
  });
  let args = [path.join(__dirname, "browsertests.js")].concat(urls);
  childProcess.execFileSync(phantomjs.path, args, {stdio: "inherit"});
}
if (unitFiles.length)
  nodeunit.reporters.default.run(unitFiles);
