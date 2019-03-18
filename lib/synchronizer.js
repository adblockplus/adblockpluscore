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
 * @fileOverview Manages synchronization of filter subscriptions.
 */

const {Downloader, Downloadable,
       MILLIS_IN_SECOND, MILLIS_IN_MINUTE,
       MILLIS_IN_HOUR, MILLIS_IN_DAY} = require("./downloader");
const {Filter} = require("./filterClasses");
const {filterStorage} = require("./filterStorage");
const {filterNotifier} = require("./filterNotifier");
const {Prefs} = require("prefs");
const {Subscription,
       DownloadableSubscription} = require("./subscriptionClasses");

const INITIAL_DELAY = 1 * MILLIS_IN_MINUTE;
const CHECK_INTERVAL = 1 * MILLIS_IN_HOUR;
const DEFAULT_EXPIRATION_INTERVAL = 5 * MILLIS_IN_DAY;

/**
 * Downloads filter subscriptions whenever necessary.
 */
class Synchronizer
{
  /**
   * @hideconstructor
   */
  constructor()
  {
    /**
     * The object providing actual downloading functionality.
     * @type {Downloader}
     */
    this._downloader = new Downloader(this._getDownloadables.bind(this),
                                      INITIAL_DELAY, CHECK_INTERVAL);
    onShutdown.add(() =>
    {
      this._downloader.cancel();
    });

    this._downloader.onExpirationChange = this._onExpirationChange.bind(this);
    this._downloader.onDownloadStarted = this._onDownloadStarted.bind(this);
    this._downloader.onDownloadSuccess = this._onDownloadSuccess.bind(this);
    this._downloader.onDownloadError = this._onDownloadError.bind(this);
  }

  /**
   * Checks whether a subscription is currently being downloaded.
   * @param {string} url  URL of the subscription
   * @returns {boolean}
   */
  isExecuting(url)
  {
    return this._downloader.isDownloading(url);
  }

  /**
   * Starts the download of a subscription.
   * @param {DownloadableSubscription} subscription
   *   Subscription to be downloaded
   * @param {boolean} manual
   *   <code>true</code> for a manually started download (should not trigger
   *   fallback requests)
   */
  execute(subscription, manual)
  {
    this._downloader.download(this._getDownloadable(subscription, manual));
  }

  /**
   * Yields {@link Downloadable} instances for all subscriptions that can be
   * downloaded.
   * @yields {Downloadable}
   */
  *_getDownloadables()
  {
    if (!Prefs.subscriptions_autoupdate)
      return;

    for (let subscription of filterStorage.subscriptions())
    {
      if (subscription instanceof DownloadableSubscription)
        yield this._getDownloadable(subscription, false);
    }
  }

  /**
   * Creates a {@link Downloadable} instance for a subscription.
   * @param {Subscription} subscription
   * @param {boolean} manual
   * @returns {Downloadable}
   */
  _getDownloadable(subscription, manual)
  {
    let result = new Downloadable(subscription.url);
    if (subscription.lastDownload != subscription.lastSuccess)
      result.lastError = subscription.lastDownload * MILLIS_IN_SECOND;
    result.lastCheck = subscription.lastCheck * MILLIS_IN_SECOND;
    result.lastVersion = subscription.version;
    result.softExpiration = subscription.softExpiration * MILLIS_IN_SECOND;
    result.hardExpiration = subscription.expires * MILLIS_IN_SECOND;
    result.manual = manual;
    result.downloadCount = subscription.downloadCount;
    return result;
  }

