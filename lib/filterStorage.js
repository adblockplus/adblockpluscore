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
 * @fileOverview <code>filterStorage</code> object responsible for managing the
 * user's subscriptions and filters.
 */

const {IO} = require("io");
const {Prefs} = require("prefs");
const {Utils} = require("utils");
const {Filter, ActiveFilter} = require("./filterClasses");
const {Subscription, SpecialSubscription,
       ExternalSubscription} = require("./subscriptionClasses");
const {filterNotifier} = require("./filterNotifier");
const {INIParser} = require("./iniParser");

/**
 * Version number of the filter storage file format.
 * @type {number}
 */
const FORMAT_VERSION = 5;

/**
 * {@link filterStorage} implementation.
 */
class FilterStorage
{
  /**
   * @hideconstructor
   */
  constructor()
  {
    /**
     * Will be set to true after the initial {@link FilterStorage#loadFromDisk}
     * call completes.
     * @type {boolean}
     */
    this.initialized = false;

    /**
     * Will be set to <code>true</code> if no <code>patterns.ini</code> file
     * exists.
     * @type {boolean}
     */
    this.firstRun = false;

    /**
     * Map of properties listed in the filter storage file before the sections
     * start. Right now this should be only the format version.
     * @type {object}
     */
    this.fileProperties = Object.create(null);

    /**
     * Map of subscriptions already on the list, by their URL/identifier.
     * @type {Map.<string,Subscription>}
     */
    this.knownSubscriptions = new Map();

    /**
     * Will be set to true if {@link FilterStorage#saveToDisk} is running
     * (reentrance protection).
     * @type {boolean}
     * @private
     */
    this._saving = false;

    /**
     * Will be set to true if a {@link FilterStorage#saveToDisk} call arrives
     * while {@link FilterStorage#saveToDisk} is already running (delayed
     * execution).
     * @type {boolean}
     * @private
     */
    this._needsSave = false;
  }

  /**
   * The version number of the <code>patterns.ini</code> format used.
   * @type {number}
   */
  get formatVersion()
  {
    return FORMAT_VERSION;
  }

  /**
   * The file containing the subscriptions.
   * @type {string}
   */
  get sourceFile()
  {
    return "patterns.ini";
  }

  /**
   * Yields subscriptions in the storage.
   * @param {?string} [filterText] The filter text for which to look. If
   *   specified, the function yields only those subscriptions that contain the
   *   given filter text. By default the function yields all subscriptions.
   * @yields {Subscription}
   */
  *subscriptions(filterText = null)
  {
    if (filterText == null)
    {
      yield* this.knownSubscriptions.values();
    }
    else
    {
      for (let subscription of this.knownSubscriptions.values())
      {
        if (subscription.hasFilterText(filterText))
          yield subscription;
      }
    }
  }

  /**
   * Returns the number of subscriptions in the storage.
   * @param {?string} [filterText] The filter text for which to look. If
   *   specified, the function counts only those subscriptions that contain the
   *   given filter text. By default the function counts all subscriptions.
   * @returns {number}
   */
  getSubscriptionCount(filterText = null)
  {
    if (filterText == null)
      return this.knownSubscriptions.size;

    let count = 0;
    for (let subscription of this.knownSubscriptions.values())
    {
      if (subscription.hasFilterText(filterText))
        count++;
    }
    return count;
  }

  /**
   * Finds the filter group that a filter should be added to by default. Will
   * return <code>null</code> if this group doesn't exist yet.
   * @param {Filter} filter
   * @returns {?SpecialSubscription}
   */
  getGroupForFilter(filter)
  {
    let generalSubscription = null;
    for (let subscription of this.knownSubscriptions.values())
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
  }

  /**
   * Adds a subscription to the storage.
   * @param {Subscription} subscription The subscription to be added.
   */
  addSubscription(subscription)
  {
    if (this.knownSubscriptions.has(subscription.url))
      return;

    this.knownSubscriptions.set(subscription.url, subscription);

    filterNotifier.emit("subscription.added", subscription);
  }

