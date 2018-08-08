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

const {Builder} = require("selenium-webdriver");
const firefox = require("selenium-webdriver/firefox");
require("geckodriver");

const {executeScript} = require("./webdriver");
const {ensureFirefox} = require("./firefox_download");

const FIREFOX_VERSION = "56.0";

function runScript(firefoxPath, script, scriptName, scriptArgs)
{
  let binary = new firefox.Binary(firefoxPath);
  binary.addArguments("-headless");

  const options = new firefox.Options()
        .setBinary(binary);

  const driver = new Builder()
        .forBrowser("firefox")
        .setFirefoxOptions(options)
        .build();

  return executeScript(driver, "Firefox", script, scriptName, scriptArgs);
}

module.exports = function(script, scriptName, ...scriptArgs)
{
  return ensureFirefox(FIREFOX_VERSION).then(firefoxPath =>
  {
    return runScript(firefoxPath, script, scriptName, scriptArgs)
      .then(result => result)
      .catch(error =>
      {
        throw error;
      });
  });
};
