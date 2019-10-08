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
 * @fileOverview Downloads a set of URLs in regular time intervals.
 */

const MILLIS_IN_SECOND = exports.MILLIS_IN_SECOND = 1000;
const MILLIS_IN_MINUTE = exports.MILLIS_IN_MINUTE = 60 * MILLIS_IN_SECOND;
const MILLIS_IN_HOUR = exports.MILLIS_IN_HOUR = 60 * MILLIS_IN_MINUTE;
const MILLIS_IN_DAY = exports.MILLIS_IN_DAY = 24 * MILLIS_IN_HOUR;

class Downloader
{
  /**
   * Creates a new downloader instance.
   * @param {function} dataSource
   *   Function that will yield downloadable objects on each check
   * @param {number} initialDelay
   *   Number of milliseconds to wait before the first check
   * @param {number} checkInterval
   *   Interval between the checks
   */
  constructor(dataSource, initialDelay, checkInterval)
  {
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
     * Maximal allowed expiration interval; larger expiration intervals will be
     * corrected.
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
     * Callback to be triggered whenever a download finishes successfully. The
     * callback can return an error code to indicate that the data is wrong.
     * @type {function?}
     */
    this.onDownloadSuccess = null;

    /**
     * Callback to be triggered whenever a download fails.
     * @type {function?}
     */
    this.onDownloadError = null;

    /**
     * Function that will yield downloadable objects on each check.
     * @type {function}
     */
    this.dataSource = dataSource;

    /**
     * Set containing the URLs of objects currently being downloaded.
     * @type {Set.<string>}
     */
    this._downloading = new Set();

    let check = () =>
    {
      try
      {
        this._doCheck();
      }
      finally
      {
        // Schedule the next check only after the callback has finished with
        // the current check.
        setTimeout(check, checkInterval); // eslint-disable-line no-undef
      }
    };

    // Note: test/_common.js overrides setTimeout() for the tests; if this
    // global function is used anywhere else, it may give incorrect results.
    // This is why we disable ESLint's no-undef rule locally.
    // https://gitlab.com/eyeo/adblockplus/adblockpluscore/issues/43
    setTimeout(check, initialDelay); // eslint-disable-line no-undef
  }

