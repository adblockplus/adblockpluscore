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

const fs = require("fs");
const path = require("path");
const process = require("process");

const FILENAME = "data/resources.json";

let resourceDir = path.join("build", "assets");
let index = require(path.join("..", resourceDir, "index.json"));


let output = {};

for (let entry of index)
{
  let text;
  let type;
  if (typeof entry.text == "undefined")
  {
    if (!entry.file)
    {
      console.error("Invalid file entry. Aborting.");
      process.exit(1);
    }

    let buffer = fs.readFileSync(path.join(resourceDir, entry.file));
    text = buffer.toString("base64");
    type = entry.type + ";base64";
  }
  else
  {
    ({text, type} = entry);
  }

  output[entry.name] = `data:${type},${text}`;
}

fs.writeFileSync(FILENAME, JSON.stringify(output, null, 2));
