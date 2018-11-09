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

"use strict";

const fs = require("fs");
const path = require("path");

const MemoryFS = require("memory-fs");
const nodeunit = require("nodeunit");
const webpack = require("webpack");

const chromiumRemoteProcess = require("./test/runners/chromium_remote_process");
const chromiumProcess = require("./test/runners/chromium_process");
const firefoxProcess = require("./test/runners/firefox_process");

let unitFiles = [];
let browserFiles = [];

let runnerDefinitions = {
  // Chromium with chrome-remote-interface
  chromium_remote: chromiumRemoteProcess,
  // Chromium with WebDriver (requires Chromium >= 63.0.3239)
  chromium: chromiumProcess,
  firefox: firefoxProcess
};

function configureRunners()
{
  let runners = "BROWSER_TEST_RUNNERS" in process.env ?
      process.env.BROWSER_TEST_RUNNERS.split(",") : [];

  if (runners.length == 0)
  {
    // We default to not using the Chromium remote interface on Windows,
    // as it fails.
    if (process.platform == "win32")
      return ["chromium", "firefox"];
    return ["chromium_remote", "firefox"];
  }

  return runners.filter(runner => runnerDefinitions.hasOwnProperty(runner));
}

let runnerProcesses = configureRunners();

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

function webpackInMemory(bundleFilename, options)
{
  return new Promise((resolve, reject) =>
  {
    // Based on this example
    // https://webpack.js.org/api/node/#custom-file-systems
    let memoryFS = new MemoryFS();

    options.output = {filename: bundleFilename, path: "/"};
    options.devtool = "cheap-eval-source-map";
    let webpackCompiler = webpack(options);
    webpackCompiler.outputFileSystem = memoryFS;

    webpackCompiler.run((err, stats) =>
    {
      // Error handling is based on this example
      // https://webpack.js.org/api/node/#error-handling
      if (err)
      {
        let reason = err.stack || err;
        if (err.details)
          reason += "\n" + err.details;
        reject(reason);
      }
      else if (stats.hasErrors())
        reject(stats.toJson().errors);
      else
      {
        let bundle = memoryFS.readFileSync("/" + bundleFilename, "utf-8");
        memoryFS.unlinkSync("/" + bundleFilename);
        resolve(bundle);
      }
    });
  });
}

function runBrowserTests(processes)
{
  if (!browserFiles.length)
    return Promise.resolve();

  let nodeunitPath = path.join(__dirname, "node_modules", "nodeunit",
                               "examples", "browser", "nodeunit.js");
  let bundleFilename = "bundle.js";

  return webpackInMemory(bundleFilename, {
    entry: path.join(__dirname, "test", "browser", "_bootstrap.js"),
    module: {
      rules: [{
        resource: nodeunitPath,
        // I would have rather used exports-loader here, to avoid treating
        // nodeunit as a global. Unfortunately the nodeunit browser example
        // script is quite slopily put together, if exports isn't falsey it
        // breaks! As a workaround we need to use script-loader, which means
        // that exports is falsey for that script as a side-effect.
        use: ["script-loader"]
      }]
    },
    resolve: {
      alias: {
        nodeunit$: nodeunitPath
      },
      modules: [path.resolve(__dirname, "lib")]
    }
  }).then(bundle =>
    Promise.all(
      processes.map(currentProcess =>
        runnerDefinitions[currentProcess](
          bundle, bundleFilename,
          browserFiles.map(
            file => path.relative(path.join(__dirname, "test", "browser"),
                                  file).replace(/\.js$/, "")
          )
        )
        // We need to convert rejected promise to a resolved one
        // or the test will not let close the webdriver.
        .catch(e => e)
    )).then(results =>
    {
      let errors = results.filter(e => typeof e != "undefined");
      if (errors.length)
        throw `Browser unit test failed: ${errors.join(", ")}`;
    })
  );
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

runBrowserTests(runnerProcesses).then(() =>
{
  if (unitFiles.length)
    nodeunit.reporters.default.run(unitFiles);
}).catch(error =>
{
  console.error(error);
  process.exit(1);
});
