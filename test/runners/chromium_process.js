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
const chrome = require("selenium-webdriver/chrome");
require("chromedriver");

const {executeScript} = require("./webdriver");
const {ensureChromium} = require("./chromium_download");

// The Chromium version is a build number, quite obscure.
// Chromium 63.0.3239.x is 508578
// Chromium 65.0.3325.0 is 530368
// We currently want Chromiun 63, as we still support it and that's the
// loweset version that supports WebDriver.
const CHROMIUM_REVISION = 508578;

function runScript(chromiumPath, script, scriptName, scriptArgs)
{
  const options = new chrome.Options()
        .headless()
        // Disabling sandboxing is needed on some system configurations
        // like Debian 9.
        .addArguments("--no-sandbox")
        .setChromeBinaryPath(chromiumPath);

  const driver = new Builder()
        .forBrowser("chrome")
        .setChromeOptions(options)
        .build();

  return executeScript(driver, "Chromium (WebDriver)",
                       script, scriptName, scriptArgs);
}

module.exports = function(script, scriptName, ...scriptArgs)
{
  return ensureChromium(CHROMIUM_REVISION).then(chromiumPath =>
  {
    return runScript(chromiumPath, script, scriptName, scriptArgs)
      .then(result => result)
      .catch(error =>
      {
        throw error;
      });
  });
};
