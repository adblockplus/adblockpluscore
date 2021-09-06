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
 * @fileOverview Manages synchronization of filter subscriptions.
 */

const {Prefs} = require("prefs");

const {MILLIS_IN_SECOND, MILLIS_IN_MINUTE, MILLIS_IN_HOUR,
       MILLIS_IN_DAY} = require("./time");
const {Downloadable, Downloader} = require("./downloader");
const {filterStorage} = require("./filterStorage");
const {filterNotifier} = require("./filterNotifier");
const {Subscription,
       DownloadableSubscription} = require("./subscriptionClasses");
const {analytics} = require("./analytics");
const {TimeoutScheduler} = require("./scheduler");
const {fullUpdater} = require("./updater");

const INITIAL_DELAY = 1 * MILLIS_IN_MINUTE;
const CHECK_INTERVAL = 1 * MILLIS_IN_HOUR;
const DEFAULT_EXPIRATION_INTERVAL = 5 * MILLIS_IN_DAY;

/**
 * Downloads filter subscriptions whenever necessary.
 */
class Synchronizer {
  /**
   * @param {object} updater The object providing actual update logic.
   */
  constructor(updater) {
    /**
     * Whether the downloading of subscriptions has been started.
     * @private
     */
    this._started = false;

    /**
     * The object providing actual update logic.
     * (with required methods - see "updater.js")
     * @type {object}
     */
    this._updater = updater;

    /**
     * The object providing actual downloading functionality.
     * @type {module:downloader.Downloader}
     */
    this._downloader = new Downloader(
      this._getDownloadables.bind(this));

    this._downloader.onExpirationChange = this._onExpirationChange.bind(this);
    this._downloader.onDownloadStarted = this._onDownloadStarted.bind(this);
    this._downloader.onDownloadSuccess = this._onDownloadSuccess.bind(this);
    this._downloader.onDownloadError = this._onDownloadError.bind(this);

    // default impl
    this.setScheduler(new TimeoutScheduler());
  }

  /**
   * Starts downloading subscriptions.
   *
   * No subscriptions are downloaded until this function has been called at
   * least once.
   */
  start() {
    if (this._started)
      return;

    this._scheduler.start(CHECK_INTERVAL, INITIAL_DELAY);
    this._started = true;
  }

  /**
   * Clear any further downloader scheduled check and set its internal state
   * as not started.
   */
  stop() {
    this._started = false;
    this._scheduler.stop();
  }

  /**
   * Set a scheduler for the downloader
   * @param {objec} scheduler
   *   The object with required methods (see "scheduler.js")
   */
  setScheduler(scheduler) {
    this._scheduler = scheduler;
    this._scheduler.setCallback(
      this._downloader.onSchedule.bind(this._downloader));
  }

  /**
   * Checks whether a subscription is currently being downloaded.
   * @param {string} url  URL of the subscription
   * @returns {boolean}
   */
  isExecuting(url) {
    return this._downloader.isDownloading(url);
  }

  /**
   * Starts the download of a subscription.
   * @param {module:subscriptionClasses.DownloadableSubscription} subscription
   *   Subscription to be downloaded
   * @param {boolean} manual
   *   `true` for a manually started download (should not trigger fallback
   *   requests)
   */
  execute(subscription, manual) {
    this._downloader.download(this._getDownloadable(subscription, manual));
  }

  /**
   * Yields `{@link module:downloader.Downloadable Downloadable}` instances for
   * all subscriptions that can be downloaded.
   * @yields {module:downloader.Downloadable}
   */
  *_getDownloadables() {
    if (!Prefs.subscriptions_autoupdate)
      return;

    for (let subscription of filterStorage.subscriptions()) {
      if (subscription instanceof DownloadableSubscription)
        yield this._getDownloadable(subscription, false);
    }
  }

