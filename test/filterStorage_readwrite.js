/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-2016 Eyeo GmbH
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

let {createSandbox, unexpectedError} = require("./_common");

let Filter = null;
let FilterNotifier = null;
let FilterStorage = null;
let IO = null;
let Prefs = null;
let Subscription = null;
let ExternalSubscription = null;

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

  FilterStorage.addSubscription(Subscription.fromURL("~fl~"));
  callback();
}

let testData = new Promise((resolve, reject) =>
{
  let fs = require("fs");
  let path = require("path");
  let datapath = path.resolve(__dirname, "data", "patterns.ini");

  fs.readFile(datapath, "utf-8", (error, data) =>
  {
    if (error)
      reject(error);
    else
      resolve(data);
  });
});

function loadFilters(file)
{
  FilterStorage.loadFromDisk(file);
  return FilterNotifier.once("load");
}

function saveFilters(file)
{
  FilterStorage.saveToDisk(file);
  return FilterNotifier.once("save");
}

function testReadWrite(test, withExternal)
{
  let tempFile = IO.resolveFilePath("temp_patterns1.ini");
  let tempFile2 = IO.resolveFilePath("temp_patterns2.ini");

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
    sections.sort(function(a, b)
    {
      if (a.key < b.key)
        return -1;
      else if (a.key > b.key)
        return 1;
      else
        return 0;
    });
    return sections.map(function(section) {
      return [section.header].concat(section.data).join("\n");
    }).join("\n");
  }

  return testData.then(data =>
  {
    tempFile.contents = data;
    return loadFilters(tempFile);
  }).then(() =>
  {
    test.equal(FilterStorage.fileProperties.version, FilterStorage.formatVersion, "File format version");

    if (withExternal)
    {
      let subscription = new ExternalSubscription("~external~external subscription ID", "External subscription");
      subscription.filters = [Filter.fromText("foo"), Filter.fromText("bar")];
      FilterStorage.addSubscription(subscription);

      let externalSubscriptions = FilterStorage.subscriptions.filter(subscription => subscription instanceof ExternalSubscription);
      test.equal(externalSubscriptions.length, 1, "Number of external subscriptions after updateExternalSubscription");

      test.equal(externalSubscriptions[0].url, "~external~external subscription ID", "ID of external subscription");
      test.equal(externalSubscriptions[0].filters.length, 2, "Number of filters in external subscription");
    }

    return saveFilters(tempFile2);
  }).then(() => testData).then(expected =>
  {
    test.equal(canonize(tempFile2.contents), canonize(expected), "Read/write result");
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
    let data = "[Subscription]\nurl=" + url;
    let tempFile = IO.resolveFilePath("temp_patterns1.ini");
    tempFile.contents = data;

    loadFilters(tempFile, function()
    {
      test.equal(FilterStorage.subscriptions.length, 0, "Number of filter subscriptions");
    }).catch(unexpectedError.bind(test)).then(() => test.done());
  };

  exports.testLegacyGroups["read non-empty " + url] = function(test)
  {
    let data = "[Subscription]\nurl=" + url + "\n[Subscription filters]\nfoo";
    let tempFile = IO.resolveFilePath("temp_patterns1.ini");
    tempFile.contents = data;

    loadFilters(tempFile).then(() =>
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
  let data = "[Subscription]\nurl=~user~1234\ntitle=Foo\n[Subscription filters]\n[User patterns]\nfoo\n\\[bar]\nfoo#bar";
  let tempFile = IO.resolveFilePath("temp_patterns1.ini");
  tempFile.contents = data;

  loadFilters(tempFile).then(() =>
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

exports.testSavingWithoutBackups = function(test)
{
  Prefs.patternsbackups = 0;
  Prefs.patternsbackupinterval = 24;

  let tempFile = IO.resolveFilePath("temp_patterns.ini");
  Object.defineProperty(FilterStorage, "sourceFile", {get: () => tempFile.clone()});

  saveFilters(null).then(() =>
  {
    return saveFilters(null);
  }).then(() =>
  {
    let backupFile = tempFile.clone();
    backupFile.leafName = backupFile.leafName.replace(/\.ini$/, "-backup1.ini");
    test.ok(!backupFile.exists(), "Backup shouldn't be created");
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testSavingWithBackups = function(test)
{
  Prefs.patternsbackups = 2;
  Prefs.patternsbackupinterval = 24;

  let tempFile = IO.resolveFilePath("temp_patterns.ini");
  Object.defineProperty(FilterStorage, "sourceFile", {get: () => tempFile.clone()});

  let backupFile = tempFile.clone();
  backupFile.leafName = backupFile.leafName.replace(/\.ini$/, "-backup1.ini");

  let backupFile2 = tempFile.clone();
  backupFile2.leafName = backupFile2.leafName.replace(/\.ini$/, "-backup2.ini");

  let backupFile3 = tempFile.clone();
  backupFile3.leafName = backupFile3.leafName.replace(/\.ini$/, "-backup3.ini");

  let oldModifiedTime;

  saveFilters(null).then(() =>
  {
    // Save again immediately
    return saveFilters(null);
  }).then(() =>
  {
    test.ok(backupFile.exists(), "First backup created");

    backupFile.lastModifiedTime -= 10000;
    oldModifiedTime = backupFile.lastModifiedTime;
    return saveFilters(null);
  }).then(() =>
  {
    test.equal(backupFile.lastModifiedTime, oldModifiedTime, "Backup not overwritten if it is only 10 seconds old");

    backupFile.lastModifiedTime -= 40*60*60*1000;
    oldModifiedTime = backupFile.lastModifiedTime;
    return saveFilters(null);
  }).then(() =>
  {
    test.notEqual(backupFile.lastModifiedTime, oldModifiedTime, "Backup overwritten if it is 40 hours old");

    test.ok(backupFile2.exists(), "Second backup created when first backup is overwritten");

    backupFile.lastModifiedTime -= 20000;
    oldModifiedTime = backupFile2.lastModifiedTime;
    return saveFilters(null);
  }).then(() =>
  {
    test.equal(backupFile2.lastModifiedTime, oldModifiedTime, "Second backup not overwritten if first one is only 20 seconds old");

    backupFile.lastModifiedTime -= 25*60*60*1000;
    oldModifiedTime = backupFile2.lastModifiedTime;
    return saveFilters(null);
  }).then(() =>
  {
    test.notEqual(backupFile2.lastModifiedTime, oldModifiedTime, "Second backup overwritten if first one is 25 hours old");

    test.ok(!backupFile3.exists(), "Third backup not created with patternsbackups = 2");
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};
