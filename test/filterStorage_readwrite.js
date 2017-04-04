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

"use strict";

const {createSandbox, unexpectedError} = require("./_common");

let Filter = null;
let FilterNotifier = null;
let FilterStorage = null;
let IO = null;
let Prefs = null;
let Subscription = null;
let ExternalSubscription = null;
let dataFile = null;

exports.setUp = function(callback)
{
  let sandboxedRequire = createSandbox();
  (
    {Filter} = sandboxedRequire("../lib/filterClasses"),
    {FilterNotifier} = sandboxedRequire("../lib/filterNotifier"),
    {FilterStorage} = sandboxedRequire("../lib/filterStorage"),
    {IO} = sandboxedRequire("./stub-modules/io"),
    {Prefs} = sandboxedRequire("./stub-modules/prefs"),
    {Subscription, ExternalSubscription} = sandboxedRequire("../lib/subscriptionClasses")
  );

  Prefs.patternsfile = "patterns.ini";
  dataFile = IO.resolveFilePath(Prefs.patternsfile);

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
      resolve(data);
  });
});

function loadFilters()
{
  FilterStorage.loadFromDisk();
  return FilterNotifier.once("load");
}

function saveFilters()
{
  FilterStorage.saveToDisk();
  return FilterNotifier.once("save");
}

function canonize(data)
{
  let curSection = null;
  let sections = [];
  for (let line of (data + "\n[end]").split(/[\r\n]+/))
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
  return sections.map(
    section => [section.header].concat(section.data).join("\n")
  ).join("\n");
}

