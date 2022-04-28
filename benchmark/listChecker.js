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
/* eslint no-console: "off" */
/** @module */

"use strict";

const helpers = require("./helpers.js");
const fs = require("fs");
const path = require("path");

async function listChecker() {
  // Check if file exists
  for (let element of
    helpers.divideSetToArray(helpers.getFlagValue("filter-list"))) {
    // If files don't exist, download and save it
    if (!helpers.checkIfFileExists(element.path)) {
      console.log(`Hey, looks like ${element.path} file is missing,
      we are downloading it once, 
      hold on for a second. 
      URL that will be used: ${element.url}.
      Benchmark will start right after`);

      let data = await helpers.downloadFile(element.url);
      let listPath =
        path.join(__dirname, element.path.replace("benchmark", ""));

      await fs.promises.writeFile(listPath, data);
    }
  }
}

if (require.main == module)
  listChecker();
