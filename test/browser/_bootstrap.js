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

/* globals nodeunit */
require("nodeunit");

function runTests(moduleNames)
{
  function bold(str)
  {
    return "\u001B[1m" + str + "\u001B[22m";
  }

  function ok(str)
  {
    return "\u001B[32m" + str + "\u001B[39m";
  }

  function error(str)
  {
    return "\u001B[31m" + str + "\u001B[39m";
  }

  let tests = {};
  for (let module of moduleNames)
    tests[module] = nodeunit.testCase(require("./" + module + ".js"));

  return new Promise((resolve, reject) =>
  {
    nodeunit.runModules(tests, {
      moduleStart(name)
      {
        if (typeof window._consoleLogs == "undefined")
          window._consoleLogs = {failures: 0, log: []};
        console.log(bold(name));
      },
      testDone(name, assertions)
      {
        let errors = assertions.filter(assertion => assertion.failed())
                               .map(assertion => assertion.error);

        if (errors.length == 0)
          console.log("\u2714 " + name);
        else
        {
          console.log(error("\u2716 " + name) + "\n");
          errors.forEach(e =>
          {
            if (e.stack)
              console.log(e.stack);
            else
              console.log(String(e));
            console.log("");
          });
        }
      },
      done(assertions)
      {
        let failures = assertions.filter(assertion => assertion.failed());
        if (failures.length)
        {
          window._consoleLogs.failures += failures.length;
          console.log(
            "\n" +
            bold(error("FAILURES: ")) +
            failures.length + "/" + assertions.length + " assertions failed"
          );
        }
        else
        {
          console.log(
            `\n ${bold(ok("OK: "))}${assertions.length} assertions (${assertions.duration}ms)`
          );
        }

        resolve();
      }
    });
  });
}

module.exports = runTests;
