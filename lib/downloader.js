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
 * @file Downloads a set of URLs in regular time intervals.
 */

const {MILLIS_IN_DAY} = require("./time");
const {isLocalhost} = require("./url");

/**
 * A type of function that yields `{@link module:downloader.Downloadable}`
 * objects to a `{@link module:downloader.Downloader}`.
 *
 * **Note**: The implementation must yield a new
 * `{@link module:downloader.Downloadable}` instance on each call with
 * up-to-date values for properties like
 * `{@link module:downloader.Downloadable#lastCheck}`,
 * `{@link module:downloader.Downloadable#lastVersion}`,
 * `{@link module:downloader.Downloadable#downloadCount}`, and others. If a
 * value is outdated, it may result in unexpected behavior.
 *
 * @callback DataSource
 *
 * @yields {module:downloader.Downloadable}
 * @generator
 *
 * @see module:downloader.Downloader
 * @see module:downloader.Downloader#dataSource
 */

/**
 * Use a `Downloader` object to download a set of URLs at regular time
 * intervals.
 *
 * This class is used by `{@link module:synchronizer.synchronizer}` and
 * `{@link module:notifications.notifications}`.
 *
 * @example
 *
 * function* dataSource()
 * {
 *   yield new Downloadable("https://example.com/filters.txt");
 * }
 *
 * let initialDelay = 1000;
 * let checkInterval = 60000;
 *
 * let downloader = new Downloader(dataSource);
 * downloader.scheduleChecks(checkInterval, initialDelay);
 *
 * downloader.onDownloadStarted = function(downloadable)
 * {
 *   console.log(`Downloading ${downloadable.url} ...`);
 * }
 *
 * @package
 */