  /**
   * Checks whether anything needs downloading.
   */
  _doCheck()
  {
    let now = Date.now();
    for (let downloadable of this.dataSource())
    {
      if (downloadable.lastCheck &&
          now - downloadable.lastCheck > this.maxAbsenceInterval)
      {
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
      {
        continue;
      }

      // Do not retry downloads too often
      if (downloadable.lastError &&
          now - downloadable.lastError < this.minRetryInterval)
      {
        continue;
      }

      this._download(downloadable, 0);
    }
  }

  /**
   * Checks whether an address is currently being downloaded.
   * @param {string} url
   * @returns {boolean}
   */
  isDownloading(url)
  {
    return this._downloading.has(url);
  }

  /**
   * Starts downloading for an object.
   * @param {Downloadable} downloadable
   */
  download(downloadable)
  {
    // Make sure to detach download from the current execution context
    Promise.resolve().then(this._download.bind(this, downloadable, 0));
  }

  /**
   * Generates the real download URL for an object by appending various
   * parameters.
   * @param {Downloadable} downloadable
   * @returns {string}
   */
  getDownloadUrl(downloadable)
  {
    const {addonName, addonVersion, application, applicationVersion,
           platform, platformVersion} = require("info");
    let url = downloadable.redirectURL || downloadable.url;
    if (url.includes("?"))
      url += "&";
    else
      url += "?";
    // We limit the download count to 4+ to keep the request anonymized
    let {downloadCount} = downloadable;
    if (downloadCount > 4)
      downloadCount = "4+";
    url += "addonName=" + encodeURIComponent(addonName) +
        "&addonVersion=" + encodeURIComponent(addonVersion) +
        "&application=" + encodeURIComponent(application) +
        "&applicationVersion=" + encodeURIComponent(applicationVersion) +
        "&platform=" + encodeURIComponent(platform) +
        "&platformVersion=" + encodeURIComponent(platformVersion) +
        "&lastVersion=" + encodeURIComponent(downloadable.lastVersion) +
        "&downloadCount=" + encodeURIComponent(downloadCount);
    return url;
  }

  _download(downloadable, redirects)
  {
    if (this.isDownloading(downloadable.url))
      return;

    let downloadUrl = this.getDownloadUrl(downloadable);
    let responseStatus = 0;

    let errorCallback = error =>
    {
      console.error("Adblock Plus: Downloading URL " + downloadable.url +
                    " failed (" + error + ")\n" +
                    "Download address: " + downloadUrl + "\n" +
                    "Server response: " + responseStatus);

      if (this.onDownloadError)
      {
        // Allow one extra redirect if the error handler gives us a redirect URL
        let redirectCallback = null;
        if (redirects <= this.maxRedirects)
        {
          redirectCallback = url =>
          {
            downloadable.redirectURL = url;
            this._download(downloadable, redirects + 1);
          };
        }

        this.onDownloadError(downloadable, downloadUrl, error, responseStatus,
                             redirectCallback);
      }
    };

    let requestURL = null;

    try
    {
      requestURL = new URL(downloadUrl);
    }
    catch (error)
    {
      errorCallback("synchronize_invalid_url");
      return;
    }

    if (!["https:", "data:"].includes(requestURL.protocol) &&
        !["127.0.0.1", "[::1]", "localhost"].includes(requestURL.hostname))
    {
      errorCallback("synchronize_invalid_url");
      return;
    }

    let initObj = {
      cache: "no-store",
      credentials: "omit",
      referrer: "no-referrer"
    };

    let handleError = () =>
    {
      this._downloading.delete(downloadable.url);
      errorCallback("synchronize_connection_error");
    };

    let handleResponse = response =>
    {
      this._downloading.delete(downloadable.url);

      // If the Response.url property is available [1], disallow redirection
      // from HTTPS to any other protocol.
      // [1]: https://developer.mozilla.org/en-US/docs/Web/API/Response/url#Browser_compatibility
      if (typeof response.url == "string" && requestURL.protocol == "https:" &&
          new URL(response.url).protocol != requestURL.protocol)
      {
        errorCallback("synchronize_connection_error");
        return;
      }

      responseStatus = response.status;

      if (responseStatus != 200)
      {
        errorCallback("synchronize_connection_error");
        return;
      }

      downloadable.downloadCount++;

      response.text().then(responseText =>
      {
        this.onDownloadSuccess(downloadable, responseText, errorCallback, url =>
        {
          if (redirects >= this.maxRedirects)
          {
            errorCallback("synchronize_connection_error");
            return;
          }

          downloadable.redirectURL = url;
          this._download(downloadable, redirects + 1);
        });
      },
      () =>
      {
        errorCallback("synchronize_connection_error");
      });
    };

    fetch(requestURL.href, initObj).then(handleResponse, handleError);

    this._downloading.add(downloadable.url);

    if (this.onDownloadStarted)
      this.onDownloadStarted(downloadable);
  }

  /**
   * Produces a soft and a hard expiration interval for a given supplied
   * expiration interval.
   * @param {number} interval
   * @returns {Array.<number>} soft and hard expiration interval
   */
  processExpirationInterval(interval)
  {
    interval = Math.min(Math.max(interval, 0), this.maxExpirationInterval);
    let soft = Math.round(interval * (Math.random() * 0.4 + 0.8));
    let hard = interval * 2;
    let now = Date.now();
    return [now + soft, now + hard];
  }
}

exports.Downloader = Downloader;

class Downloadable
{
  /**
   * Creates an object that can be downloaded by the downloader.
   * @param {string} url  URL that has to be requested for the object
   */
  constructor(url)
  {
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
     * Soft expiration interval; will increase if no checks are performed for a
     * while.
     * @type {number}
     */
    this.softExpiration = 0;

    /**
     * Hard expiration interval; this is fixed.
     * @type {number}
     */
    this.hardExpiration = 0;

    /**
     * Number indicating how often the object was downloaded.
     * @type {number}
     */
    this.downloadCount = 0;

    /**
     * URL that has to be requested for the object.
     * @type {string}
     */
    this.url = url;
  }
}

exports.Downloadable = Downloadable;
