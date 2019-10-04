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

/** @module notifications */

"use strict";

/**
 * @fileOverview Handles notifications.
 */

const {Prefs} = require("prefs");
const {contentTypes} = require("./contentTypes");
const {Downloader, Downloadable,
       MILLIS_IN_MINUTE, MILLIS_IN_HOUR,
       MILLIS_IN_DAY} = require("./downloader");
const {Utils} = require("utils");
const {Matcher, defaultMatcher} = require("./matcher");
const {Filter, WhitelistFilter} = require("./filterClasses");
const {compareVersions} = require("./versions");

const INITIAL_DELAY = 1 * MILLIS_IN_MINUTE;
const CHECK_INTERVAL = 1 * MILLIS_IN_HOUR;
const EXPIRATION_INTERVAL = 1 * MILLIS_IN_DAY;

/**
 * Converts a version string into a <code>Date</code> object with minute-level
 * precision.
 *
 * @param {string} version The version string in <code>YYYYMMDD[HH[MM]]</code>
 *   format or just the value <code>"0"</code>.
 *
 * @returns {Date} A <code>Date</code> object. If the value of
 *   <code>version</code> is <code>"0"</code>, the returned value represents
 *   the Unix epoch.
 */
function versionToDate(version)
{
  if (version == "0")
    return new Date(0);

  let year = version.substring(0, 4);
  let month = version.substring(4, 6);
  let date = version.substring(6, 8);

  let hours = version.substring(8, 10) || "00";
  let minutes = version.substring(10, 12) | "00";

  return new Date(`${year}-${month}-${date}T${hours}:${minutes}Z`);
}

/**
 * Strips the value of the <code>firstVersion</code> parameter down to either
 * <code>YYYYMMDD</code>, <code>YYYYMM</code>, or <code>YYYY</code> depending
 * on its distance from the value of the <code>currentVersion</code> parameter.
 *
 * @param {string} firstVersion A version string in
 *   <code>YYYYMMDD[HH[MM]]</code> format with an optional <code>"-E"</code>
 *   suffix or just <code>"0"</code> or <code>"0-E"</code>.
 * @param {string} [currentVersion] A version string in
 *   <code>YYYYMMDD[HH[MM]]</code> format or just <code>"0"</code>.
 *
 * @returns {?string}
 */
function stripFirstVersion(firstVersion, currentVersion = "0")
{
  let eFlag = firstVersion.endsWith("-E");
  if (eFlag)
    firstVersion = firstVersion.slice(0, -2);

  try
  {
    let firstDate = versionToDate(firstVersion);
    let currentDate = versionToDate(currentVersion);

    if (currentDate - firstDate > 365 * MILLIS_IN_DAY)
      firstVersion = firstVersion.substring(0, 4);
    else if (currentDate - firstDate > 30 * MILLIS_IN_DAY)
      firstVersion = firstVersion.substring(0, 6);
    else
      firstVersion = firstVersion.substring(0, 8);
  }
  catch (error)
  {
    return null;
  }

  if (eFlag)
    firstVersion += "-E";

  return firstVersion;
}

/**
 * Returns the numerical severity of a notification.
 * @param {object} notification The notification.
 * @returns {number} The numerical severity of the notification.
 */
function getNumericalSeverity(notification)
{
  switch (notification.type)
  {
    case "information":
      return 0;
    case "question":
      return 1;
    case "relentless":
      return 2;
    case "critical":
      return 3;
  }

  return 0;
}

/**
 * Saves notification data to preferences.
 * @param {string} [key] The key to save.
 */
function saveNotificationData(key = "notificationdata")
{
  // JSON values aren't saved unless they are assigned a different object.
  Prefs[key] = JSON.parse(JSON.stringify(Prefs[key]));
}

/**
 * Localizes a notification text.
 *
 * @param {object} translations The set of translations from which to select
 *   the localization.
 * @param {string} locale The locale string to use for the selection. If no
 *   localized version is found in the <code>translations</code> object for the
 *   given locale, the default locale <code>en-US</code> is used.
 *
 * @returns {*} The localized text; <code>undefined</code> if no localized
 *   version is found in the <code>translations</code> object.
 */
function localize(translations, locale)
{
  if (locale in translations)
    return translations[locale];

  let languagePart = locale.substring(0, locale.indexOf("-"));
  if (languagePart && languagePart in translations)
    return translations[languagePart];

  let defaultLocale = "en-US";
  return translations[defaultLocale];
}

