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

/**
 * @fileOverview Downloads a set of URLs in regular time intervals.
 */

const {Utils} = require("utils");

const MILLIS_IN_SECOND = exports.MILLIS_IN_SECOND = 1000;
const MILLIS_IN_MINUTE = exports.MILLIS_IN_MINUTE = 60 * MILLIS_IN_SECOND;
const MILLIS_IN_HOUR = exports.MILLIS_IN_HOUR = 60 * MILLIS_IN_MINUTE;
const MILLIS_IN_DAY = exports.MILLIS_IN_DAY = 24 * MILLIS_IN_HOUR;

let Downloader =
/**
 * Creates a new downloader instance.
 * @param {Function} dataSource
 *   Function that will yield downloadable objects on each check
 * @param {number} initialDelay
 *   Number of milliseconds to wait before the first check
 * @param {number} checkInterval
 *   Interval between the checks
 * @constructor
 */
exports.Downloader = function(dataSource, initialDelay, checkInterval)
{
  this.dataSource = dataSource;
  this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
  this._timer.initWithCallback(() =>
  {
    this._timer.delay = checkInterval;
    this._doCheck();
  }, initialDelay, Ci.nsITimer.TYPE_REPEATING_SLACK);
  this._downloading = Object.create(null);
};
Downloader.prototype =
{
  /**
   * Timer triggering the downloads.
   * @type {nsITimer}
   */
  _timer: null,

  /**
   * Map containing the URLs of objects currently being downloaded as its keys.
   */
  _downloading: null,

  /**
   * Function that will yield downloadable objects on each check.
   * @type {Function}
   */
  dataSource: null,

  /**
   * Maximal time interval that the checks can be left out until the soft
   * expiration interval increases.
   * @type {number}
   */
  maxAbsenceInterval: 1 * MILLIS_IN_DAY,

  /**
   * Minimal time interval before retrying a download after an error.
   * @type {number}
   */
  minRetryInterval: 1 * MILLIS_IN_DAY,

  /**
   * Maximal allowed expiration interval, larger expiration intervals will be
   * corrected.
   * @type {number}
   */
  maxExpirationInterval: 14 * MILLIS_IN_DAY,

  /**
   * Maximal number of redirects before the download is considered as failed.
   * @type {number}
   */
  maxRedirects: 5,

  /**
   * Called whenever expiration intervals for an object need to be adapted.
   * @type {Function}
   */
  onExpirationChange: null,

  /**
   * Callback to be triggered whenever a download starts.
   * @type {Function}
   */
  onDownloadStarted: null,

  /**
   * Callback to be triggered whenever a download finishes successfully. The
   * callback can return an error code to indicate that the data is wrong.
   * @type {Function}
   */
  onDownloadSuccess: null,

  /**
   * Callback to be triggered whenever a download fails.
   * @type {Function}
   */
  onDownloadError: null,

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
  },

  /**
   * Stops the periodic checks.
   */
  cancel()
  {
    this._timer.cancel();
  },

  /**
   * Checks whether an address is currently being downloaded.
   * @param {string} url
   * @return {boolean}
   */
  isDownloading(url)
  {
    return url in this._downloading;
  },

  /**
   * Starts downloading for an object.
   * @param {Downloadable} downloadable
   */
  download(downloadable)
  {
    // Make sure to detach download from the current execution context
    Utils.runAsync(this._download.bind(this, downloadable, 0));
  },

  /**
   * Generates the real download URL for an object by appending various
   * parameters.
   * @param {Downloadable} downloadable
   * @return {string}
   */
  getDownloadUrl(downloadable)
  {
    const {addonName, addonVersion, application, applicationVersion,
           platform, platformVersion} = require("info");
    let url = downloadable.redirectURL || downloadable.url;
    if (url.indexOf("?") >= 0)
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
  },

  _download(downloadable, redirects)
  {
    if (this.isDownloading(downloadable.url))
      return;

    let downloadUrl = this.getDownloadUrl(downloadable);
    let request = null;

    let errorCallback = function errorCallback(error)
    {
      let channelStatus = -1;
      try
      {
        channelStatus = request.channel.status;
      }
      catch (e) {}

      let responseStatus = request.status;

      Cu.reportError("Adblock Plus: Downloading URL " + downloadable.url +
                     " failed (" + error + ")\n" +
                     "Download address: " + downloadUrl + "\n" +
                     "Channel status: " + channelStatus + "\n" +
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

        this.onDownloadError(downloadable, downloadUrl, error, channelStatus,
                             responseStatus, redirectCallback);
      }
    }.bind(this);

    try
    {
      request = new XMLHttpRequest();
      request.mozBackgroundRequest = true;
      request.open("GET", downloadUrl);
    }
    catch (e)
    {
      errorCallback("synchronize_invalid_url");
      return;
    }

    try
    {
      request.overrideMimeType("text/plain");
      request.channel.loadFlags = request.channel.loadFlags |
                                  request.channel.INHIBIT_CACHING |
                                  request.channel.VALIDATE_ALWAYS;

      // Override redirect limit from preferences, user might have set it to 1
      if (request.channel instanceof Ci.nsIHttpChannel)
        request.channel.redirectionLimit = this.maxRedirects;
    }
    catch (e)
    {
      Cu.reportError(e);
    }

    request.addEventListener("error", event =>
    {
      if (onShutdown.done)
        return;

      delete this._downloading[downloadable.url];
      errorCallback("synchronize_connection_error");
    }, false);

    request.addEventListener("load", event =>
    {
      if (onShutdown.done)
        return;

      delete this._downloading[downloadable.url];

      // Status will be 0 for non-HTTP requests
      if (request.status && request.status != 200)
      {
        errorCallback("synchronize_connection_error");
        return;
      }

      downloadable.downloadCount++;

      this.onDownloadSuccess(
        downloadable, request.responseText, errorCallback,
        url =>
        {
          if (redirects >= this.maxRedirects)
            errorCallback("synchronize_connection_error");
          else
          {
            downloadable.redirectURL = url;
            this._download(downloadable, redirects + 1);
          }
        }
      );
    });

    request.send(null);

    this._downloading[downloadable.url] = true;
    if (this.onDownloadStarted)
      this.onDownloadStarted(downloadable);
  },

  /**
   * Produces a soft and a hard expiration interval for a given supplied
   * expiration interval.
   * @param {number} interval
   * @return {Array} soft and hard expiration interval
   */
  processExpirationInterval(interval)
  {
    interval = Math.min(Math.max(interval, 0), this.maxExpirationInterval);
    let soft = Math.round(interval * (Math.random() * 0.4 + 0.8));
    let hard = interval * 2;
    let now = Date.now();
    return [now + soft, now + hard];
  }
};

/**
 * An object that can be downloaded by the downloadable
 * @param {string} url  URL that has to be requested for the object
 * @constructor
 */
let Downloadable = exports.Downloadable = function Downloadable(url)
{
  this.url = url;
};
Downloadable.prototype =
{
  /**
   * URL that has to be requested for the object.
   * @type {string}
   */
  url: null,

  /**
   * URL that the download was redirected to if any.
   * @type {string}
   */
  redirectURL: null,

  /**
   * Time of last download error or 0 if the last download was successful.
   * @type {number}
   */
  lastError: 0,

  /**
   * Time of last check whether the object needs downloading.
   * @type {number}
   */
  lastCheck: 0,

  /**
   * Object version corresponding to the last successful download.
   * @type {number}
   */
  lastVersion: 0,

  /**
   * Soft expiration interval, will increase if no checks are performed for a
   * while.
   * @type {number}
   */
  softExpiration: 0,

  /**
   * Hard expiration interval, this is fixed.
   * @type {number}
   */
  hardExpiration: 0,

  /**
   * Number indicating how often the object was downloaded.
   * @type {number}
   */
  downloadCount: 0
};