  /**
   * Removes a subscription from the storage.
   * @param {Subscription} subscription The subscription to be removed.
   */
  removeSubscription(subscription)
  {
    if (!this.knownSubscriptions.has(subscription.url))
      return;

    this.knownSubscriptions.delete(subscription.url);

    // This should be the last remaining reference to the Subscription
    // object.
    Subscription.knownSubscriptions.delete(subscription.url);

    filterNotifier.emit("subscription.removed", subscription);
  }

  /**
   * Replaces the list of filters in a subscription with a new list.
   * @param {Subscription} subscription The subscription to be updated.
   * @param {Array.<string>} filterText The new filter text.
   */
  updateSubscriptionFilters(subscription, filterText)
  {
    filterNotifier.emit("subscription.updated", subscription,
                        subscription.updateFilterText(filterText));
  }

  /**
   * Adds a user-defined filter to the storage.
   * @param {Filter} filter
   * @param {?SpecialSubscription} [subscription] The subscription that the
   *   filter should be added to.
   * @param {number} [position] The position within the subscription at which
   *   the filter should be added. If not specified, the filter is added at the
   *   end of the subscription.
   */
  addFilter(filter, subscription, position)
  {
    if (!subscription)
    {
      for (let currentSubscription of this.subscriptions(filter.text))
      {
        if (currentSubscription instanceof SpecialSubscription &&
            !currentSubscription.disabled)
        {
          return;   // No need to add
        }
      }
      subscription = this.getGroupForFilter(filter);
    }
    if (!subscription)
    {
      // No group for this filter exists, create one
      subscription = SpecialSubscription.createForFilter(filter);
      this.addSubscription(subscription);
      return;
    }

    if (typeof position == "undefined")
      position = subscription.filterCount;

    subscription.insertFilterAt(filter, position);
    filterNotifier.emit("filter.added", filter, subscription, position);
  }

  /**
   * Removes a user-defined filter from the storage.
   * @param {Filter} filter
   * @param {?SpecialSubscription} [subscription] The subscription that the
   *   filter should be removed from. If not specified, the filter will be
   *   removed from all subscriptions.
   * @param {number} [position] The position within the subscription at which
   *   the filter should be removed. If not specified, all instances of the
   *   filter will be removed.
   */
  removeFilter(filter, subscription, position)
  {
    let subscriptions = (
      subscription ? [subscription] : this.subscriptions(filter.text)
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
            index = currentSubscription.findFilterIndex(filter, index + 1);
            if (index >= 0)
              positions.push(index);
          } while (index >= 0);
        }
        else
          positions.push(position);

