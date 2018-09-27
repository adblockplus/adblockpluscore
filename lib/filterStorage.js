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

/**
 * @fileOverview FilterStorage class responsible for managing user's
 *               subscriptions and filters.
 */

const {IO} = require("io");
const {Prefs} = require("prefs");
const {Filter, ActiveFilter} = require("./filterClasses");
const {Subscription, SpecialSubscription,
       ExternalSubscription} = require("./subscriptionClasses");
const {filterNotifier} = require("./filterNotifier");
const {INIParser} = require("./iniParser");

/**
 * Version number of the filter storage file format.
 * @type {number}
 */
let formatVersion = 5;

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
   * File containing the filter list
   * @type {string}
   */
  get sourceFile()
  {
    return "patterns.ini";
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
   * Yields subscriptions containing all filters
   * @yields {Subscription}
   */
  *subscriptions()
  {
    yield* this.knownSubscriptions.values();
  },

  /**
   * Number of known subscriptions.
   * @type {number}
   */
  get subscriptionCount()
  {
    return this.knownSubscriptions.size;
  },

  /**
   * Map of subscriptions already on the list, by their URL/identifier
   * @type {Map.<string,Subscription>}
   */
  knownSubscriptions: new Map(),

  /**
   * Finds the filter group that a filter should be added to by default. Will
   * return null if this group doesn't exist yet.
   * @param {Filter} filter
   * @return {?SpecialSubscription}
   */
  getGroupForFilter(filter)
  {
    let generalSubscription = null;
    for (let subscription of FilterStorage.knownSubscriptions.values())
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
   */
  addSubscription(subscription)
  {
    if (FilterStorage.knownSubscriptions.has(subscription.url))
      return;

    FilterStorage.knownSubscriptions.set(subscription.url, subscription);
    addSubscriptionFilters(subscription);

    filterNotifier.emit("subscription.added", subscription);
  },

  /**
   * Removes a filter subscription from the list
   * @param {Subscription} subscription filter subscription to be removed
   */
  removeSubscription(subscription)
  {
    if (!FilterStorage.knownSubscriptions.has(subscription.url))
      return;

    removeSubscriptionFilters(subscription);

    FilterStorage.knownSubscriptions.delete(subscription.url);

    // This should be the last remaining reference to the Subscription
    // object.
    Subscription.knownSubscriptions.delete(subscription.url);

    filterNotifier.emit("subscription.removed", subscription);
  },

  /**
   * Replaces the list of filters in a subscription by a new list
   * @param {Subscription} subscription filter subscription to be updated
   * @param {Filter[]} filters new filter list
   */
  updateSubscriptionFilters(subscription, filters)
  {
    removeSubscriptionFilters(subscription);
    let oldFilters = subscription.filters;
    subscription.filters = filters;
    addSubscriptionFilters(subscription);
    filterNotifier.emit("subscription.updated", subscription, oldFilters);
  },

  /**
   * Adds a user-defined filter to the list
   * @param {Filter} filter
   * @param {SpecialSubscription} [subscription]
   *   particular group that the filter should be added to
   * @param {number} [position]
   *   position within the subscription at which the filter should be added
   */
  addFilter(filter, subscription, position)
  {
    if (!subscription)
    {
      for (let currentSubscription of filter.subscriptions())
      {
        if (currentSubscription instanceof SpecialSubscription &&
            !currentSubscription.disabled)
        {
          return;   // No need to add
        }
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

    filter.addSubscription(subscription);
    subscription.filters.splice(position, 0, filter);
    filterNotifier.emit("filter.added", filter, subscription, position);
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
      subscription ? [subscription] : filter.subscriptions()
    );
    for (let currentSubscription of subscriptions)
    {
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
              filter.removeSubscription(currentSubscription);
            filterNotifier.emit("filter.removed", filter, currentSubscription,
                                currentPosition);
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
    filterNotifier.emit("filter.moved", filter, subscription, oldPosition,
                        newPosition);
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
      filters = Filter.knownFilters.values();
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
   * @param {boolean} silent
   *    If true, no "load" notification will be sent out.
   * @return {TextSink}
   *    Function to be called for each line of data. Calling it with null as
   *    parameter finalizes the import and replaces existing data. No changes
   *    will be applied before finalization, so import can be "aborted" by
   *    forgetting this callback.
   */
  importData(silent)
  {
    let parser = new INIParser();
    return line =>
    {
      parser.process(line);
      if (line === null)
      {
        let knownSubscriptions = new Map();
        for (let subscription of parser.subscriptions)
          knownSubscriptions.set(subscription.url, subscription);

        this.fileProperties = parser.fileProperties;
        this.knownSubscriptions = knownSubscriptions;
        Filter.knownFilters = parser.knownFilters;
        Subscription.knownSubscriptions = parser.knownSubscriptions;

        if (!silent)
          filterNotifier.emit("load");
      }
    };
  },

  /**
   * Loads all subscriptions from the disk.
   * @return {Promise} promise resolved or rejected when loading is complete
   */
  loadFromDisk()
  {
    let tryBackup = backupIndex =>
    {
      return this.restoreBackup(backupIndex, true).then(() =>
      {
        if (this.knownSubscriptions.size == 0)
          return tryBackup(backupIndex + 1);
      }).catch(error =>
      {
        // Give up
      });
    };

    return IO.statFile(this.sourceFile).then(statData =>
    {
      if (!statData.exists)
      {
        this.firstRun = true;
        return;
      }

      let parser = this.importData(true);
      return IO.readFromFile(this.sourceFile, parser).then(() =>
      {
        parser(null);
        if (this.knownSubscriptions.size == 0)
        {
          // No filter subscriptions in the file, this isn't right.
          throw new Error("No data in the file");
        }
      });
    }).catch(error =>
    {
      Cu.reportError(error);
      return tryBackup(1);
    }).then(() =>
    {
      this.initialized = true;
      filterNotifier.emit("load");
    });
  },

  /**
   * Constructs the file name for a patterns.ini backup.
   * @param {number} backupIndex
   *    number of the backup file (1 being the most recent)
   * @return {string} backup file name
   */
  getBackupName(backupIndex)
  {
    let [name, extension] = this.sourceFile.split(".", 2);
    return (name + "-backup" + backupIndex + "." + extension);
  },

  /**
   * Restores an automatically created backup.
   * @param {number} backupIndex
   *    number of the backup to restore (1 being the most recent)
   * @param {boolean} silent
   *    If true, no "load" notification will be sent out.
   * @return {Promise} promise resolved or rejected when restoring is complete
   */
  restoreBackup(backupIndex, silent)
  {
    let backupFile = this.getBackupName(backupIndex);
    let parser = this.importData(silent);
    return IO.readFromFile(backupFile, parser).then(() =>
    {
      parser(null);
      return this.saveToDisk();
    });
  },

  /**
   * Generator serializing filter data and yielding it line by line.
   */
  *exportData()
  {
    // Do not persist external subscriptions
    let subscriptions = [];
    for (let subscription of this.subscriptions())
    {
      if (!(subscription instanceof ExternalSubscription))
        subscriptions.push(subscription);
    }

    yield "# Adblock Plus preferences";
    yield "version=" + formatVersion;

    let saved = new Set();
    let buf = [];

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
   * @return {Promise} promise resolved or rejected when saving is complete
   */
  saveToDisk()
  {
    if (this._saving)
    {
      this._needsSave = true;
      return;
    }

    this._saving = true;

    return Promise.resolve().then(() =>
    {
      // First check whether we need to create a backup
      if (Prefs.patternsbackups <= 0)
        return false;

      return IO.statFile(this.sourceFile).then(statData =>
      {
        if (!statData.exists)
          return false;

        return IO.statFile(this.getBackupName(1)).then(backupStatData =>
        {
          if (backupStatData.exists &&
              (Date.now() - backupStatData.lastModified) / 3600000 <
                Prefs.patternsbackupinterval)
          {
            return false;
          }
          return true;
        });
      });
    }).then(backupRequired =>
    {
      if (!backupRequired)
        return;

      let ignoreErrors = error =>
      {
        // Expected error, backup file doesn't exist.
      };

      let renameBackup = index =>
      {
        if (index > 0)
        {
          return IO.renameFile(this.getBackupName(index),
                               this.getBackupName(index + 1))
                   .catch(ignoreErrors)
                   .then(() => renameBackup(index - 1));
        }

        return IO.renameFile(this.sourceFile, this.getBackupName(1))
                 .catch(ignoreErrors);
      };

      // Rename existing files
      return renameBackup(Prefs.patternsbackups - 1);
    }).catch(error =>
    {
      // Errors during backup creation shouldn't prevent writing filters.
      Cu.reportError(error);
    }).then(() =>
    {
      return IO.writeToFile(this.sourceFile, this.exportData());
    }).then(() =>
    {
      filterNotifier.emit("save");
    }).catch(error =>
    {
      // If saving failed, report error but continue - we still have to process
      // flags.
      Cu.reportError(error);
    }).then(() =>
    {
      this._saving = false;
      if (this._needsSave)
      {
        this._needsSave = false;
        this.saveToDisk();
      }
    });
  },

  /**
   * @typedef FileInfo
   * @type {object}
   * @property {number} index
   * @property {number} lastModified
   */

  /**
   * Returns a promise resolving in a list of existing backup files.
   * @return {Promise.<FileInfo[]>}
   */
  getBackupFiles()
  {
    let backups = [];

    let checkBackupFile = index =>
    {
      return IO.statFile(this.getBackupName(index)).then(statData =>
      {
        if (!statData.exists)
          return backups;

        backups.push({
          index,
          lastModified: statData.lastModified
        });
        return checkBackupFile(index + 1);
      }).catch(error =>
      {
        // Something went wrong, return whatever data we got so far.
        Cu.reportError(error);
        return backups;
      });
    };

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
  if (!FilterStorage.knownSubscriptions.has(subscription.url))
    return;

  for (let filter of subscription.filters)
    filter.addSubscription(subscription);
}

/**
 * Removes subscription's filters from the subscription without any
 * notifications.
 * @param {Subscription} subscription filter subscription to be removed
 */
function removeSubscriptionFilters(subscription)
{
  if (!FilterStorage.knownSubscriptions.has(subscription.url))
    return;

  for (let filter of subscription.filters)
    filter.removeSubscription(subscription);
}
