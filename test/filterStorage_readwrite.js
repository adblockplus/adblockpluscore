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

const {createSandbox, unexpectedError} = require("./_common");

let Filter = null;
let FilterStorage = null;
let IO = null;
let Prefs = null;
let ExternalSubscription = null;

exports.setUp = function(callback)
{
  let sandboxedRequire = createSandbox();
  (
    {Filter} = sandboxedRequire("../lib/filterClasses"),
    {FilterStorage} = sandboxedRequire("../lib/filterStorage"),
    {IO} = sandboxedRequire("./stub-modules/io"),
    {Prefs} = sandboxedRequire("./stub-modules/prefs"),
    {ExternalSubscription} = sandboxedRequire("../lib/subscriptionClasses")
  );

  FilterStorage.addFilter(Filter.fromText("foobar"));
  callback();
};

let testData = new Promise((resolve, reject) =>
{
  const fs = require("fs");
  const path = require("path");
  let datapath = path.resolve(__dirname, "data", "patterns.ini");

  fs.readFile(datapath, "utf-8", (error, data) =>
  {
    if (error)
      reject(error);
    else
      resolve(data.split(/[\r\n]+/));
  });
});

function canonize(data)
{
  let curSection = null;
  let sections = [];
  for (let line of data)
  {
    if (/^\[.*\]$/.test(line))
    {
      if (curSection)
        sections.push(curSection);

      curSection = {header: line, data: []};
    }
    else if (curSection && /\S/.test(line))
      curSection.data.push(line);
  }
  if (curSection)
    sections.push(curSection);

  for (let section of sections)
  {
    section.key = section.header + " " + section.data[0];
    section.data.sort();
  }
  sections.sort((a, b) =>
  {
    if (a.key < b.key)
      return -1;
    else if (a.key > b.key)
      return 1;
    return 0;
  });
  return sections;
}

function testReadWrite(test, withExternal)
{
  test.ok(!FilterStorage.initialized, "Uninitialized before the first load");

  return testData.then(data =>
  {
    IO._setFileContents(FilterStorage.sourceFile, data);
    return FilterStorage.loadFromDisk();
  }).then(() =>
  {
    test.ok(FilterStorage.initialized, "Initialize after the first load");
    test.equal(FilterStorage.fileProperties.version, FilterStorage.formatVersion, "File format version");

    if (withExternal)
    {
      {
        let subscription = new ExternalSubscription("~external~external subscription ID", "External subscription");
        subscription.filters = [Filter.fromText("foo"), Filter.fromText("bar")];
        FilterStorage.addSubscription(subscription);
      }

      let externalSubscriptions = FilterStorage.subscriptions.filter(subscription => subscription instanceof ExternalSubscription);
      test.equal(externalSubscriptions.length, 1, "Number of external subscriptions after updateExternalSubscription");

      test.equal(externalSubscriptions[0].url, "~external~external subscription ID", "ID of external subscription");
      test.equal(externalSubscriptions[0].filters.length, 2, "Number of filters in external subscription");
    }

    return FilterStorage.saveToDisk();
  }).then(() => testData).then(expected =>
  {
    test.deepEqual(canonize(IO._getFileContents(FilterStorage.sourceFile)),
               canonize(expected), "Read/write result");
  }).catch(unexpectedError.bind(test)).then(() => test.done());
}

exports.testReadAndSaveToFile = function(test)
{
  testReadWrite(test, false);
};

exports.testReadAndSaveToFileWithExternalSubscription = function(test)
{
  testReadWrite(test, true);
};

