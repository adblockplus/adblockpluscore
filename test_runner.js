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

let fs = require("fs");
let path = require("path");
let process = require("process");
let nodeunit = require("nodeunit");

let files = [];
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
    }
    else if (path.extname(testPath) == ".js" &&
             !path.basename(testPath).startsWith("_"))
    {
      files.push(testPath);
    }
  }
}
if (process.argv.length > 2)
  addTestPaths(process.argv.slice(2), true);
else
  addTestPaths([path.join(__dirname, "test")], true);

nodeunit.reporters.default.run(files);
