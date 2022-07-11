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

import {BROWSERS} from "@eyeo/get-browser-binary";
import "geckodriver";

import {executeScript} from "./webdriver.mjs";

// Firefox 57 seems to be the minimum to reliably run with WebDriver
// on certain system configurations like Debian 9, TravisCI.
const FIREFOX_VERSION = "57.0";

async function runScript(script, scriptArgs) {
  let headless = process.env.BROWSER_TEST_HEADLESS != "0";
  let driver = await BROWSERS.firefox.getDriver(FIREFOX_VERSION, {headless});

  return executeScript(driver, "Firefox", script, scriptArgs);
}

export default function(script, scriptName, ...scriptArgs) {
  return runScript(script, scriptArgs);
}