  /**
   * Creates a `{@link module:downloader.Downloadable Downloadable}` instance
   * for a subscription.
   * @param {module:subscriptionClasses.Subscription} subscription
   * @param {boolean} manual
   * @returns {module:downloader.Downloadable}
   */
  _getDownloadable(subscription, manual) {
    let {url, lastDownload, lastSuccess, lastCheck, version, bundledVersion,
         softExpiration, expires, downloadCount, disabled} = subscription;

    let result = new Downloadable(url);

    if (analytics.isTrusted(url))
      result.firstVersion = analytics.getFirstVersion();

    if (lastDownload != lastSuccess)
      result.lastError = lastDownload * MILLIS_IN_SECOND;

    result.lastCheck = lastCheck * MILLIS_IN_SECOND;
    result.lastVersion = version;
    result.bundledVersion = bundledVersion;
    result.softExpiration = softExpiration * MILLIS_IN_SECOND;
    result.hardExpiration = expires * MILLIS_IN_SECOND;
    result.manual = manual;
    result.downloadCount = downloadCount;
    if (disabled)
      result.method = "HEAD";

    return result;
  }

  _onExpirationChange(downloadable) {
    let subscription = Subscription.fromURL(downloadable.url);
    subscription.lastCheck = Math.round(
      downloadable.lastCheck / MILLIS_IN_SECOND
    );
    subscription.softExpiration = Math.round(
      downloadable.softExpiration / MILLIS_IN_SECOND
    );
    subscription.expires = Math.round(
      downloadable.hardExpiration / MILLIS_IN_SECOND
    );
  }

  _onDownloadStarted(downloadable) {
    let subscription = Subscription.fromURL(downloadable.url);
    filterNotifier.emit("subscription.downloading", subscription);
    subscription.mark("downloading.started");
  }

  _onDownloadSuccess(downloadable, responseText, errorCallback,
                     redirectCallback) {
    let subscription = Subscription.fromURL(downloadable.redirectURL ||
                                            downloadable.url);
    subscription.mark("downloading.finished");
    subscription.mark("parsing.started");

    let isHEAD = downloadable.method === "HEAD";

    let {error, lines, params,
         minVersion} = isHEAD ? {params: {}} :
         this._updater.parseFilters(responseText);

    if (error)
      return errorCallback(error);

    if (params.redirect)
      return redirectCallback(params.redirect);

    subscription.mark("parsing.finished");

    // Handle redirects
    if (downloadable.redirectURL &&
        downloadable.redirectURL != downloadable.url) {
      let oldSubscription = Subscription.fromURL(downloadable.url);
      subscription.title = oldSubscription.title;
      subscription.disabled = oldSubscription.disabled;
      subscription.lastCheck = oldSubscription.lastCheck;

      let listed = filterStorage.hasSubscription(oldSubscription);
      if (listed)
        filterStorage.removeSubscription(oldSubscription);

      Subscription.knownSubscriptions.delete(oldSubscription.url);

      if (listed)
        filterStorage.addSubscription(subscription);
    }

    // The download actually succeeded
    subscription.lastSuccess = subscription.lastDownload = Math.round(
      Date.now() / MILLIS_IN_SECOND
    );
    subscription.downloadStatus = "synchronize_ok";
    subscription.downloadCount = downloadable.downloadCount;
    subscription.errors = 0;

    // Process parameters
    if (params.homepage) {
      let url;
      try {
        url = new URL(params.homepage);
      }
      catch (e) {
        url = null;
      }

      if (url && (url.protocol == "http:" || url.protocol == "https:"))
        subscription.homepage = url.href;
    }

    if (params.title) {
      subscription.title = params.title;
      subscription.fixedTitle = true;
    }
    else {
      subscription.fixedTitle = false;
    }

    if (params.version) {
      subscription.version = parseInt(params.version, 10);

      if (analytics.isTrusted(downloadable.redirectURL || downloadable.url))
        analytics.recordVersion(params.version);
    }
    else {
      subscription.version = isHEAD ? downloadable.lastVersion : 0;
    }

    if (subscription.type)
      subscription.abtest = params.abtest;

    let expirationInterval = isHEAD ?
      MILLIS_IN_DAY : DEFAULT_EXPIRATION_INTERVAL;
    if (params.expires) {
      let match = /^(\d+)\s*(h)?/.exec(params.expires);
      if (match) {
        let interval = parseInt(match[1], 10);
        if (match[2])
          expirationInterval = interval * MILLIS_IN_HOUR;
        else
          expirationInterval = interval * MILLIS_IN_DAY;
      }
    }

    let [
      softExpiration,
      hardExpiration
    ] = this._downloader.processExpirationInterval(expirationInterval);
    subscription.softExpiration = Math.round(softExpiration / MILLIS_IN_SECOND);
    subscription.expires = Math.round(hardExpiration / MILLIS_IN_SECOND);

    if (minVersion)
      subscription.requiredVersion = minVersion;
    else
      delete subscription.requiredVersion;

    // In case of HEAD request (disabled subscription) notify an update so that
    // the last version of the subscription will be stored for the next time.
    if (isHEAD)
      filterNotifier.emit("subscription.updated", subscription);
    else
      this._updater.processFilters(subscription, lines);
  }