exports.Downloader = class Downloader {
  /**
   * Creates a new downloader instance.
   * @param {module:downloader~DataSource} dataSource
   *   A function that yields `{@link module:downloader.Downloadable}` objects
   *   on each {@link module:downloader.Downloader#scheduleChecks check}.
   */
  constructor(dataSource) {
    /**
     * Maximal time interval that the checks can be left out until the soft
     * expiration interval increases.
     * @type {number}
     */
    this.maxAbsenceInterval = 1 * MILLIS_IN_DAY;

    /**
     * Minimal time interval before retrying a download after an error.
     * @type {number}
     */
    this.minRetryInterval = 1 * MILLIS_IN_DAY;

    /**
     * Maximal allowed expiration interval; larger expiration
     * intervals will be corrected.
     * @type {number}
     */
    this.maxExpirationInterval = 14 * MILLIS_IN_DAY;

    /**
     * Maximal number of redirects before the download is considered as failed.
     * @type {number}
     */
    this.maxRedirects = 5;

    /**
     * Called whenever expiration intervals for an object need to be adapted.
     * @type {function?}
     */
    this.onExpirationChange = null;

    /**
     * Callback to be triggered whenever a download starts.
     * @type {function?}
     */
    this.onDownloadStarted = null;

    /**
     * Callback to be triggered whenever a download finishes successfully.
     *
     * The callback can return an error code to indicate that the data is
     * wrong.
     *
     * @type {function?}
     */
    this.onDownloadSuccess = null;

    /**
     * Callback to be triggered whenever a download fails.
     * @type {function?}
     */
    this.onDownloadError = null;

    /**
     * A function that yields `{@link module:downloader.Downloadable}` objects
     * on each {@link module:downloader.Downloader#scheduleChecks check}.
     * @type {module:downloader~DataSource}
     */
    this.dataSource = dataSource;

    /**
     * Set containing the URLs of objects currently being downloaded.
     * @type {Set.<string>}
     */
    this._downloading = new Set();

    /**
     * Store the timeout ID for scheduled checks.
     * @type {number}
     */
    this._timeout = 0;
  }

  /**
   * Schedules checks at regular time intervals.
   *
   * @param {number} interval The interval between checks in milliseconds.
   * @param {number} delay The delay before the initial check in milliseconds.
   */
  scheduleChecks(interval, delay) {
    // clear previous timeouts if called too many times
    this.unscheduleChecks();

    let check = () => {
      console.log(new Date(), "Core Downloader: checking if it's time to download");
      try {
        this._doCheck();
      }
      finally {
        // Schedule the next check only after the callback has finished with
        // the current check.
        this._timeout =
          setTimeout(check, interval); // eslint-disable-line no-undef
      }
    };

    // Note: test/_common.js overrides setTimeout() for the tests; if this
    // global function is used anywhere else, it may give incorrect results.
    // This is why we disable ESLint's no-undef rule locally.
    // https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore/issues/43
    this._timeout = setTimeout(check, delay); // eslint-disable-line no-undef
  }

  /**
   * Clear previously scheduled checks, if any.
   */
  unscheduleChecks() {
    if (this._timeout) {
      clearTimeout(this._timeout); // eslint-disable-line no-undef
      this._timeout = 0;
    }
  }

  /**
   * Checks whether anything needs downloading.
   */
  _doCheck() {
    let now = Date.now();
    for (let downloadable of this.dataSource()) {
      console.log(new Date(), "Checking Downloadable", downloadable);
      if (downloadable.lastCheck &&
          now - downloadable.lastCheck > this.maxAbsenceInterval) {
        // No checks for a long time interval - user must have been offline,
        // e.g.  during a weekend. Increase soft expiration to prevent load
        // peaks on the server.
        downloadable.softExpiration += now - downloadable.lastCheck;
      }
      downloadable.lastCheck = now;

      // Sanity check: do expiration times make sense? Make sure people changing
      // system clock don't get stuck with outdated subscriptions.
      if (downloadable.hardExpiration - now > this.maxExpirationInterval)
        downloadable.hardExpiration = now + this.maxExpirationInterval;
      if (downloadable.softExpiration - now > this.maxExpirationInterval)
        downloadable.softExpiration = now + this.maxExpirationInterval;

      // Notify the caller about changes to expiration parameters
      if (this.onExpirationChange)
        this.onExpirationChange(downloadable);

      // Does that object need downloading?
      if (downloadable.softExpiration > now &&
          downloadable.hardExpiration > now)
        continue;

      // Do not retry downloads too often
      if (downloadable.lastError &&
          now - downloadable.lastError < this.minRetryInterval)
        continue;

      console.log(new Date(), "All checks passed, downloading", downloadable);
      this._download(downloadable, 0);
    }
  }

  /**
   * Checks whether an address is currently being downloaded.
   * @param {string} url
   * @returns {boolean}
   */
  isDownloading(url) {
    return this._downloading.has(url);
  }

  /**
   * Starts downloading for an object.
   * @param {Downloadable} downloadable
   */
  download(downloadable) {
    this._download(downloadable, 0);
  }

  /**
   * Generates the real download URL for an object by appending various
   * parameters.
   * @param {Downloadable} downloadable
   * @returns {string}
   */
  getDownloadUrl(downloadable) {
    const {addonName, addonVersion, application, applicationVersion,
           platform, platformVersion, manifestVersion} = require("info");

    let url = downloadable.redirectURL || downloadable.url;
    if (url.includes("?"))
      url += "&";
    else
      url += "?";

    // We limit the download count to 4+ to keep the request anonymized.
    let {downloadCount, disabled} = downloadable;
    if (downloadCount > 4)
      downloadCount = "4+";
    if (typeof disabled == "undefined")
      disabled = false;

    url += "addonName=" + encodeURIComponent(addonName) +
           "&addonVersion=" + encodeURIComponent(addonVersion) +
           "&application=" + encodeURIComponent(application) +
           "&applicationVersion=" + encodeURIComponent(applicationVersion) +
           "&platform=" + encodeURIComponent(platform) +
           "&platformVersion=" + encodeURIComponent(platformVersion) +
           "&lastVersion=" + encodeURIComponent(downloadable.lastVersion) +
           "&downloadCount=" + encodeURIComponent(downloadCount) +
           "&disabled=" + String(disabled) +
           "&manifestVersion=" + encodeURIComponent(manifestVersion);

    if (downloadable.firstVersion && !downloadable.redirectURL)
      url += "&firstVersion=" + encodeURIComponent(downloadable.firstVersion);

    return url;
  }

  _download(downloadable, redirects) {
    if (this.isDownloading(downloadable.url))
      return;

    let downloadUrl = this.getDownloadUrl(downloadable);
    let responseStatus = 0;

    let errorCallback = error => {
      console.warn("Adblock Plus: Downloading URL " + downloadable.url +
                   " failed (" + error + ")\n" +
                   "Download address: " + downloadUrl + "\n" +
                   "Server response: " + responseStatus);

      if (this.onDownloadError) {
        // Allow one extra redirect if the error handler gives us a redirect URL
        let redirectCallback = null;
        if (redirects <= this.maxRedirects) {
          redirectCallback = url => {
            downloadable.redirectURL = url;
            this._download(downloadable, redirects + 1);
          };
        }

        this.onDownloadError(
          downloadable, downloadUrl, error, responseStatus, redirectCallback
        );
      }
    };

    if (!Downloader.isValidURL(downloadUrl)) {
      errorCallback("synchronize_invalid_url");
      return;
    }

    let requestURL = new URL(downloadUrl);

    let initObj = {
      cache: "no-store",
      credentials: "omit",
      referrer: "no-referrer",
      method: downloadable.method
    };

    let handleError = () => {
      this._downloading.delete(downloadable.url);
      errorCallback("synchronize_connection_error");
    };

    let handleResponse = response => {
      this._downloading.delete(downloadable.url);

      // If the Response.url property is available [1], disallow redirection
      // from HTTPS to any other protocol.
      // [1]: https://developer.mozilla.org/en-US/docs/Web/API/Response/url#Browser_compatibility
      if (typeof response.url == "string" && requestURL.protocol == "https:" &&
          new URL(response.url).protocol != requestURL.protocol) {
        errorCallback("synchronize_connection_error");
        return;
      }

      responseStatus = response.status;

      if (responseStatus != 200) {
        errorCallback("synchronize_connection_error");
        return;
      }

      // We need to keep updated the subscription version even via HEAD.
      if (downloadable.method === "HEAD") {
        // However, as we don't know if the server would respond with such
        // detail, we need to be sure there is such `Date` or `date` field.
        let date = response.headers.get("Date") || response.headers.get("date");
        if (date) {
          // if that's the case, we want it to be formatted as YYYYMMDDHHMM.
          downloadable.lastVersion =
            new Date(date).toISOString().replace(/\D/g, "").slice(0, 12);
        }
      }

      if (!downloadable.disabled)
        downloadable.downloadCount++;

      response.text().then(
        responseText => {
          this.onDownloadSuccess(
            downloadable, responseText, errorCallback, url => {
              if (redirects >= this.maxRedirects) {
                errorCallback("synchronize_connection_error");
                return;
              }

              downloadable.redirectURL = url;
              this._download(downloadable, redirects + 1);
            }
          );
        },
        () => {
          errorCallback("synchronize_connection_error");
        }
      );
    };

    fetch(requestURL.href, initObj).then(handleResponse, handleError);

    this._downloading.add(downloadable.url);

    if (this.onDownloadStarted)
      this.onDownloadStarted(downloadable);
  }

  /**
   * Produces a soft and a hard expiration time for a given supplied
   * expiration interval.
   *
   * Downloadable things, like Subscription, have a certain time after
   * which they expire and you need to download a new, updated version.
   *
   * To spread the load on our download servers, we'd rather that all
   * users not download updates at exactly the same time, so on
   * download we calculate a soft expiration time, which is randomly
   * chosen between 80% and 120% of the original time. When we pass
   * the soft expiration, we start trying to download updates.
   *
   * However, there are other events that could cause downloads to all
   * happen at the same time. If many people leave their computer off
   * over the weekend and sign in at the beginning of business hours
   * on Monday, we could still see a spike in downloads at the same
   * time. To combat this, the soft expiration time may be delayed to
   * accomodate these periods of inactivity.
   *
   * There are limits to how far we want to delay our download due to
   * inactivity. This is why we also calculate a hard expiration time,
   * which is 200% of the original time. When we pass the hard
   * expiration, we should try to download an update whether there was
   * inactivity or not.
   *
   * This function must be called to calculate the new expiration
   * times as soon as a new version is downloaded.
   *
   * @param {number} interval how often in milliseconds the
   * downloadable should be updated
   * @returns {Array.<number>} soft and hard expiration times in
   * milliseconds since the Unix epoch
   */
  processExpirationInterval(interval) {
    interval = Math.min(Math.max(interval, 0), this.maxExpirationInterval);
    let soft = Math.round(interval * (Math.random() * 0.4 + 0.8));
    let hard = interval * 2;
    let now = Date.now();
    return [now + soft, now + hard];
  }
};