exports.testImportExport = function(test)
{
  testData.then(lines =>
  {
    if (lines.length && lines[lines.length - 1] == "")
      lines.pop();

    let importer = FilterStorage.importData();
    for (let line of lines)
      importer(line);
    importer(null);

    test.equal(FilterStorage.fileProperties.version, FilterStorage.formatVersion, "File format version");

    let exported = Array.from(FilterStorage.exportData());
    test.deepEqual(canonize(exported), canonize(lines), "Import/export result");
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testSavingWithoutBackups = function(test)
{
  Prefs.patternsbackups = 0;
  Prefs.patternsbackupinterval = 24;

  FilterStorage.saveToDisk().then(() =>
  {
    return FilterStorage.saveToDisk();
  }).then(() =>
  {
    test.ok(!IO._getFileContents(FilterStorage.getBackupName(1)),
            "Backup shouldn't be created");
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testSavingWithBackups = function(test)
{
  Prefs.patternsbackups = 2;
  Prefs.patternsbackupinterval = 24;

  let backupFile = FilterStorage.getBackupName(1);
  let backupFile2 = FilterStorage.getBackupName(2);
  let backupFile3 = FilterStorage.getBackupName(3);

  let oldModifiedTime;

  FilterStorage.saveToDisk().then(() =>
  {
    // Save again immediately
    return FilterStorage.saveToDisk();
  }).then(() =>
  {
    test.ok(IO._getFileContents(backupFile), "First backup created");

    oldModifiedTime = IO._getModifiedTime(backupFile) - 10000;
    IO._setModifiedTime(backupFile, oldModifiedTime);
    return FilterStorage.saveToDisk();
  }).then(() =>
  {
    test.equal(IO._getModifiedTime(backupFile), oldModifiedTime, "Backup not overwritten if it is only 10 seconds old");

    oldModifiedTime -= 40 * 60 * 60 * 1000;
    IO._setModifiedTime(backupFile, oldModifiedTime);
    return FilterStorage.saveToDisk();
  }).then(() =>
  {
    test.notEqual(IO._getModifiedTime(backupFile), oldModifiedTime, "Backup overwritten if it is 40 hours old");

    test.ok(IO._getFileContents(backupFile2), "Second backup created when first backup is overwritten");

    IO._setModifiedTime(backupFile, IO._getModifiedTime(backupFile) - 20000);
    oldModifiedTime = IO._getModifiedTime(backupFile2);
    return FilterStorage.saveToDisk();
  }).then(() =>
  {
    test.equal(IO._getModifiedTime(backupFile2), oldModifiedTime, "Second backup not overwritten if first one is only 20 seconds old");

    IO._setModifiedTime(backupFile, IO._getModifiedTime(backupFile) - 25 * 60 * 60 * 1000);
    oldModifiedTime = IO._getModifiedTime(backupFile2);
    return FilterStorage.saveToDisk();
  }).then(() =>
  {
    test.notEqual(IO._getModifiedTime(backupFile2), oldModifiedTime, "Second backup overwritten if first one is 25 hours old");

    test.ok(!IO._getFileContents(backupFile3), "Third backup not created with patternsbackups = 2");
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testRestoringBackup = function(test)
{
  Prefs.patternsbackups = 2;
  Prefs.patternsbackupinterval = 24;

  FilterStorage.saveToDisk().then(() =>
  {
    test.equal(FilterStorage.subscriptions[0].filters.length, 1, "Initial filter count");
    FilterStorage.addFilter(Filter.fromText("barfoo"));
    test.equal(FilterStorage.subscriptions[0].filters.length, 2, "Filter count after adding a filter");
    return FilterStorage.saveToDisk();
  }).then(() =>
  {
    return FilterStorage.loadFromDisk();
  }).then(() =>
  {
    test.equal(FilterStorage.subscriptions[0].filters.length, 2, "Filter count after adding filter and reloading");
    return FilterStorage.restoreBackup(1);
  }).then(() =>
  {
    test.equal(FilterStorage.subscriptions[0].filters.length, 1, "Filter count after restoring backup");
    return FilterStorage.loadFromDisk();
  }).then(() =>
  {
    test.equal(FilterStorage.subscriptions[0].filters.length, 1, "Filter count after reloading");
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};
