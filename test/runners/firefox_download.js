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

const {exec} = require("child_process");
const fs = require("fs");
const path = require("path");

const {ncp} = require("ncp");

const {download} = require("./download");

const {platform} = process;

// macOS specific
const dmg = platform == "darwin" ? require("dmg") : null;

function extractTar(archive, browserDir)
{
  return new Promise((resolve, reject) =>
  {
    fs.mkdirSync(browserDir);
    exec(["tar", "-jxf", archive, "-C", browserDir].join(" "),
         err =>
         {
           if (err)
             reject(err);
           else
             resolve();
         });
  });
}

function extractDmg(archive, browserDir)
{
  return new Promise((resolve, reject) =>
  {
    dmg.mount(archive, (err, mpath) =>
    {
      if (err)
        reject(err);
      else
      {
        let files = fs.readdirSync(mpath);
        let target = files.find(file => /\.app/.test(file));
        let source = path.join(mpath, target);
        fs.mkdirSync(browserDir);
        ncp(source, path.join(browserDir, target), ncperr =>
        {
          dmg.unmount(mpath, dmgerr =>
          {
            if (dmgerr)
              console.error(`Error unmounting DMG: ${dmgerr}`);
          });
          if (ncperr)
          {
            console.error(`Error copying ${source} to ${browserDir}`);
            reject(ncperr);
          }
          else
            resolve();
        });
      }
    });
  });
}

function runWinInstaller(archive, browserDir)
{
  // Procedure inspired from mozinstall:
  // https://hg.mozilla.org/mozilla-central/file/tip/testing/mozbase/mozinstall/mozinstall/mozinstall.py
  // Also uninstaller will need to be run.
  return new Promise((resolve, reject) =>
  {
    exec(`"${archive}" /extractdir=${browserDir}`,
         err =>
         {
           if (err)
             reject(err);
           else
             resolve();
         });
  });
}

function extractArchive(archive, browserDir)
{
  switch (platform)
  {
    case "win32":
      return runWinInstaller(archive, browserDir);
    case "linux":
      return extractTar(archive, browserDir);
    case "darwin":
      return extractDmg(archive, browserDir);
    default:
      throw new Error("Unexpected platform");
  }
}

function getFirefoxExecutable(browserDir)
{
  switch (platform)
  {
    case "win32":
      return path.join(browserDir, "core", "firefox.exe");
    case "linux":
      return path.join(browserDir, "firefox", "firefox");
    case "darwin":
      return path.join(browserDir, "Firefox.app", "Contents",
                       "MacOS", "firefox");
    default:
      throw new Error("Unexpected platform");
  }
}

function ensureFirefox(firefoxVersion)
{
  let targetPlatform = platform;
  if (platform == "win32")
    targetPlatform += "-" + process.arch;
  let buildTypes = {
    "win32-ia32": ["win32-EME-free", `Firefox Setup ${firefoxVersion}.exe`],
    "win32-x64": ["win64-EME-free", `Firefox Setup ${firefoxVersion}.exe`],
    "linux": ["linux-x86_64", `firefox-${firefoxVersion}.tar.bz2`],
    "darwin": ["mac-EME-free", `Firefox ${firefoxVersion}.dmg`]
  };

  if (!buildTypes.hasOwnProperty(targetPlatform))
  {
    let err = new Error(`Cannot run browser tests, ${targetPlatform} is unsupported`);
    return Promise.reject(err);
  }

  return Promise.resolve().then(() =>
  {
    let snapshotsDir = path.join(__dirname, "..", "..", "firefox-snapshots");
    let browserDir = path.join(snapshotsDir,
                                `firefox-${targetPlatform}-${firefoxVersion}`);
    if (fs.existsSync(browserDir))
      return browserDir;

    if (!fs.existsSync(path.dirname(browserDir)))
      fs.mkdirSync(path.dirname(browserDir));

    let [buildPlatform, fileName] = buildTypes[targetPlatform];
    let archive = path.join(snapshotsDir, "download-cache", fileName);

    return Promise.resolve()
      .then(() =>
      {
        if (!fs.existsSync(archive))
        {
          let url = `https://archive.mozilla.org/pub/firefox/releases/${firefoxVersion}/${buildPlatform}/en-US/${fileName}`;
          console.info("Downloading Firefox...");
          return download(url, archive);
        }
        console.info(`Reusing cached archive ${archive}`);
      })
      .then(() => extractArchive(archive, browserDir))
      .then(() => browserDir);
  }).then(dir => getFirefoxExecutable(dir));
}

module.exports.ensureFirefox = ensureFirefox;