/**
 * <code>{@link notifications}</code> implementation.
 */
class Notifications
{
  /**
   * @hideconstructor
   */
  constructor()
  {
    /**
     * Listeners for notifications to be shown.
     * @type {Array.<function>}
     * @private
     */
    this._showListeners = [];

    /**
     * Listeners for question-type notifications.
     * @type {Array.<QuestionListener>}
     * @private
     */
    this._questionListeners = {};

    /**
     * Local notifications added via
     * <code>{@link Notifications#addNotification}</code>.
     * @type {Array.<object>}
     * @private
     */
    this._localNotifications = [];

    /**
     * The object providing actual downloading functionality.
     * @type {Downloader}
     * @private
     */
    this._downloader = new Downloader(this._getDownloadables.bind(this),
                                      INITIAL_DELAY, CHECK_INTERVAL);

    this._downloader.onExpirationChange = this._onExpirationChange.bind(this);
    this._downloader.onDownloadSuccess = this._onDownloadSuccess.bind(this);
    this._downloader.onDownloadError = this._onDownloadError.bind(this);

    Prefs.on("blocked_total", this._onBlockedTotal.bind(this));
  }

  /**
   * Yields a <code>{@link Downloadable}</code> instance for the notifications
   * download.
   * @yields {Downloadable}
   * @private
   */
  *_getDownloadables()
  {
    let url = Prefs.notificationurl;

    let {firstVersion} = Prefs.notificationdata;
    if (typeof firstVersion == "string")
    {
      firstVersion =
        stripFirstVersion(firstVersion,
                          (Prefs.notificationdata.data || {}).version);
      if (firstVersion)
      {
        if (firstVersion == "0" && "data" in Prefs.notificationdata)
          firstVersion = "0-E";

        url += (url.includes("?") ? "&" : "?") + "firstVersion=" +
               encodeURIComponent(firstVersion);
      }
    }

    let downloadable = new Downloadable(url);

    if (typeof Prefs.notificationdata.lastError == "number")
      downloadable.lastError = Prefs.notificationdata.lastError;
    if (typeof Prefs.notificationdata.lastCheck == "number")
      downloadable.lastCheck = Prefs.notificationdata.lastCheck;

    if (typeof Prefs.notificationdata.data == "object" &&
        "version" in Prefs.notificationdata.data)
    {
      downloadable.lastVersion = Prefs.notificationdata.data.version;
    }

    if (typeof Prefs.notificationdata.softExpiration == "number")
      downloadable.softExpiration = Prefs.notificationdata.softExpiration;
    if (typeof Prefs.notificationdata.hardExpiration == "number")
      downloadable.hardExpiration = Prefs.notificationdata.hardExpiration;
    if (typeof Prefs.notificationdata.downloadCount == "number")
      downloadable.downloadCount = Prefs.notificationdata.downloadCount;

    yield downloadable;
  }

  _onExpirationChange(downloadable)
  {
    Prefs.notificationdata.lastCheck = downloadable.lastCheck;
    Prefs.notificationdata.softExpiration = downloadable.softExpiration;
    Prefs.notificationdata.hardExpiration = downloadable.hardExpiration;

    saveNotificationData();
  }

  _onDownloadSuccess(downloadable, responseText, errorCallback,
                     redirectCallback)
  {
    try
    {
      let data = JSON.parse(responseText);

      if (typeof data.version == "string" &&
          Prefs.notificationdata.firstVersion == "0")
      {
        let {version} = data;

        // If this is not a new installation, set the -E flag.
        if ("data" in Prefs.notificationdata)
          version += "-E";

        Prefs.notificationdata.firstVersion = version;
      }

      for (let notification of data.notifications)
      {
        if ("severity" in notification)
        {
          if (!("type" in notification))
            notification.type = notification.severity;
          delete notification.severity;
        }
      }
      Prefs.notificationdata.data = data;
    }
    catch (error)
    {
      Utils.logError(error);
      errorCallback("synchronize_invalid_data");
      return;
    }

    Prefs.notificationdata.lastError = 0;
    Prefs.notificationdata.downloadStatus = "synchronize_ok";
    [
      Prefs.notificationdata.softExpiration,
      Prefs.notificationdata.hardExpiration
    ] = this._downloader.processExpirationInterval(EXPIRATION_INTERVAL);
    Prefs.notificationdata.downloadCount = downloadable.downloadCount;

    saveNotificationData();

    this.showNext();
  }