        for (let j = positions.length - 1; j >= 0; j--)
        {
          let currentPosition = positions[j];
          let currentFilterText =
            currentSubscription.filterTextAt(currentPosition);
          if (currentFilterText && currentFilterText == filter.text)
          {
            currentSubscription.deleteFilterAt(currentPosition);
            filterNotifier.emit("filter.removed", filter, currentSubscription,
                                currentPosition);
          }
        }
      }
    }
  }

  /**
   * Moves a user-defined filter to a new position.
   * @param {Filter} filter
   * @param {SpecialSubscription} subscription The subscription where the
   *   filter is located.
   * @param {number} oldPosition The current position of the filter.
   * @param {number} newPosition The new position of the filter.
   */
  moveFilter(filter, subscription, oldPosition, newPosition)
  {
    if (!(subscription instanceof SpecialSubscription))
      return;

    let currentFilterText = subscription.filterTextAt(oldPosition);
    if (!currentFilterText || currentFilterText != filter.text)
      return;

    newPosition = Math.min(Math.max(newPosition, 0),
                           subscription.filterCount - 1);
    if (oldPosition == newPosition)
      return;

    subscription.deleteFilterAt(oldPosition);
    subscription.insertFilterAt(filter, newPosition);
    filterNotifier.emit("filter.moved", filter, subscription, oldPosition,
                        newPosition);
  }

  /**
   * Increases the hit count for a filter by one.
   * @param {Filter} filter
   */
  increaseHitCount(filter)
  {
    if (!Prefs.savestats || !(filter instanceof ActiveFilter))
      return;

    filter.hitCount++;
    filter.lastHit = Date.now();
  }

  /**
   * Resets hit count for some filters.
   * @param {?Array.<Filter>} [filters] The filters to be reset. If not
   *   specified, all filters will be reset.
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
  }

  /**
   * @callback TextSink
   * @param {string?} line
   */

  /**
   * Allows importing previously serialized filter data.
   * @param {boolean} silent If <code>true</code>, no "load" notification will
   *   be sent out.
   * @returns {TextSink} The function to be called for each line of data.
   *   Calling it with <code>null</code> as the argument finalizes the import
   *   and replaces existing data. No changes will be applied before
   *   finalization, so import can be "aborted" by forgetting this callback.
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
  }

  /**
   * Loads all subscriptions from disk.
   * @returns {Promise} A promise resolved or rejected when loading is complete.
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
      Utils.logError(error);
      return tryBackup(1);
    }).then(() =>
    {
      this.initialized = true;
      filterNotifier.emit("load");
    });
  }

  /**
   * Constructs the file name for a <code>patterns.ini</code> backup.
   * @param {number} backupIndex Number of the backup file (1 being the most
   *   recent).
   * @returns {string} Backup file name.
   */
  getBackupName(backupIndex)
  {
    let [name, extension] = this.sourceFile.split(".", 2);
    return (name + "-backup" + backupIndex + "." + extension);
  }

  /**
   * Restores an automatically created backup.
   * @param {number} backupIndex Number of the backup to restore (1 being the
   *   most recent).
   * @param {boolean} silent If <code>true</code>, no "load" notification will
   *   be sent out.
   * @returns {Promise} A promise resolved or rejected when restoration is
   *   complete.
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
  }

  /**
   * Generator serializing filter data and yielding it line by line.
   * @yields {string}
   */
  *exportData()
  {
    // Do not persist external subscriptions
    let subscriptions = [];
    for (let subscription of this.subscriptions())
    {
      if (!(subscription instanceof ExternalSubscription) &&
          !(subscription instanceof SpecialSubscription &&
            subscription.filterCount == 0))
      {
        subscriptions.push(subscription);
      }
    }

    yield "# Adblock Plus preferences";
    yield "version=" + this.formatVersion;

    let saved = new Set();

    // Save subscriptions
    for (let subscription of subscriptions)
    {
      yield* subscription.serialize();
      yield* subscription.serializeFilters();
    }

    // Save filter data
    for (let subscription of subscriptions)
    {
      for (let text of subscription.filterText())
      {
        if (!saved.has(text))
        {
          yield* Filter.fromText(text).serialize();
          saved.add(text);
        }
      }
    }
  }

  /**
   * Saves all subscriptions back to disk.
   * @returns {Promise} A promise resolved or rejected when saving is complete.
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
      Utils.logError(error);
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
      Utils.logError(error);
    }).then(() =>
    {
      this._saving = false;
      if (this._needsSave)
      {
        this._needsSave = false;
        this.saveToDisk();
      }
    });
  }

  /**
   * @typedef FileInfo
   * @type {object}
   * @property {number} index
   * @property {number} lastModified
   */

  /**
   * Returns a promise resolving in a list of existing backup files.
   * @returns {Promise.<Array.<FileInfo>>}
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
        Utils.logError(error);
        return backups;
      });
    };

    return checkBackupFile(1);
  }
}

/**
 * Reads the user's filters from disk, manages them in memory, and writes them
 * back to disk.
 */
let filterStorage = new FilterStorage();

exports.filterStorage = filterStorage;
