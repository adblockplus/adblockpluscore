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

const edge = require("selenium-webdriver/edge");
const {executeScript} = require("./webdriver");

function runScript(script, scriptName, scriptArgs)
{
  let service = new edge.ServiceBuilder()
  // Due to some incompatibilities between selenium-webdriver 3.6
  // and Microsoft Edge webdriver we have to use the JSON wire protocol.
  // However once we update to selenium-webdriver 4.0 we should remove this line.
      .addArguments("--jwp")
      .build();
  let options = new edge.Options();

  let driver = edge.Driver.createSession(options, service);

  return executeScript(driver, "Microsoft Edge (WebDriver)",
                       script, scriptName, scriptArgs);
}

module.exports = function(script, scriptName, ...scriptArgs)
{
  return runScript(script, scriptName, scriptArgs);
};
