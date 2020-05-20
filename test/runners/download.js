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
const {pipeline} = require("stream");
const {promisify} = require("util");

const got = require("got");
const extractZip = require("extract-zip");

async function download(url, destFile)
{
  let cacheDir = path.dirname(destFile);
  if (!await fs.promises.access(cacheDir))
    await fs.promises.mkdir(cacheDir);

  let tempDest = `${destFile}-${process.pid}`;
  let writable = fs.createWriteStream(tempDest);

  try
  {
    await promisify(pipeline)(got.stream(url), writable);
  }
  catch (error)
  {
    fs.unlink(tempDest, () => {});
    throw error;
  }

  await fs.promises.rename(tempDest, destFile);
}

async function unzipArchive(archive, destDir)
{
  await extractZip(archive, {dir: destDir});
}

module.exports = {
  download,
  unzipArchive
};
