/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-2017 eyeo GmbH
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

"use strict";

const childProcess = require("child_process");
const fs = require("fs");
const https = require("https");
const os = require("os");
const path = require("path");

const remoteInterface = require("chrome-remote-interface");
const unzip = require("unzip");

const CHROMIUM_REVISION = 467222;

function rmdir(dirPath)
{
  for (let file of fs.readdirSync(dirPath))
  {
    let filePath = path.join(dirPath, file);
    try
    {
      if (fs.statSync(filePath).isDirectory())
        rmdir(filePath);
      else
        fs.unlinkSync(filePath);
    }
    catch (error)
    {
      console.error(error);
    }
  }

  try
  {
    fs.rmdirSync(dirPath);
  }
  catch (error)
  {
    console.error(error);
  }
}

function getChromiumExecutable(chromiumDir)
{
  switch (process.platform)
  {
    case "win32":
      return path.join(chromiumDir, "chrome-win32", "chrome.exe");
    case "linux":
      return path.join(chromiumDir, "chrome-linux", "chrome");
    case "darwin":
      return path.join(chromiumDir, "chrome-mac", "Chromium.app", "Contents",
                       "MacOS", "Chromium");
    default:
      throw new Error("Unexpected platform");
  }
}

function ensureChromium()
{
  let {platform} = process;
  if (platform == "win32")
    platform += "-" + process.arch;
  let buildTypes = {
    "win32-ia32": ["Win", "chrome-win32.zip"],
    "win32-x64": ["Win_x64", "chrome-win32.zip"],
    "linux": ["Linux_x64", "chrome-linux.zip"],
    "darwin": ["Mac", "chrome-mac.zip"]
  };

  if (!buildTypes.hasOwnProperty(platform))
  {
    let err = new Error(`Cannot run browser tests, ${platform} is unsupported`);
    return Promise.reject(err);
  }

  let chromiumDir = path.join(__dirname, "chromium-snapshots",
                              `chromium-${platform}-${CHROMIUM_REVISION}`);
  if (fs.existsSync(chromiumDir))
    return Promise.resolve(getChromiumExecutable(chromiumDir));

  if (!fs.existsSync(path.dirname(chromiumDir)))
    fs.mkdirSync(path.dirname(chromiumDir));
  return new Promise((resolve, reject) =>
  {
    console.info("Downloading Chromium...");
    let [dir, fileName] = buildTypes[platform];
    let url = `https://www.googleapis.com/download/storage/v1/b/chromium-browser-snapshots/o/${dir}%2F${CHROMIUM_REVISION}%2F${fileName}?alt=media`;
    https.get(url, response =>
    {
      if (response.statusCode != 200)
      {
        reject(new Error(`Unexpected server response: ${response.statusCode}`));
        response.resume();
        return;
      }

      response.pipe(unzip.Extract({path: chromiumDir}))
              .on("error", reject)
              .on("close", () => resolve(getChromiumExecutable(chromiumDir)));
    }).on("error", reject);
  });
}

function startChromium(chromiumPath)
{
  fs.chmodSync(chromiumPath, fs.constants.S_IRWXU);

  let dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "chromium-data"));
  let child = null;
  return {
    kill: () => child && child.kill(),
    done: new Promise((resolve, reject) =>
    {
      child = childProcess.execFile(chromiumPath, [
        "--headless", "--single-process", "--disable-gpu", "--no-sandbox",
        "--allow-file-access-from-files", "--remote-debugging-port=9222",
        "--user-data-dir=" + dataDir
      ], error =>
      {
        rmdir(dataDir);
        if (error)
          reject(error);
        else
          resolve();
      });
    })
  };
}

function throwException(details, url)
{
  let text = details.exception ? details.exception.description : details.text;
  if (!details.stackTrace)
  {
    // ExceptionDetails uses zero-based line and column numbers.
    text += `\n    at ${details.url || url}:` +
            (details.lineNumber + 1) + ":" +
            (details.columnNumber + 1);
  }
  throw text;
}

function reportMessage(text, level)
{
  let method = {
    log: "log",
    warning: "warn",
    error: "error",
    debug: "log",
    info: "info"
  }[level] || "log";
  console[method](text);
}

function connectRemoteInterface(attempt)
{
  return remoteInterface().catch(error =>
  {
    attempt = attempt || 1;
    if (attempt > 50)
    {
      // Stop trying to connect after 10 seconds
      throw error;
    }

    return new Promise((resolve, reject) =>
    {
      setTimeout(() =>
      {
        connectRemoteInterface(attempt + 1).then(resolve).catch(reject);
      }, 200);
    });
  });
}

function runBootstrap(initialPage, bootstrapPath, bootstrapArgs)
{
  return connectRemoteInterface().then(async client =>
  {
    try
    {
      let {Runtime, Log, Console, Page} = client;

      await Log.enable();
      Log.entryAdded(({entry}) =>
      {
        reportMessage(entry.text, entry.level);
      });

      await Console.enable();
      Console.messageAdded(({message}) =>
      {
        reportMessage(message.text, message.level);
      });

      await Page.navigate({url: initialPage});

      await Runtime.enable();
      let compileResult = await Runtime.compileScript({
        expression: fs.readFileSync(bootstrapPath, "utf-8"),
        sourceURL: bootstrapPath,
        persistScript: true
      });
      if (compileResult.exceptionDetails)
        throwException(compileResult.exceptionDetails, bootstrapPath);

      let runResult = await Runtime.runScript({
        scriptId: compileResult.scriptId
      });
      if (runResult.exceptionDetails)
        throwException(runResult.exceptionDetails, bootstrapPath);

      let callResult = await Runtime.callFunctionOn({
        objectId: runResult.result.objectId,
        functionDeclaration: "function(...args) {return this(...args);}",
        arguments: bootstrapArgs.map(url => ({value: url}))
      });
      if (callResult.exceptionDetails)
        throwException(callResult.exceptionDetails, bootstrapPath);

      let promiseResult = await Runtime.awaitPromise({
        promiseObjectId: callResult.result.objectId
      });
      if (promiseResult.exceptionDetails)
        throwException(promiseResult.exceptionDetails, bootstrapPath);
    }
    finally
    {
      client.close();
    }
  });
}

module.exports = function(initialPage, bootstrapPath, bootstrapArgs)
{
  return ensureChromium().then(chromiumPath =>
  {
    let child = startChromium(chromiumPath);
    return Promise.race([
      child.done,
      runBootstrap(initialPage, bootstrapPath, bootstrapArgs)
    ]).then(result =>
    {
      child.kill();
      return result;
    }).catch(error =>
    {
      child.kill();
      throw error;
    });
  });
};