/**
 * Checks whether a URL is a valid download URL.
 *
 * For a URL to be a valid download URL, its scheme must be `https` or `data`.
 * If the host component of the URL is `localhost`, `127.0.0.1`, or `[::1]`,
 * however, but its scheme is not `https` or `data`, the URL is still
 * considered to be a valid download URL.
 *
 * `https://example.com/`, `data:,Hello%2C%20World!`, and
 * `http://127.0.0.1/example.txt` are all examples of valid download URLs.
 *
 * @param {string} url The URL.
 *
 * @returns {boolean} Whether the URL is a valid download URL.
 *
 * @package
 */
exports.Downloader.isValidURL = function isValidURL(url) {
  try {
    url = new URL(url);
  }
  catch (error) {
    return false;
  }

  if (!["https:", "data:"].includes(url.protocol) &&
      !isLocalhost(url.hostname))
    return false;

  return true;
};

/**
 * A `Downloadable` object represents a downloadable resource.
 * @package
 */
exports.Downloadable = class Downloadable {
  /**
   * Creates an object that can be downloaded by the downloader.
   * @param {string} url  URL that has to be requested for the object
   */
  constructor(url) {
    /**
     * URL that the download was redirected to if any.
     * @type {string?}
     */
    this.redirectURL = null;

    /**
     * Time of last download error or 0 if the last download was successful.
     * @type {number}
     */
    this.lastError = 0;

    /**
     * Time of last check whether the object needs downloading.
     * @type {number}
     */
    this.lastCheck = 0;

    /**
     * Object version corresponding to the last successful download.
     * @type {number}
     */
    this.lastVersion = 0;

    /**
     * A string indicating the version of the first ever downloaded resource,
     * in `YYYY[MM[DD]][-E]` format or just `"0"` or `"0-E"`.
     *
     * Note that unlike `{@link module:downloader.Downloadable#lastVersion}`
     * this property is related to analytics and its value is common across all
     * downloadable resources.
     *
     * If `{@link module:downloader.Downloadable#url}` is not a trusted URL,
     * the value of this property should be set to `null`.
     *
     * @see module:analytics~Analytics#getFirstVersion
     * @see module:analytics~Analytics#isTrusted
     *
     * @type {?string}
     *
     * @package
     */
    this.firstVersion = null;

    /**
     * Soft expiration time in milliseconds since the Unix epoch. This
     * will increase if no checks are performed for a while.
     *
     * Updates should be downloaded if `softExpiration` or
     * `{@link module:downloader.Downloadable#hardExpiration}` are in the past.
     * @type {number}
     */
    this.softExpiration = 0;

    /**
     * Hard expiration time in milliseconds since the Unix epoch. This
     * is fixed.
     *
     * Updates should be downloaded if
     * `{@link module:downloader.Downloadable#softExpiration}` or
     * `hardExpiration` are in the past.
     * @type {number}
     */
    this.hardExpiration = 0;

    /**
     * Number indicating how often the object was downloaded.
     * @type {number}
     */
    this.downloadCount = 0;

    /**
     * Request method to use, which is either "GET" or "HEAD".
     * @type {string}
     */
    this.method = "GET";

    /**
     * URL that has to be requested for the object.
     * @type {string}
     */
    this.url = url;
  }
};
