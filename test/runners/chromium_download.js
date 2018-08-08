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

const {download, unzipArchive} = require("./download");

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

function ensureChromium(chromiumRevision)
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

  return Promise.resolve().then(() =>
  {
    let snapshotsDir = path.join(__dirname, "..", "..", "chromium-snapshots");
    let chromiumDir = path.join(snapshotsDir,
                                `chromium-${platform}-${chromiumRevision}`);
    if (fs.existsSync(chromiumDir))
      return chromiumDir;

    if (!fs.existsSync(path.dirname(chromiumDir)))
      fs.mkdirSync(path.dirname(chromiumDir));

    let [dir, fileName] = buildTypes[platform];
    let archive = path.join(snapshotsDir, "download-cache",
                            `${chromiumRevision}-${fileName}`);

    return Promise.resolve()
      .then(() =>
      {
        if (!fs.existsSync(archive))
        {
          console.info("Downloading Chromium...");
          return download(
            `https://www.googleapis.com/download/storage/v1/b/chromium-browser-snapshots/o/${dir}%2F${chromiumRevision}%2F${fileName}?alt=media`,
            archive);
        }
        console.info(`Reusing cached archive ${archive}`);
      })
      .then(() => unzipArchive(archive, chromiumDir))
      .then(() => chromiumDir);
  }).then(dir => getChromiumExecutable(dir));
}

module.exports.ensureChromium = ensureChromium;