  _onDownloadError(downloadable, downloadURL, error, responseStatus,
                   redirectCallback)
  {
    Prefs.notificationdata.lastError = Date.now();
    Prefs.notificationdata.downloadStatus = error;

    saveNotificationData();
  }

  _onBlockedTotal()
  {
    this.showNext();
  }

  /**
   * Adds a listener for notifications to be shown.
   * @param {function} listener Listener to be invoked when a notification is
   *   to be shown.
   */
  addShowListener(listener)
  {
    if (!this._showListeners.includes(listener))
      this._showListeners.push(listener);
  }

  /**
   * Removes the supplied listener.
   * @param {function} listener Listener that was added via
   *   <code>{@link Notifications#addShowListener}</code>.
   */
  removeShowListener(listener)
  {
    let index = this._showListeners.indexOf(listener);
    if (index != -1)
      this._showListeners.splice(index, 1);
  }

  /**
   * Determines which notification is to be shown next.
   * @param {?(URL|URLInfo)} [url] The URL to match notifications to.
   * @returns {?object} The notification to be shown, or <code>null</code> if
   *   there is none.
   * @private
   */
  _getNextToShow(url)
  {
    let remoteNotifications = [];
    if (typeof Prefs.notificationdata.data == "object" &&
        Prefs.notificationdata.data.notifications instanceof Array)
    {
      remoteNotifications = Prefs.notificationdata.data.notifications;
    }

    let notifications = this._localNotifications.concat(remoteNotifications);
    if (notifications.length == 0)
      return null;

    const {addonName, addonVersion, application,
           applicationVersion, platform, platformVersion} = require("info");

    let targetChecks = {
      extension: v => v == addonName,
      extensionMinVersion:
        v => compareVersions(addonVersion, v) >= 0,
      extensionMaxVersion:
        v => compareVersions(addonVersion, v) <= 0,
      application: v => v == application,
      applicationMinVersion:
        v => compareVersions(applicationVersion, v) >= 0,
      applicationMaxVersion:
        v => compareVersions(applicationVersion, v) <= 0,
      platform: v => v == platform,
      platformMinVersion:
        v => compareVersions(platformVersion, v) >= 0,
      platformMaxVersion:
        v => compareVersions(platformVersion, v) <= 0,
      blockedTotalMin: v => Prefs.show_statsinpopup &&
        Prefs.blocked_total >= v,
      blockedTotalMax: v => Prefs.show_statsinpopup &&
        Prefs.blocked_total <= v,
      locales: v => v.includes(Utils.appLocale)
    };

    let notificationToShow = null;
    for (let notification of notifications)
    {
      if (typeof notification.type == "undefined" ||
          notification.type != "critical")
      {
        let shown;
        if (typeof Prefs.notificationdata.shown == "object")
          shown = Prefs.notificationdata.shown[notification.id];

        if (typeof shown != "undefined")
        {
          if (typeof notification.interval == "number")
          {
            if (shown + notification.interval > Date.now())
              continue;
          }
          else if (shown)
          {
            continue;
          }
        }

        if (notification.type != "relentless" &&
            Prefs.notifications_ignoredcategories.indexOf("*") != -1)
        {
          continue;
        }
      }

      if (url || notification.urlFilters instanceof Array)
      {
        if (Prefs.enabled && url && notification.urlFilters instanceof Array)
        {
          let filter = defaultMatcher.matchesAny(url,
                                                 contentTypes.DOCUMENT,
                                                 url.hostname,
                                                 null);
          if (filter instanceof WhitelistFilter)
            continue;

          let matcher = new Matcher();
          for (let urlFilter of notification.urlFilters)
            matcher.add(Filter.fromText(urlFilter));
          if (!matcher.matchesAny(url,
                                  contentTypes.DOCUMENT,
                                  url.hostname,
                                  null))
          {
            continue;
          }
        }
        else
        {
          continue;
        }
      }

      if (notification.targets instanceof Array)
      {
        let match = false;

        for (let target of notification.targets)
        {
          let keys = Object.keys(target);
          if (keys.every(key => targetChecks.hasOwnProperty(key) &&
                                targetChecks[key](target[key])))
          {
            match = true;
            break;
          }
        }

        if (!match)
        {
          continue;
        }
      }

      if (!notificationToShow || getNumericalSeverity(notification) >
                                 getNumericalSeverity(notificationToShow))
      {
        notificationToShow = notification;
      }
    }

    return notificationToShow;
  }