function testReadWrite(test, withExternal)
{
  test.ok(!FilterStorage.initialized, "Uninitialized before the first load");

  return testData.then(data =>
  {
    dataFile.contents = data;
    return loadFilters();
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

    return saveFilters();
  }).then(() => testData).then(expected =>
  {
    test.equal(canonize(dataFile.contents), canonize(expected), "Read/write result");
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

exports.testLegacyGroups = {};

for (let url of ["~wl~", "~fl~", "~eh~"])
{
  exports.testLegacyGroups["read empty " + url] = function(test)
  {
    dataFile.contents = "[Subscription]\nurl=" + url;

    loadFilters(() =>
    {
      test.equal(FilterStorage.subscriptions.length, 0, "Number of filter subscriptions");
    }).catch(unexpectedError.bind(test)).then(() => test.done());
  };

  exports.testLegacyGroups["read non-empty " + url] = function(test)
  {
    dataFile.contents = "[Subscription]\nurl=" + url + "\n[Subscription filters]\nfoo";

    loadFilters().then(() =>
    {
      test.equal(FilterStorage.subscriptions.length, 1, "Number of filter subscriptions");
      if (FilterStorage.subscriptions.length == 1)
      {
        let subscription = FilterStorage.subscriptions[0];
        test.equal(subscription.url, url, "Subscription ID");
        test.equal(subscription.title, null, "Subscription title");
        test.deepEqual(subscription.defaults, null, "Default types");
        test.equal(subscription.filters.length, 1, "Number of subscription filters");
        if (subscription.filters.length == 1)
          test.equal(subscription.filters[0].text, "foo", "First filter");
      }
    }).catch(unexpectedError.bind(test)).then(() => test.done());
  };
}

exports.testReadLegacyFilters = function(test)
{
  dataFile.contents = "[Subscription]\nurl=~user~1234\ntitle=Foo\n[Subscription filters]\n[User patterns]\nfoo\n\\[bar]\nfoo#bar";

  loadFilters().then(() =>
  {
    test.equal(FilterStorage.subscriptions.length, 1, "Number of filter subscriptions");
    if (FilterStorage.subscriptions.length == 1)
    {
      let subscription = FilterStorage.subscriptions[0];
      test.equal(subscription.filters.length, 3, "Number of subscription filters");
      if (subscription.filters.length == 3)
      {
        test.equal(subscription.filters[0].text, "foo", "First filter");
        test.equal(subscription.filters[1].text, "[bar]", "Second filter");
        test.equal(subscription.filters[2].text, "foo#bar", "Third filter");
      }
    }
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testImportExport = function(test)
{
  testData.then(data =>
  {
    let lines = data.split("\n");
    if (lines.length && lines[lines.length - 1] == "")
      lines.pop();

    let importer = FilterStorage.importData();
    for (let line of lines)
      importer(line);
    importer(null);

    test.equal(FilterStorage.fileProperties.version, FilterStorage.formatVersion, "File format version");

    let exported = "";
    for (let line of FilterStorage.exportData())
      exported += line + "\n";
    test.equal(canonize(exported), canonize(data), "Import/export result");
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testSavingWithoutBackups = function(test)
{
  Prefs.patternsbackups = 0;
  Prefs.patternsbackupinterval = 24;

  saveFilters().then(() =>
  {
    return saveFilters();
  }).then(() =>
  {
    let backupFile = dataFile.clone();
    backupFile.leafName = backupFile.leafName.replace(/\.ini$/, "-backup1.ini");
    test.ok(!backupFile.exists(), "Backup shouldn't be created");
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testSavingWithBackups = function(test)
{
  Prefs.patternsbackups = 2;
  Prefs.patternsbackupinterval = 24;

  let backupFile = dataFile.clone();
  backupFile.leafName = backupFile.leafName.replace(/\.ini$/, "-backup1.ini");

  let backupFile2 = dataFile.clone();
  backupFile2.leafName = backupFile2.leafName.replace(/\.ini$/, "-backup2.ini");

  let backupFile3 = dataFile.clone();
  backupFile3.leafName = backupFile3.leafName.replace(/\.ini$/, "-backup3.ini");

  let oldModifiedTime;

  saveFilters().then(() =>
  {
    // Save again immediately
    return saveFilters();
  }).then(() =>
  {
    test.ok(backupFile.exists(), "First backup created");

    backupFile.lastModifiedTime -= 10000;
    oldModifiedTime = backupFile.lastModifiedTime;
    return saveFilters();
  }).then(() =>
  {
    test.equal(backupFile.lastModifiedTime, oldModifiedTime, "Backup not overwritten if it is only 10 seconds old");

    backupFile.lastModifiedTime -= 40 * 60 * 60 * 1000;
    oldModifiedTime = backupFile.lastModifiedTime;
    return saveFilters();
  }).then(() =>
  {
    test.notEqual(backupFile.lastModifiedTime, oldModifiedTime, "Backup overwritten if it is 40 hours old");

    test.ok(backupFile2.exists(), "Second backup created when first backup is overwritten");

    backupFile.lastModifiedTime -= 20000;
    oldModifiedTime = backupFile2.lastModifiedTime;
    return saveFilters();
  }).then(() =>
  {
    test.equal(backupFile2.lastModifiedTime, oldModifiedTime, "Second backup not overwritten if first one is only 20 seconds old");

    backupFile.lastModifiedTime -= 25 * 60 * 60 * 1000;
    oldModifiedTime = backupFile2.lastModifiedTime;
    return saveFilters();
  }).then(() =>
  {
    test.notEqual(backupFile2.lastModifiedTime, oldModifiedTime, "Second backup overwritten if first one is 25 hours old");

    test.ok(!backupFile3.exists(), "Third backup not created with patternsbackups = 2");
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testRestoringBackup = function(test)
{
  Prefs.patternsbackups = 2;
  Prefs.patternsbackupinterval = 24;

  saveFilters().then(() =>
  {
    test.equal(FilterStorage.subscriptions.length, 1, "Initial subscription count");
    FilterStorage.removeSubscription(FilterStorage.subscriptions[0]);
    return saveFilters();
  }).then(() =>
  {
    return loadFilters();
  }).then(() =>
  {
    test.equal(FilterStorage.subscriptions.length, 0, "Subscription count after removing subscriptions and reloading");
    return FilterStorage.restoreBackup(1);
  }).then(() =>
  {
    test.equal(FilterStorage.subscriptions.length, 1, "Subscription count after restoring backup");
    return loadFilters();
  }).then(() =>
  {
    test.equal(FilterStorage.subscriptions.length, 1, "Subscription count after reloading");
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};
