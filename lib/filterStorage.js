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

/**
 * @fileOverview FilterStorage class responsible for managing user's
 *               subscriptions and filters.
 */

const {FileUtils} = Cu.import("resource://gre/modules/FileUtils.jsm", {});
const {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

const {IO} = require("io");
const {Prefs} = require("prefs");
const {Filter, ActiveFilter} = require("filterClasses");
const {Subscription, SpecialSubscription,
       ExternalSubscription} = require("subscriptionClasses");
const {FilterNotifier} = require("filterNotifier");
const {Utils} = require("utils");

/**
 * Version number of the filter storage file format.
 * @type {number}
 */
let formatVersion = 4;

/**
 * This class reads user's filters from disk, manages them in memory
 * and writes them back.
 * @class
 */
let FilterStorage = exports.FilterStorage =
{
  /**
   * Will be set to true after the initial loadFromDisk() call completes.
   * @type {boolean}
   */
  initialized: false,

  /**
   * Version number of the patterns.ini format used.
   * @type {number}
   */
  get formatVersion()
  {
    return formatVersion;
  },

  /**
   * File that the filter list has been loaded from and should be saved to
   * @type {nsIFile}
   */
  get sourceFile()
  {
    let file = null;
    if (Prefs.patternsfile)
    {
      // Override in place, use it instead of placing the file in the
      // regular data dir
      file = IO.resolveFilePath(Prefs.patternsfile);
    }
    if (!file)
    {
      // Place the file in the data dir
      file = IO.resolveFilePath(Prefs.data_directory);
      if (file)
        file.append("patterns.ini");
    }
    if (!file)
    {
      // Data directory pref misconfigured? Try the default value
      try
      {
        let dir = Services.prefs.getDefaultBranch("extensions.adblockplus.")
                          .getCharPref("data_directory");
        file = IO.resolveFilePath(dir);
        if (file)
          file.append("patterns.ini");
      }
      catch (e) {}
    }

    if (!file)
    {
      Cu.reportError("Adblock Plus: Failed to resolve filter file location " +
                     "from extensions.adblockplus.patternsfile preference");
    }

    // Property is configurable because of the test suite.
    Object.defineProperty(this, "sourceFile",
                          {value: file, configurable: true});
    return file;
  },

  /**
   * Will be set to true if no patterns.ini file exists.
   * @type {boolean}
   */
  firstRun: false,

  /**
   * Map of properties listed in the filter storage file before the sections
   * start. Right now this should be only the format version.
   */
  fileProperties: Object.create(null),

  /**
   * List of filter subscriptions containing all filters
   * @type {Subscription[]}
   */
  subscriptions: [],

  /**
   * Map of subscriptions already on the list, by their URL/identifier
   * @type {Object}
   */
  knownSubscriptions: Object.create(null),

  /**
   * Finds the filter group that a filter should be added to by default. Will
   * return null if this group doesn't exist yet.
   * @param {Filter} filter
   * @return {?SpecialSubscription}
   */
  getGroupForFilter(filter)
  {
    let generalSubscription = null;
    for (let subscription of FilterStorage.subscriptions)
    {
      if (subscription instanceof SpecialSubscription && !subscription.disabled)
      {
        // Always prefer specialized subscriptions
        if (subscription.isDefaultFor(filter))
          return subscription;

        // If this is a general subscription - store it as fallback
        if (!generalSubscription &&
            (!subscription.defaults || !subscription.defaults.length))
        {
          generalSubscription = subscription;
        }
      }
    }
    return generalSubscription;
  },

  /**
   * Adds a filter subscription to the list
   * @param {Subscription} subscription filter subscription to be added
   * @param {boolean} silent  if true, no listeners will be triggered
   *                          (to be used when filter list is reloaded)
   */
  addSubscription(subscription, silent)
  {
    if (subscription.url in FilterStorage.knownSubscriptions)
      return;

    FilterStorage.subscriptions.push(subscription);
    FilterStorage.knownSubscriptions[subscription.url] = subscription;
    addSubscriptionFilters(subscription);

    if (!silent)
      FilterNotifier.triggerListeners("subscription.added", subscription);
  },

  /**
   * Removes a filter subscription from the list
   * @param {Subscription} subscription filter subscription to be removed
   * @param {boolean} silent  if true, no listeners will be triggered
   *                          (to be used when filter list is reloaded)
   */
  removeSubscription(subscription, silent)
  {
    for (let i = 0; i < FilterStorage.subscriptions.length; i++)
    {
      if (FilterStorage.subscriptions[i].url == subscription.url)
      {
        removeSubscriptionFilters(subscription);

        FilterStorage.subscriptions.splice(i--, 1);
        delete FilterStorage.knownSubscriptions[subscription.url];
        if (!silent)
          FilterNotifier.triggerListeners("subscription.removed", subscription);
        return;
      }
    }
  },

  /**
   * Moves a subscription in the list to a new position.
   * @param {Subscription} subscription filter subscription to be moved
   * @param {Subscription} [insertBefore] filter subscription to insert before
   *        (if omitted the subscription will be put at the end of the list)
   */
  moveSubscription(subscription, insertBefore)
  {
    let currentPos = FilterStorage.subscriptions.indexOf(subscription);
    if (currentPos < 0)
      return;

    let newPos = -1;
    if (insertBefore)
      newPos = FilterStorage.subscriptions.indexOf(insertBefore);

    if (newPos < 0)
      newPos = FilterStorage.subscriptions.length;

    if (currentPos < newPos)
      newPos--;
    if (currentPos == newPos)
      return;

    FilterStorage.subscriptions.splice(currentPos, 1);
    FilterStorage.subscriptions.splice(newPos, 0, subscription);
    FilterNotifier.triggerListeners("subscription.moved", subscription);
  },

  /**
   * Replaces the list of filters in a subscription by a new list
   * @param {Subscription} subscription filter subscription to be updated
   * @param {Filter[]} filters new filter list
   */
  updateSubscriptionFilters(subscription, filters)
  {
    removeSubscriptionFilters(subscription);
    subscription.oldFilters = subscription.filters;
    subscription.filters = filters;
    addSubscriptionFilters(subscription);
    FilterNotifier.triggerListeners("subscription.updated", subscription);
    delete subscription.oldFilters;
  },

  /**
   * Adds a user-defined filter to the list
   * @param {Filter} filter
   * @param {SpecialSubscription} [subscription]
   *   particular group that the filter should be added to
   * @param {number} [position]
   *   position within the subscription at which the filter should be added
   * @param {boolean} silent
   *   if true, no listeners will be triggered (to be used when filter list is
   *   reloaded)
   */
  addFilter(filter, subscription, position, silent)
  {
    if (!subscription)
    {
      if (filter.subscriptions.some(s => s instanceof SpecialSubscription &&
                                         !s.disabled))
      {
        return;   // No need to add
      }
      subscription = FilterStorage.getGroupForFilter(filter);
    }
    if (!subscription)
    {
      // No group for this filter exists, create one
      subscription = SpecialSubscription.createForFilter(filter);
      this.addSubscription(subscription);
      return;
    }

    if (typeof position == "undefined")
      position = subscription.filters.length;

    if (filter.subscriptions.indexOf(subscription) < 0)
      filter.subscriptions.push(subscription);
    subscription.filters.splice(position, 0, filter);
    if (!silent)
    {
      FilterNotifier.triggerListeners("filter.added", filter, subscription,
                                      position);
    }
  },

  /**
   * Removes a user-defined filter from the list
   * @param {Filter} filter
   * @param {SpecialSubscription} [subscription] a particular filter group that
   *      the filter should be removed from (if ommited will be removed from all
   *      subscriptions)
   * @param {number} [position]  position inside the filter group at which the
   *      filter should be removed (if ommited all instances will be removed)
   */
  removeFilter(filter, subscription, position)
  {
    let subscriptions = (
      subscription ? [subscription] : filter.subscriptions.slice()
    );
    for (let i = 0; i < subscriptions.length; i++)
    {
      let currentSubscription = subscriptions[i];
      if (currentSubscription instanceof SpecialSubscription)
      {
        let positions = [];
        if (typeof position == "undefined")
        {
          let index = -1;
          do
          {
            index = currentSubscription.filters.indexOf(filter, index + 1);
            if (index >= 0)
              positions.push(index);
          } while (index >= 0);
        }
        else
          positions.push(position);

        for (let j = positions.length - 1; j >= 0; j--)
        {
          let currentPosition = positions[j];
          if (currentSubscription.filters[currentPosition] == filter)
          {
            currentSubscription.filters.splice(currentPosition, 1);
            if (currentSubscription.filters.indexOf(filter) < 0)
            {
              let index = filter.subscriptions.indexOf(currentSubscription);
              if (index >= 0)
                filter.subscriptions.splice(index, 1);
            }
            FilterNotifier.triggerListeners(
              "filter.removed", filter, currentSubscription, currentPosition
            );
          }
        }
      }
    }
  },

  /**
   * Moves a user-defined filter to a new position
   * @param {Filter} filter
   * @param {SpecialSubscription} subscription filter group where the filter is
   *                                           located
   * @param {number} oldPosition current position of the filter
   * @param {number} newPosition new position of the filter
   */
  moveFilter(filter, subscription, oldPosition, newPosition)
  {
    if (!(subscription instanceof SpecialSubscription) ||
        subscription.filters[oldPosition] != filter)
    {
      return;
    }

    newPosition = Math.min(Math.max(newPosition, 0),
                           subscription.filters.length - 1);
    if (oldPosition == newPosition)
      return;

    subscription.filters.splice(oldPosition, 1);
    subscription.filters.splice(newPosition, 0, filter);
    FilterNotifier.triggerListeners("filter.moved", filter, subscription,
                                    oldPosition, newPosition);
  },

  /**
   * Increases the hit count for a filter by one
   * @param {Filter} filter
   */
  increaseHitCount(filter)
  {
    if (!Prefs.savestats || !(filter instanceof ActiveFilter))
      return;

    filter.hitCount++;
    filter.lastHit = Date.now();
  },

  /**
   * Resets hit count for some filters
   * @param {Filter[]} filters  filters to be reset, if null all filters will
   *                            be reset
   */
  resetHitCounts(filters)
  {
    if (!filters)
    {
      filters = [];
      for (let text in Filter.knownFilters)
        filters.push(Filter.knownFilters[text]);
    }
    for (let filter of filters)
    {
      filter.hitCount = 0;
      filter.lastHit = 0;
    }
  },

  /**
   * @callback TextSink
   * @param {string?} line
   */

  /**
   * Allows importing previously serialized filter data.
   * @return {TextSink}
   *    Function to be called for each line of data. Calling it with null as
   *    parameter finalizes the import and replaces existing data. No changes
   *    will be applied before finalization, so import can be "aborted" by
   *    forgetting this callback.
   */
  importData()
  {
    let parser = new INIParser();
    return line =>
    {
      parser.process(line);
      if (line === null)
      {
        // Old special groups might have been converted, remove them if
        // they are empty
        let specialMap = new Set(["~il~", "~wl~", "~fl~", "~eh~"]);
        let knownSubscriptions = Object.create(null);
        for (let i = 0; i < parser.subscriptions.length; i++)
        {
          let subscription = parser.subscriptions[i];
          if (subscription instanceof SpecialSubscription &&
              subscription.filters.length == 0 &&
              specialMap.has(subscription.url))
          {
            parser.subscriptions.splice(i--, 1);
          }
          else
            knownSubscriptions[subscription.url] = subscription;
        }

        this.fileProperties = parser.fileProperties;
        this.subscriptions = parser.subscriptions;
        this.knownSubscriptions = knownSubscriptions;
        Filter.knownFilters = parser.knownFilters;
        Subscription.knownSubscriptions = parser.knownSubscriptions;

        if (parser.userFilters)
        {
          for (let filter of parser.userFilters)
            this.addFilter(Filter.fromText(filter), null, undefined, true);
        }

        FilterNotifier.triggerListeners("load");
      }
    };
  },

  /**
   * Loads all subscriptions from the disk
   */
  loadFromDisk()
  {
    let readFile = () =>
    {
      let parser = {
        process: this.importData()
      };
      IO.readFromFile(this.sourceFile, parser, readFromFileException =>
      {
        this.initialized = true;

        if (!readFromFileException && this.subscriptions.length == 0)
        {
          // No filter subscriptions in the file, this isn't right.
          readFromFileException = new Error("No data in the file");
        }

        if (readFromFileException)
          Cu.reportError(readFromFileException);

        if (readFromFileException)
          tryBackup(1);
      });
    };

    let tryBackup = backupIndex =>
    {
      this.restoreBackup(backupIndex).then(() =>
      {
        if (this.subscriptions.length == 0)
          tryBackup(backupIndex + 1);
      }).catch(error =>
      {
        // Give up
      });
    };

    IO.statFile(this.sourceFile, (statError, statData) =>
    {
      if (statError || !statData.exists)
      {
        this.firstRun = true;
        this.initialized = true;
        FilterNotifier.triggerListeners("load");
      }
      else
        readFile();
    });
  },

  /**
   * Restores an automatically created backup.
   * @param {number} backupIndex
   *    number of the backup to restore (1 being the most recent)
   * @return {Promise} promise resolved or rejected when restoring is complete
   */
  restoreBackup(backupIndex)
  {
    return new Promise((resolve, reject) =>
    {
      // Attempt to load a backup
      let [, part1, part2] = /^(.*)(\.\w+)$/.exec(
        this.sourceFile.leafName
      ) || [null, this.sourceFile.leafName, ""];

      let backupFile = this.sourceFile.clone();
      backupFile.leafName = (part1 + "-backup" + backupIndex + part2);

      let parser = {
        process: this.importData()
      };
      IO.readFromFile(backupFile, parser, error =>
      {
        if (error)
          reject(error);
        else
        {
          this.saveToDisk();
          resolve();
        }
      });
    });
  },

  /**
   * Generator serializing filter data and yielding it line by line.
   */
  *exportData()
  {
    // Do not persist external subscriptions
    let subscriptions = this.subscriptions.filter(
      s => !(s instanceof ExternalSubscription)
    );

    yield "# Adblock Plus preferences";
    yield "version=" + formatVersion;

    let saved = new Set();
    let buf = [];

    // Save filter data
    for (let subscription of subscriptions)
    {
      for (let filter of subscription.filters)
      {
        if (!saved.has(filter.text))
        {
          filter.serialize(buf);
          saved.add(filter.text);
          for (let line of buf)
            yield line;
          buf.splice(0);
        }
      }
    }

    // Save subscriptions
    for (let subscription of subscriptions)
    {
      yield "";

      subscription.serialize(buf);
      if (subscription.filters.length)
      {
        buf.push("", "[Subscription filters]");
        subscription.serializeFilters(buf);
      }
      for (let line of buf)
        yield line;
      buf.splice(0);
    }
  },

  /**
   * Will be set to true if saveToDisk() is running (reentrance protection).
   * @type {boolean}
   */
  _saving: false,

  /**
   * Will be set to true if a saveToDisk() call arrives while saveToDisk() is
   * already running (delayed execution).
   * @type {boolean}
   */
  _needsSave: false,

  /**
   * Saves all subscriptions back to disk
   */
  saveToDisk()
  {
    if (this._saving)
    {
      this._needsSave = true;
      return;
    }

    // Make sure the file's parent directory exists
    let targetFile = this.sourceFile;
    try
    {
      targetFile.parent.create(Ci.nsIFile.DIRECTORY_TYPE,
                               FileUtils.PERMS_DIRECTORY);
    }
    catch (e) {}

    let writeFilters = () =>
    {
      IO.writeToFile(targetFile, this.exportData(), e =>
      {
        this._saving = false;

        if (e)
          Cu.reportError(e);

        if (this._needsSave)
        {
          this._needsSave = false;
          this.saveToDisk();
        }
        else
          FilterNotifier.triggerListeners("save");
      });
    };

    let checkBackupRequired = (callbackNotRequired, callbackRequired) =>
    {
      if (Prefs.patternsbackups <= 0)
        callbackNotRequired();
      else
      {
        IO.statFile(targetFile, (statFileException, statData) =>
        {
          if (statFileException || !statData.exists)
            callbackNotRequired();
          else
          {
            let [, part1, part2] = /^(.*)(\.\w+)$/.exec(targetFile.leafName) ||
              [null, targetFile.leafName, ""];
            let newestBackup = targetFile.clone();
            newestBackup.leafName = part1 + "-backup1" + part2;
            IO.statFile(
              newestBackup,
              (statBackupFileException, statBackupData) =>
              {
                if (!statBackupFileException && (!statBackupData.exists ||
                           (Date.now() - statBackupData.lastModified) /
                             3600000 >= Prefs.patternsbackupinterval))
                {
                  callbackRequired(part1, part2);
                }
                else
                  callbackNotRequired();
              }
            );
          }
        });
      }
    };

    let removeLastBackup = (part1, part2) =>
    {
      let file = targetFile.clone();
      file.leafName = part1 + "-backup" + Prefs.patternsbackups + part2;
      IO.removeFile(
        file, e => renameBackup(part1, part2, Prefs.patternsbackups - 1)
      );
    };

    let renameBackup = (part1, part2, index) =>
    {
      if (index > 0)
      {
        let fromFile = targetFile.clone();
        fromFile.leafName = part1 + "-backup" + index + part2;

        let toName = part1 + "-backup" + (index + 1) + part2;

        IO.renameFile(fromFile, toName, e => renameBackup(part1, part2,
                                                          index - 1));
      }
      else
      {
        let toFile = targetFile.clone();
        toFile.leafName = part1 + "-backup" + (index + 1) + part2;

        IO.copyFile(targetFile, toFile, writeFilters);
      }
    };

    this._saving = true;

    checkBackupRequired(writeFilters, removeLastBackup);
  },

  /**
   * @typedef FileInfo
   * @type {object}
   * @property {nsIFile} file
   * @property {number} lastModified
   */

  /**
   * Returns a promise resolving in a list of existing backup files.
   * @return {Promise.<FileInfo[]>}
   */
  getBackupFiles()
  {
    let backups = [];

    let [, part1, part2] = /^(.*)(\.\w+)$/.exec(
      FilterStorage.sourceFile.leafName
    ) || [null, FilterStorage.sourceFile.leafName, ""];

    function checkBackupFile(index)
    {
      return new Promise((resolve, reject) =>
      {
        let file = FilterStorage.sourceFile.clone();
        file.leafName = part1 + "-backup" + index + part2;

        IO.statFile(file, (error, result) =>
        {
          if (!error && result.exists)
          {
            backups.push({
              index,
              lastModified: result.lastModified
            });
            resolve(checkBackupFile(index + 1));
          }
          else
            resolve(backups);
        });
      });
    }

    return checkBackupFile(1);
  }
};

/**
 * Joins subscription's filters to the subscription without any notifications.
 * @param {Subscription} subscription
 *   filter subscription that should be connected to its filters
 */
function addSubscriptionFilters(subscription)
{
  if (!(subscription.url in FilterStorage.knownSubscriptions))
    return;

  for (let filter of subscription.filters)
    filter.subscriptions.push(subscription);
}

/**
 * Removes subscription's filters from the subscription without any
 * notifications.
 * @param {Subscription} subscription filter subscription to be removed
 */
function removeSubscriptionFilters(subscription)
{
  if (!(subscription.url in FilterStorage.knownSubscriptions))
    return;

  for (let filter of subscription.filters)
  {
    let i = filter.subscriptions.indexOf(subscription);
    if (i >= 0)
      filter.subscriptions.splice(i, 1);
  }
}

/**
 * IO.readFromFile() listener to parse filter data.
 * @constructor
 */
function INIParser()
{
  this.fileProperties = this.curObj = {};
  this.subscriptions = [];
  this.knownFilters = Object.create(null);
  this.knownSubscriptions = Object.create(null);
}
INIParser.prototype =
{
  linesProcessed: 0,
  subscriptions: null,
  knownFilters: null,
  knownSubscriptions: null,
  wantObj: true,
  fileProperties: null,
  curObj: null,
  curSection: null,
  userFilters: null,

  process(val)
  {
    let origKnownFilters = Filter.knownFilters;
    Filter.knownFilters = this.knownFilters;
    let origKnownSubscriptions = Subscription.knownSubscriptions;
    Subscription.knownSubscriptions = this.knownSubscriptions;
    let match;
    try
    {
      if (this.wantObj === true && (match = /^(\w+)=(.*)$/.exec(val)))
        this.curObj[match[1]] = match[2];
      else if (val === null || (match = /^\s*\[(.+)\]\s*$/.exec(val)))
      {
        if (this.curObj)
        {
          // Process current object before going to next section
          switch (this.curSection)
          {
            case "filter":
            case "pattern":
              if ("text" in this.curObj)
                Filter.fromObject(this.curObj);
              break;
            case "subscription": {
              let subscription = Subscription.fromObject(this.curObj);
              if (subscription)
                this.subscriptions.push(subscription);
              break;
            }
            case "subscription filters":
            case "subscription patterns":
              if (this.subscriptions.length)
              {
                let subscription = this.subscriptions[
                  this.subscriptions.length - 1
                ];
                for (let text of this.curObj)
                {
                  let filter = Filter.fromText(text);
                  subscription.filters.push(filter);
                  filter.subscriptions.push(subscription);
                }
              }
              break;
            case "user patterns":
              this.userFilters = this.curObj;
              break;
          }
        }

        if (val === null)
          return;

        this.curSection = match[1].toLowerCase();
        switch (this.curSection)
        {
          case "filter":
          case "pattern":
          case "subscription":
            this.wantObj = true;
            this.curObj = {};
            break;
          case "subscription filters":
          case "subscription patterns":
          case "user patterns":
            this.wantObj = false;
            this.curObj = [];
            break;
          default:
            this.wantObj = undefined;
            this.curObj = null;
        }
      }
      else if (this.wantObj === false && val)
        this.curObj.push(val.replace(/\\\[/g, "["));
    }
    finally
    {
      Filter.knownFilters = origKnownFilters;
      Subscription.knownSubscriptions = origKnownSubscriptions;
    }

    // Allow events to be processed every now and then.
    // Note: IO.readFromFile() will deal with the potential reentrance here.
    this.linesProcessed++;
    if (this.linesProcessed % 1000 == 0)
      return Utils.yield();
  }
};