  _onExpirationChange(downloadable)
  {
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

  _onDownloadStarted(downloadable)
  {
    let subscription = Subscription.fromURL(downloadable.url);
    filterNotifier.emit("subscription.downloading", subscription);
  }

  _onDownloadSuccess(downloadable, responseText, errorCallback,
                     redirectCallback)
  {
    let lines = responseText.split(/[\r\n]+/);
    let headerMatch = /\[Adblock(?:\s*Plus\s*([\d.]+)?)?\]/i.exec(lines[0]);
    if (!headerMatch)
      return errorCallback("synchronize_invalid_data");
    let minVersion = headerMatch[1];

    let params = {
      redirect: null,
      homepage: null,
      title: null,
      version: null,
      expires: null
    };
    for (let i = 1; i < lines.length; i++)
    {
      let match = /^\s*!\s*(.*?)\s*:\s*(.*)/.exec(lines[i]);
      if (!match)
        break;

      let keyword = match[1].toLowerCase();
      if (params.hasOwnProperty(keyword))
      {
        params[keyword] = match[2];
        lines.splice(i--, 1);
      }
    }

    if (params.redirect)
      return redirectCallback(params.redirect);

    // Handle redirects
    let subscription = Subscription.fromURL(downloadable.redirectURL ||
                                            downloadable.url);
    if (downloadable.redirectURL &&
        downloadable.redirectURL != downloadable.url)
    {
      let oldSubscription = Subscription.fromURL(downloadable.url);
      subscription.title = oldSubscription.title;
      subscription.disabled = oldSubscription.disabled;
      subscription.lastCheck = oldSubscription.lastCheck;

      let listed = filterStorage.knownSubscriptions.has(oldSubscription.url);
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
    if (params.homepage)
    {
      let url;
      try
      {
        url = new URL(params.homepage);
      }
      catch (e)
      {
        url = null;
      }

      if (url && (url.protocol == "http:" || url.protocol == "https:"))
        subscription.homepage = url.href;
    }

    if (params.title)
    {
      subscription.title = params.title;
      subscription.fixedTitle = true;
    }
    else
      subscription.fixedTitle = false;

    subscription.version = (params.version ? parseInt(params.version, 10) : 0);

    let expirationInterval = DEFAULT_EXPIRATION_INTERVAL;
    if (params.expires)
    {
      let match = /^(\d+)\s*(h)?/.exec(params.expires);
      if (match)
      {
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

    // Process filters
    lines.shift();
    let filterText = [];
    for (let line of lines)
    {
      line = Filter.normalize(line);
      if (line)
        filterText.push(line);
    }

    filterStorage.updateSubscriptionFilters(subscription, filterText);
  }

  _onDownloadError(downloadable, downloadURL, error, responseStatus,
                   redirectCallback)
  {
    let subscription = Subscription.fromURL(downloadable.url);
    subscription.lastDownload = Math.round(Date.now() / MILLIS_IN_SECOND);
    subscription.downloadStatus = error;

    // Request fallback URL if necessary - for automatic updates only
    if (!downloadable.manual)
    {
      subscription.errors++;

      if (redirectCallback &&
          subscription.errors >= Prefs.subscriptions_fallbackerrors &&
          /^https?:\/\//i.test(subscription.url))
      {
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

        let request = new XMLHttpRequest();
        request.mozBackgroundRequest = true;
        request.open("GET", fallbackURL);
        request.overrideMimeType("text/plain");
        request.addEventListener("load", ev =>
        {
          if (onShutdown.done)
            return;

          if (!filterStorage.knownSubscriptions.has(subscription.url))
            return;

          let match = /^(\d+)(?:\s+(\S+))?$/.exec(request.responseText);
          if (match && match[1] == "301" &&    // Moved permanently
              match[2] && /^https?:\/\//i.test(match[2]))
          {
            redirectCallback(match[2]);
          }
          else if (match && match[1] == "410") // Gone
          {
            let data = "[Adblock]\n" +
              [...subscription.filterText()].join("\n");
            redirectCallback("data:text/plain," + encodeURIComponent(data));
          }
        }, false);
        request.send(null);
      }
    }
  }
}

/**
 * This object is responsible for downloading filter subscriptions whenever
 * necessary.
 * @type {Synchronizer}
 */
let synchronizer = new Synchronizer();

exports.Synchronizer = synchronizer;
