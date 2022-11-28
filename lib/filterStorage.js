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

/** @module */

"use strict";

/**
 * @file `filterStorage` object responsible for managing the user's
 * subscriptions and filters.
 */

const {IO} = require("io");
const {Prefs} = require("prefs");
const {isActiveFilter} = require("./filterClasses");
const {Subscription, SpecialSubscription} = require("./subscriptionClasses");
const {filterNotifier} = require("./filterNotifier");
const {INIParser} = require("./iniParser");
const {FilterState} = require("./filterState");
const {Synchronizer} = require("./synchronizer");
const {Features} = require("./features");

/**
 * The Error type returned by filter storage.
 *
 * @property {Object} detail Contains information about the error.
 * @property {string} [detail.text] The text of the filter for
     `filter_not_found`.
 * @property {Array.<string>} [detail.exist] The list of duplicate
 *   filters.
 */
class FilterStorageError extends Error {
  /** Construct a FilterParsingError
   * @constructor
   * @param {string} message The error message.
   * @param {Object} detail The `FilterStorageError` detail.
   */
  constructor(message, detail) {
    super(message);
    this.detail = detail;
  }
}

exports.FilterStorageError = FilterStorageError;

/**
 * @typedef {Object} Stats
 * @property {boolean} exists
 * @property {number} lastModified
 */

/**
 * A cache for all source files and backup stats.
 * @type {Map<string, Stats>}
 * @private
 */
let stats = new Map();

/**
 * An asynchronous guard for multiple backups renmaing operations. It gets
 * reassigned to a new Promise that rename all backups one more time.
 * @type {Promise<void>}
 * @private
 */
let backupQueue = Promise.resolve();

/**
 * Version number of the filter storage file format.
 * @type {number}
 */
const FORMAT_VERSION = 5;

/**
 * Reads the user's filters from disk, manages them in memory, and writes them
 * back to disk.
 */
class FilterStorage {
  /**
   * @typedef FilterStorageOptions
   * @type {object}
   * @property {?module:features.Features} features Enable specific features
   */
  /**
   * Construct a FilterStorage
   *
   * @param {?FilterStorageOptions} options The options to create the storage.
   */
  constructor(options) {
    /**
     * Will be set to `true` after the initial
     * `{@link module:filterStorage.FilterStorage#loadFromDisk loadFromDisk()}`
     * call completes.
     * @type {boolean}
     */
    this.initialized = false;

    /**
     * Will be set to `true` if no `patterns.ini` file exists.
     * @type {boolean}
     */
    this.firstRun = false;

    /** Activated features
     * @type {Features}
     */
    this.features = options ? options.features : Features.DEFAULT;
    Subscription.dnr = (this.features & Features.DNR) != 0;

    /**
     * Map of properties listed in the filter storage file before the sections
     * start. Right now this should be only the format version.
     * @type {Object}
     */
    this.fileProperties = Object.create(null);

    /**
     * Map of subscriptions already on the list, by their URL/identifier.
     * @type {Map.<string,module:subscriptionClasses.Subscription>}
     * @private
     */
    this._knownSubscriptions = new Map();

    /**
     * Map of subscriptions with metadata, by their URL/identifier.
     *
     * It can be used to answer "which subscriptions have metadata?".
     * @type {Map.<string,module:subscriptionClasses.Subscription>}
     * @private
     */
    this._metadataSubscriptions = new Map();

    /**
     * Will be set to `true` if
     * `{@link module:filterStorage.FilterStorage#saveToDisk saveToDisk()}`
     * is running (reentrance protection).
     * @type {boolean}
     * @private
     */
    this._saving = false;

    /**
     * Will be set to `true` if a
     * `{@link module:filterStorage.FilterStorage#saveToDisk saveToDisk()}`
     * call arrives while
     * `{@link module:filterStorage.FilterStorage#saveToDisk saveToDisk()}`
     * is already running (delayed execution).
     * @type {boolean}
     * @private
     */
    this._needsSave = false;

    /**
     * This property is for testing purpose only and it should never be used
     * directly via code.
     * @type {Map<string, Stats>}
     * @private
     */
    this._stats = stats;

    this.synchronizer = new Synchronizer(this);
    this.filterState = new FilterState();
  }

