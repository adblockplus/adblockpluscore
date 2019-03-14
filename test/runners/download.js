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
const os = require("os");
const https = require("https");
const path = require("path");

const extractZip = require("extract-zip");

function snapshotsRootDir()
{
  let rootDir = process.env.BROWSER_SNAPSHOT_DIR ||
                path.join(__dirname, "..", "..");

  return rootDir.replace("~", os.homedir);
}

function download(url, destFile)
{
  return new Promise((resolve, reject) =>
  {
    let cacheDir = path.dirname(destFile);
    if (!fs.existsSync(cacheDir))
      fs.mkdirSync(cacheDir);
    let tempDest = destFile + "-" + process.pid;
    let writable = fs.createWriteStream(tempDest);

    https.get(url, response =>
    {
      if (response.statusCode != 200)
      {
        reject(
          new Error(`Unexpected server response: ${response.statusCode}`));
        response.resume();
        return;
      }

      response.pipe(writable)
              .on("error", error =>
              {
                writable.close();
                fs.unlinkSync(tempDest);
                reject(error);
              })
              .on("close", () =>
              {
                writable.close();
                fs.renameSync(tempDest, destFile);
                resolve();
              });
    }).on("error", reject);
  });
}

function unzipArchive(archive, destDir)
{
  return new Promise((resolve, reject) =>
  {
    extractZip(archive, {dir: destDir}, err =>
    {
      if (err)
        reject(err);
      else
        resolve();
    });
  });
}

module.exports = {
  download,
  unzipArchive,
  snapshotsRootDir
};