  /**
   * Invokes the listeners added via
   * <code>{@link Notifications#addShowListener}</code> with the next
   * notification to be shown.
   * @param {?(URL|URLInfo)} [url] The URL to match notifications to.
   */
  showNext(url)
  {
    let notification = this._getNextToShow(url);
    if (notification)
    {
      for (let showListener of this._showListeners)
        showListener(notification);
    }
  }

  /**
   * Marks a notification as shown.
   * @param {string} id The ID of the notification to be marked as shown.
   */
  markAsShown(id)
  {
    let now = Date.now();
    let data = Prefs.notificationdata;

    if (data.shown instanceof Array)
    {
      let newShown = {};
      for (let oldId of data.shown)
        newShown[oldId] = now;
      data.shown = newShown;
    }

    if (typeof data.shown != "object")
      data.shown = {};

    data.shown[id] = now;

    saveNotificationData();
  }

  /**
   * Localizes the texts of the given notification.
   * @param {object} notification The notification.
   * @returns {object} The localized texts.
   */
  getLocalizedTexts(notification)
  {
    let textKeys = ["title", "message"];
    let localizedTexts = {};

    for (let key of textKeys)
    {
      if (key in notification)
      {
        if (typeof notification[key] == "string")
          localizedTexts[key] = notification[key];
        else
          localizedTexts[key] = localize(notification[key], Utils.appLocale);
      }
    }

    return localizedTexts;
  }

  /**
   * Adds a local notification.
   * @param {object} notification The notification to add.
   */
  addNotification(notification)
  {
    if (!this._localNotifications.includes(notification))
      this._localNotifications.push(notification);
  }

  /**
   * Removes an existing local notification.
   * @param {object} notification The notification to remove.
   */
  removeNotification(notification)
  {
    let index = this._localNotifications.indexOf(notification);
    if (index > -1)
      this._localNotifications.splice(index, 1);
  }

  /**
   * A callback function which listens to see if notifications were approved.
   *
   * @callback QuestionListener
   * @param {boolean} approved
   */

  /**
   * Adds a listener for question-type notifications.
   * @param {string} id
   * @param {QuestionListener} listener
   */
  addQuestionListener(id, listener)
  {
    if (!(id in this._questionListeners))
      this._questionListeners[id] = [];
    if (!this._questionListeners[id].includes(listener))
      this._questionListeners[id].push(listener);
  }

  /**
   * Removes a listener that was previously added via
   * <code>{@link Notifications#addQuestionListener}</code>.
   * @param {string} id
   * @param {QuestionListener} listener
   */
  removeQuestionListener(id, listener)
  {
    if (!(id in this._questionListeners))
      return;
    let index = this._questionListeners[id].indexOf(listener);
    if (index > -1)
      this._questionListeners[id].splice(index, 1);
    if (this._questionListeners[id].length == 0)
      delete this._questionListeners[id];
  }

  /**
   * Notifies question listeners about interactions with a notification.
   * @param {string} id Notification ID.
   * @param {boolean} approved Indicator whether notification has been
   *   approved.
   */
  triggerQuestionListeners(id, approved)
  {
    if (!(id in this._questionListeners))
      return;
    let listeners = this._questionListeners[id];
    for (let listener of listeners)
      listener(approved);
  }

  /**
   * Toggles whether notifications of a specific category should be ignored.
   * @param {string} category The notification category identifier.
   * @param {boolean} [forceValue] Whether to force the specified value.
   */
  toggleIgnoreCategory(category, forceValue)
  {
    let categories = Prefs.notifications_ignoredcategories;
    let index = categories.indexOf(category);
    if (index == -1 && forceValue != false)
      categories.push(category);
    else if (index != -1 && forceValue != true)
      categories.splice(index, 1);

    saveNotificationData("notifications_ignoredcategories");
  }
}

/**
 * Regularly fetches notifications and decides which notification to show.
 * @type {Notifications}
 */
exports.notifications = new Notifications();
