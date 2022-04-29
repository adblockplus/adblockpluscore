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

const http = require("http");
const https = require("https");
const {createWriteStream, promises: {access, unlink}} = require("fs");

async function exists(filename) {
  try {
    await access(filename);
    return true;
  }
  catch (error) {
    return false;
  }
}

async function download(url, toFile) {
  console.info(`Downloading ${url} to ${toFile} ...`);
  const proto = url.startsWith("https") ? https : http;

  return new Promise((resolve, reject) => {
    const file = createWriteStream(toFile);
    let fileInfo = null;

    const request = proto.get(url, response => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
        return;
      }

      fileInfo = {
        mime: response.headers["content-type"],
        size: parseInt(response.headers["content-length"], 10)
      };

      response.pipe(file);
    });

    file.on("finish", () => resolve(fileInfo));

    request.on("error", err => {
      unlink(toFile)
        .then(() => reject(err))
        .catch(() => reject(err));
    });

    file.on("error", err => {
      unlink(toFile)
        .then(() => reject(err))
        .catch(() => reject(err));
    });

    request.end();
  });
}

exports.exists = exists;
exports.download = download;
