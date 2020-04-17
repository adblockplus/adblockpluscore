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
const {promisify} = require("util");
const request = require("request");

const writeFileAsync = promisify(fs.writeFile);
const requestAsync = promisify(request);

const PSL_URL = "https://publicsuffix.org/list/public_suffix_list.dat";
const FILENAME = "data/publicSuffixList.json";

async function main()
{
  let {statusCode, body} = await requestAsync(PSL_URL);

  if (statusCode != 200)
    throw new Error("Request failed with status code " + statusCode);

  let psl = {};

  for (let line of body.split(/\r?\n/))
  {
    if (line.startsWith("//") || !line.includes("."))
      continue;

    let value = 1;
    line = line.replace(/\s+$/, "");

    if (line.startsWith("*."))
    {
      line = line.slice(2);
      value = 2;
    }
    else if (line.startsWith("!"))
    {
      line = line.slice(1);
      value = 0;
    }

    psl[new URL("http://" + line).hostname] = value;
  }

  let keys = Object.keys(psl).sort();
  await writeFileAsync(FILENAME, JSON.stringify(psl, keys, 2));
}

if (require.main == module)
  main();