  /**
   * The version number of the `patterns.ini` format used.
   * @type {number}
   */
  get formatVersion() {
    return FORMAT_VERSION;
  }

  /**
   * The file containing the subscriptions.
   * @type {string}
   */
  static get sourceFile() {
    return "patterns.ini";
  }

  /**
   * Yields subscriptions in the storage.
   * @param {?string} [filterText] The filter text for which to look. If
   *   specified, the function yields only those subscriptions that contain the
   *   given filter text. By default the function yields all subscriptions.
   * @yields {module:subscriptionClasses.Subscription}
   */
  *subscriptions(filterText = null) {
    if (filterText == null) {
      yield* this._knownSubscriptions.values();
    }
    else {
      for (let subscription of this._knownSubscriptions.values()) {
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
  getSubscriptionCount(filterText = null) {
    if (filterText == null)
      return this._knownSubscriptions.size;

    let count = 0;
    for (let subscription of this._knownSubscriptions.values()) {
      if (subscription.hasFilterText(filterText))
        count++;
    }
    return count;
  }

  /**
   * Finds the filter group that a filter should be added to by default. Will
   * return `null` if this group doesn't exist yet.
   * @param {Filter} filter
   * @returns {?module:subscriptionClasses.SpecialSubscription}
   */
  getGroupForFilter(filter) {
    let generalSubscription = null;
    for (let subscription of this._knownSubscriptions.values()) {
      // We ignore disabled subscriptions and subscriptions
      // without metadata
      if (
        subscription instanceof SpecialSubscription &&
        !subscription.disabled && !subscription.metadata
      ) {
        // Always prefer specialized subscriptions
        if (subscription.isDefaultFor(filter))
          return subscription;

        // If this is a general subscription - store it as fallback
        if (!generalSubscription &&
            (!subscription.defaults || !subscription.defaults.length))
          generalSubscription = subscription;
      }
    }
    return generalSubscription;
  }

  /**
   * Checks whether a given subscription is in the storage.
   * @param {module:subscriptionClasses.Subscription|string} subscription
   *   or the URL of the subscription.
   * @returns {boolean}
   */
  hasSubscription(subscription) {
    if (typeof subscription == "string")
      return this._knownSubscriptions.has(subscription);

    return this._knownSubscriptions.has(subscription.url);
  }

  /**
   * Get the the subscription from the storage.
   * @param {string} subscription The URL of the subscription.
   * @returns {module:subscriptionClasses.Subscription}
   */
  getSubscription(subscription) {
    return this._knownSubscriptions.get(subscription);
  }

  /**
   * Adds a subscription to the storage.
   * @param {module:subscriptionClasses.Subscription} subscription The
   *   subscription to be added.
   */
  addSubscription(subscription) {
    if (this._knownSubscriptions.has(subscription.url))
      return;

    this._knownSubscriptions.set(subscription.url, subscription);

    filterNotifier.emit("subscription.added", subscription);
  }

  /**
   * Removes a subscription from the storage.
   * @param {module:subscriptionClasses.Subscription} subscription The
   *   subscription to be removed.
   */
  removeSubscription(subscription) {
    if (!this._knownSubscriptions.has(subscription.url))
      return;

    this._knownSubscriptions.delete(subscription.url);
    this._metadataSubscriptions.delete(subscription.url);

    // This should be the last remaining reference to the Subscription
    // object.
    Subscription.knownSubscriptions.delete(subscription.url);

    filterNotifier.emit("subscription.removed", subscription);
  }

  /**
   * Replaces the list of filters in a subscription with a new list.
   * @param {module:subscriptionClasses.Subscription} subscription The
   *   subscription to be updated.
   * @param {Array.<string>} filterText The new filter text.
   */
  updateSubscriptionFilters(subscription, filterText) {
    filterNotifier.emit(
      "subscription.updated",
      subscription,
      subscription.updateFilterText(filterText)
    );
  }

  /**
   * Check the filters pass and return the list of the filters that exist.
   *
   * @param {Array.<Filter>} filters The filters to check.
   * @return {Array.<Filter>} The list of filters that exists. An empty
   *   list mean that none do exist.
   */
  filtersExist(filters) {
    let exist = [];

    for (let filter of filters) {
      for (let currentSubscription of this._knownSubscriptions.values()) {
        if (currentSubscription instanceof SpecialSubscription &&
            !currentSubscription.disabled &&
            currentSubscription.hasFilterText(filter.text))
          exist.push(filter);
      }
    }

    return exist;
  }

  /**
   * Adds user-defined filters to the storage with metadata.
   *
   * @async
   * @param {Filter|Array<Filter>} filters Filter(s) to add. If the list
   *   contains duplicate entries, they'll be skipped.
   * @param {Object} metadata The metadata block.
   *
   * @return {Promise<module:subscriptionClasses.SpecialSubscription>} the
   *   subscription the filter is in, or throw an error if any of the filter
   *   is already present in a `SpecialSubscription`.
   */
  async addFiltersWithMetadata(filters, metadata) {
    let list = Array.isArray(filters) ? filters : [filters];

    let exist = this.filtersExist(list);
    if (exist.length != 0)
      throw new FilterStorageError("storage_duplicate_filters", {exist});

    let subscription = null;

    for (let filter of list) {
      if (!subscription)
        subscription = SpecialSubscription.createForFilter(filter);
      // We make sure we don't have a duplicate already from `filters`.
      else if (!subscription.hasFilterText(filter.text))
        subscription.addFilter(filter);
    }

    this._metadataSubscriptions.set(subscription.url, subscription);
    this.addSubscription(subscription);

    subscription.metadata = metadata;

    return subscription;
  }

  /**
   * Get the metadata for a filter.
   *
   * @async
   * @param {string} text The filter text.
   * @return {Promise<Object>} The metadata if any found.
   *
   * This function will iterate through all the subscriptions with metadata
   * to find a `SpecialSubscription` that contains the filter text.
   */
  async getMetadataForFilter(text) {
    for (let currentSubscription of this._metadataSubscriptions.values()) {
      if (currentSubscription.hasFilterText(text))
        return currentSubscription.metadata;
    }

    throw new FilterStorageError("filter_not_found", {text});
  }

  /**
   * Set the metadata for a filter that already has metadata.
   *
   * A filter can have metadata only if it was added using
   * `addFiltersWithMetadata()`. It is currently not possible to add metadata
   * to an existing custom filter that was added with `addFilter()`. In that
   * case, the function will return a `filter_not_found` error.
   *
   * @async
   * @param {string} text The filter text.
   * @param {Object} metadata The metadata.
   *
   * @return {Promise<module:subscriptionClasses.SpecialSubscription>} The
   *   subscription whose metadata was changed.
   */
  async setMetadataForFilter(text, metadata) {
    for (let currentSubscription of this._metadataSubscriptions.values()) {
      if (currentSubscription.hasFilterText(text)) {
        currentSubscription.metadata = metadata;
        return currentSubscription;
      }
    }

    throw new FilterStorageError("filter_not_found", {text});
  }

  /**
   * Adds a user-defined filter to the storage.
   *
   * @async
   * @param {Filter} filter
   * @param {?module:subscriptionClasses.SpecialSubscription} [subscription]
   *   The subscription that the filter should be added to.
   * @param {number} [position] The position within the subscription at which
   *   the filter should be added. If not specified, the filter is added at the
   *   end of the subscription.
   *
   * @return {Promise<module:subscriptionClasses.SpecialSubscription>} The
   *   subscription the filter is in. Either existing or added.
   */
  async addFilter(filter, subscription, position) {
    if (!subscription) {
      for (let currentSubscription of this._knownSubscriptions.values()) {
        if (currentSubscription instanceof SpecialSubscription &&
            !currentSubscription.disabled &&
            currentSubscription.hasFilterText(filter.text)) {
          throw new FilterStorageError("storage_duplicate_filters",
                                       {exist: [filter]});  // No need to add
        }
      }
      subscription = this.getGroupForFilter(filter);
    }
    if (!subscription) {
      // No group for this filter exists, create one
      subscription = SpecialSubscription.createForFilter(filter);
      this.addSubscription(subscription);
      return subscription;
    }

    if (typeof position == "undefined")
      position = subscription.filterCount;

    subscription.insertFilterAt(filter, position);
    filterNotifier.emit("filter.added", filter, subscription, position);
    return subscription;
  }

  /**
   * Removes a user-defined filter from the storage.
   * @param {module:filterClasses.Filter} filter
   * @param {?module:subscriptionClasses.SpecialSubscription} [subscription]
   *   The subscription that the filter should be removed from. If not
   *   specified, the filter will be removed from all subscriptions.
   * @param {number} [position] The position within the subscription at which
   *   the filter should be removed. If not specified, all instances of the
   *   filter will be removed.
   */
  removeFilter(filter, subscription, position) {
    let subscriptions = (
      subscription ? [subscription] : this._knownSubscriptions.values()
    );
    for (let currentSubscription of subscriptions) {
      if (currentSubscription instanceof SpecialSubscription &&
          (currentSubscription == subscription ||
           currentSubscription.hasFilterText(filter.text))) {
        let positions = [];
        if (typeof position == "undefined") {
          let index = -1;
          do {
            index = currentSubscription.findFilterIndex(filter, index + 1);
            if (index >= 0)
              positions.push(index);
          } while (index >= 0);
        }
        else {
          positions.push(position);
        }

        for (let j = positions.length - 1; j >= 0; j--) {
          let currentPosition = positions[j];
          let currentFilterText =
            currentSubscription.filterTextAt(currentPosition);
          if (currentFilterText && currentFilterText == filter.text) {
            currentSubscription.deleteFilterAt(currentPosition);
            filterNotifier.emit(
              "filter.removed", filter, currentSubscription, currentPosition
            );
          }
        }
      }
    }
  }

  /**
   * Moves a user-defined filter to a new position.
   * @param {module:filterClasses.Filter} filter
   * @param {module:subscriptionClasses.SpecialSubscription} subscription The
   *   subscription where the filter is located.
   * @param {number} oldPosition The current position of the filter.
   * @param {number} newPosition The new position of the filter.
   */
  moveFilter(filter, subscription, oldPosition, newPosition) {
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
    filterNotifier.emit(
      "filter.moved", filter, subscription, oldPosition, newPosition
    );
  }

  /**
   * Increases the hit count for a filter by one.
   * @param {Filter} filter
   */
  increaseHitCount(filter) {
    if (!Prefs.savestats || !isActiveFilter(filter))
      return;

    this.filterState.registerHit(filter.text);
  }

  /**
   * Resets hit count for some filters.
   * @param {?Array.<Filter>} [filters] The filters to be reset. If not
   *   specified, all filters will be reset.
   */
  resetHitCounts(filters) {
    if (filters) {
      for (let filter of filters)
        this.filterState.resetHits(filter.text);
    }
    else {
      for (let text of this.filterState.map.keys())
        this.filterState.resetHits(text);
    }
  }

  /**
   * @callback TextSink
   * @param {string?} line
   */

  /**
   * Allows importing previously serialized filter data.
   * @param {boolean} silent If `true`, no "load" notification will be sent
   *   out.
   * @returns {TextSink} The function to be called for each line of data.
   *   Calling it with `null` as the argument finalizes the import and replaces
   *   existing data. No changes will be applied before finalization, so import
   *   can be "aborted" by forgetting this callback.
   * @package
   */
  importData(silent) {
    let parser = new INIParser(this.filterState);
    return line => {
      parser.process(line);
      if (line === null) {
        let knownSubscriptions = new Map();
        let metadataSubscriptions = new Map();
        for (let subscription of parser.subscriptions) {
          // Convert to the new terminology when loading.
          if (Array.isArray(subscription.defaults)) {
            subscription.defaults.forEach((type, i, arr) => {
              if (type == "whitelist")
                arr[i] = "allowing";
            });
          }
          knownSubscriptions.set(subscription.url, subscription);
          if (subscription.metadata)
            metadataSubscriptions.set(subscription.url, subscription);
        }

        this.fileProperties = parser.fileProperties;
        this._knownSubscriptions = knownSubscriptions;
        this._metadataSubscriptions = metadataSubscriptions;

        if (!silent)
          filterNotifier.emit("load");
      }
    };
  }

  /**
   * Loads all subscriptions from disk.
   * @returns {Promise} A promise resolved or rejected when loading is complete.
   * @package
   */
  async loadFromDisk() {
    let tryBackup = async backupIndex => {
      try {
        await this.restoreBackup(backupIndex, true);
      }
      catch (error) {
        // Give up
      }
    };

    try {
      let statData = await statFile(FilterStorage.sourceFile);

      if (!statData.exists) {
        this.firstRun = true;
        return;
      }

      let parser = this.importData(true);
      await IO.readFromFile(FilterStorage.sourceFile, parser);
      parser(null);
    }
    catch (error) {
      console.warn(error);
      await tryBackup(1);
    }

    this.initialized = true;
    filterNotifier.emit("load");
  }

  /**
   * Constructs the file name for a `patterns.ini` backup.
   * @param {number} backupIndex Number of the backup file (1 being the most
   *   recent).
   * @returns {string} Backup file name.
   * @package
   */
  static getBackupName(backupIndex) {
    let [name, extension] = FilterStorage.sourceFile.split(".", 2);
    return (name + "-backup" + backupIndex + "." + extension);
  }

  /**
   * Restores an automatically created backup.
   * @param {number} backupIndex Number of the backup to restore (1 being the
   *   most recent).
   * @param {boolean} silent If `true`, no "load" notification will be sent
   *   out.
   * @returns {Promise} A promise resolved or rejected when restoration is
   *   complete.
   * @package
   */
  async restoreBackup(backupIndex, silent) {
    let backupFile = FilterStorage.getBackupName(backupIndex);
    let parser = this.importData(silent);
    await IO.readFromFile(backupFile, parser);
    parser(null);
    return this.saveToDisk();
  }

  /**
   * Generator serializing filter data and yielding it line by line.
   * @yields {string}
   */
  *exportData() {
    // Do not persist external subscriptions
    let subscriptions = [];
    for (let subscription of this._knownSubscriptions.values()) {
      if (!(subscription instanceof SpecialSubscription &&
            subscription.filterCount == 0))
        subscriptions.push(subscription);
    }

    yield "# Adblock Plus preferences";
    yield "version=" + this.formatVersion;

    let saved = new Set();

    // Save subscriptions
    for (let subscription of subscriptions) {
      yield* subscription.serialize();
      yield* subscription.serializeFilters();
    }

    // Save filter data
    for (let subscription of subscriptions) {
      for (let text of subscription.filterText()) {
        if (!saved.has(text)) {
          yield* this.filterState.serialize(text);
          saved.add(text);
        }
      }
    }
  }

  /**
   * Saves all subscriptions back to disk.
   * @returns {Promise} A promise resolved or rejected when saving is complete.
   * @package
   */
  async saveToDisk() {
    if (this._saving) {
      this._needsSave = true;
      return;
    }

    this._saving = true;

    try {
      let {patternsbackups} = Prefs;
      let isBackupRequired = async() => {
        // First check whether we need to create a backup
        if (patternsbackups <= 0)
          return false;

        let statData = await statFile(FilterStorage.sourceFile);
        if (!statData.exists)
          return false;

        let backupStatData = await statFile(FilterStorage.getBackupName(1));
        if (backupStatData.exists &&
            (Date.now() - backupStatData.lastModified) / 3600000 <
              Prefs.patternsbackupinterval)
          return false;

        return true;
      };

      if (await isBackupRequired()) {
        try {
          // if patternsbackups is 1 just create it, otherwise create a
          // backup-0 that will be shifted among others later on
          let i = patternsbackups > 1 ? 0 : 1;
          await renameFile(
            FilterStorage.sourceFile, FilterStorage.getBackupName(i)
          );

          // if there is more than a backup, backup-0 up to backup-X need to be
          // renamed but without blocking this callback
          if (patternsbackups > 1) {
            // keep queueing backups as these come, considering backup1 and
            // backup 0 are always safe thanks to the this._saving flag
            backupQueue = backupQueue.then(() => new Promise(resolve => {
              let renameAll = async index => {
                if (index > 0) {
                  try {
                    let source = FilterStorage.getBackupName(index - 1);
                    let dest = FilterStorage.getBackupName(index);
                    await renameFile(source, dest);
                  }
                  catch (error) {
                    // Expected error, backup file doesn't exist.
                  }
                  renameAll(index - 1);
                }
                else {
                  resolve();
                }
              };
              renameAll(patternsbackups);
            }));
          }
        }
        catch (error) {
          // This is actually an unexpected error that could happen only if
          // the disk had issues in renaming the source file.
          console.warn(error);
        }
      }
    }
    catch (error) {
      // Errors during backup creation shouldn't prevent writing filters.
      console.warn(error);
    }

    try {
      await IO.writeToFile(FilterStorage.sourceFile, this.exportData());
      stats.set(
        FilterStorage.sourceFile, {exists: true, lastModified: Date.now()}
      );
      filterNotifier.emit("save");
    }
    catch (error) {
      // If saving failed, report error but continue - we still have to process
      // flags.
      console.warn(error);
      stats.delete(FilterStorage.sourceFile);
    }

    this._saving = false;
    if (this._needsSave) {
      this._needsSave = false;
      this.saveToDisk();
    }
  }

  /**
   * @typedef {Object} FileInfo
   * @property {number} index
   * @property {number} lastModified
   */

  /**
   * Returns a promise resolving in a list of existing backup files.
   * @returns {Promise.<Array.<FileInfo>>}
   * @package
   */
  async getBackupFiles() {
    let backups = [];

    let checkBackupFile = async index => {
      try {
        let statData = await statFile(FilterStorage.getBackupName(index));
        if (!statData.exists)
          return backups;

        backups.push({
          index,
          lastModified: statData.lastModified
        });

        return checkBackupFile(index + 1);
      }
      catch (error) {
        // Something went wrong, return whatever data we got so far.
        console.warn(error);
        return backups;
      }
    };

    return checkBackupFile(1);
  }
}

exports.FilterStorage = FilterStorage;

/**
 * Given a path, return its stats, if known, or a Stats object with properties
 * exists = false and lastModified = 0.
 * @param {string} path
 * @returns {Stats}
 */
async function statFile(path) {
  let known = stats.get(path);
  if (known)
    return known;

  try {
    known = await IO.statFile(path);
  }
  catch (error) {
    known = {exists: false, lastModified: 0};
  }
  stats.set(path, known);
  return known;
}

/**
 * Given a source path and a destination path, tries to rename the source and,
 * if it succeed, remove the source from the stats and set stats for dest.
 * @param {string} source
 * @param {string} dest
 */
async function renameFile(source, dest) {
  await IO.renameFile(source, dest);
  stats.delete(source);
  stats.set(dest, {exists: true, lastModified: Date.now()});
}