  _onDownloadError(downloadable, downloadURL, error, responseStatus,
                   redirectCallback) {
    let subscription = Subscription.fromURL(downloadable.url);
    subscription.mark("downloading.finished");
    subscription.lastDownload = Math.round(Date.now() / MILLIS_IN_SECOND);
    subscription.downloadStatus = error;

    // Request fallback URL if necessary - for automatic updates only
    if (!downloadable.manual) {
      subscription.errors++;

      if (redirectCallback &&
          subscription.errors >= Prefs.subscriptions_fallbackerrors &&
          /^https?:\/\//i.test(subscription.url)) {
        subscription.errors = 0;

        let fallbackURL = Prefs.subscriptions_fallbackurl;
        const {addonVersion} = require("info");
        fallbackURL = fallbackURL.replace(/%VERSION%/g,
                                          encodeURIComponent(addonVersion));
        fallbackURL = fallbackURL.replace(/%SUBSCRIPTION%/g,
                                          encodeURIComponent(subscription.url));
        fallbackURL = fallbackURL.replace(/%URL%/g,
                                          encodeURIComponent(downloadURL));
        fallbackURL = fallbackURL.replace(/%ERROR%/g,
                                          encodeURIComponent(error));
        fallbackURL = fallbackURL.replace(/%RESPONSESTATUS%/g,
                                          encodeURIComponent(responseStatus));

        let initObj = {
          cache: "no-store",
          credentials: "omit",
          referrer: "no-referrer",
          method: downloadable.method
        };

        fetch(fallbackURL, initObj).then(response => response.text())
          .then(responseText => {
            if (!filterStorage.hasSubscription(subscription))
              return;

            let match = /^(\d+)(?:\s+(\S+))?$/.exec(responseText);
            if (match && match[1] == "301" &&    // Moved permanently
              match[2] && /^https?:\/\//i.test(match[2])) {
              redirectCallback(match[2]);
            }
            // Gone
            else if (match && match[1] == "410") {
              let data = "[Adblock]\n" +
              [...subscription.filterText()].join("\n");
              redirectCallback("data:text/plain," + encodeURIComponent(data));
            }
          });
      }
    }
  }
}

let synchronizer =
/**
 * This object is responsible for downloading filter subscriptions whenever
 * necessary.
 * @type {module:synchronizer~Synchronizer}
 */
exports.synchronizer = new Synchronizer(fullUpdater);

// allow DownloadableSubscription to update themselves once re-enabled
DownloadableSubscription.useSynchronizer(synchronizer);

/**
 * Given a valid subscription and some text, it parses all filters and add
 * these in bulk to the specified subscription.
 * @param {object} updater Updater.
 * @param {module:subscriptionClasses.Subscription} subscription The
 *  Subscription to use as reference for manually added filters.
 * @param {string} filters The filters file/text to add.
 * @param {function} errorCallback A callback invoked if errors occur.
 */
exports.addSubscriptionFilters = function(
  updater, subscription, filters, errorCallback) {
  let {error, lines} = updater.parseFilters(filters);
  if (error)
    errorCallback(error);
  else
    updater.processFilters(subscription, lines);
};
