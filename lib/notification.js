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
 * @fileOverview Handles notifications.
 */

const {Prefs} = require("prefs");
const {Downloader, Downloadable,
       MILLIS_IN_MINUTE, MILLIS_IN_HOUR,
       MILLIS_IN_DAY} = require("./downloader");
const {Utils} = require("utils");
const {Matcher, defaultMatcher} = require("./matcher");
const {Filter, RegExpFilter, WhitelistFilter} = require("./filterClasses");
const {compareVersions} = require("./versions");

const INITIAL_DELAY = 1 * MILLIS_IN_MINUTE;
const CHECK_INTERVAL = 1 * MILLIS_IN_HOUR;
const EXPIRATION_INTERVAL = 1 * MILLIS_IN_DAY;
const TYPE = {
  information: 0,
  question: 1,
  relentless: 2,
  critical: 3
};

let showListeners = [];
let questionListeners = {};

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

function getNumericalSeverity(notification)
{
  if (notification.type in TYPE)
    return TYPE[notification.type];
  return TYPE.information;
}

function saveNotificationData()
{
  // HACK: JSON values aren't saved unless they are assigned a different object.
  Prefs.notificationdata = JSON.parse(JSON.stringify(Prefs.notificationdata));
}

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
 * The object providing actual downloading functionality.
 * @type {Downloader}
 */
let downloader = null;
let localData = [];

/**
 * Regularly fetches notifications and decides which to show.
 * @class
 */
let Notification = exports.Notification =
{
  /**
   * Called on module startup.
   */
  init()
  {
    downloader = new Downloader(this._getDownloadables.bind(this),
                                INITIAL_DELAY, CHECK_INTERVAL);
    downloader.onExpirationChange = this._onExpirationChange.bind(this);
    downloader.onDownloadSuccess = this._onDownloadSuccess.bind(this);
    downloader.onDownloadError = this._onDownloadError.bind(this);

    Prefs.on("blocked_total", this._onBlockedTotal.bind(this));
  },

  /**
   * Yields a Downloadable instances for the notifications download.
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
    if (typeof Prefs.notificationdata.lastError === "number")
      downloadable.lastError = Prefs.notificationdata.lastError;
    if (typeof Prefs.notificationdata.lastCheck === "number")
      downloadable.lastCheck = Prefs.notificationdata.lastCheck;
    if (typeof Prefs.notificationdata.data === "object" &&
        "version" in Prefs.notificationdata.data)
    {
      downloadable.lastVersion = Prefs.notificationdata.data.version;
    }
    if (typeof Prefs.notificationdata.softExpiration === "number")
      downloadable.softExpiration = Prefs.notificationdata.softExpiration;
    if (typeof Prefs.notificationdata.hardExpiration === "number")
      downloadable.hardExpiration = Prefs.notificationdata.hardExpiration;
    if (typeof Prefs.notificationdata.downloadCount === "number")
      downloadable.downloadCount = Prefs.notificationdata.downloadCount;
    yield downloadable;
  },

  _onExpirationChange(downloadable)
  {
    Prefs.notificationdata.lastCheck = downloadable.lastCheck;
    Prefs.notificationdata.softExpiration = downloadable.softExpiration;
    Prefs.notificationdata.hardExpiration = downloadable.hardExpiration;
    saveNotificationData();
  },

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
    catch (e)
    {
      Utils.logError(e);
      errorCallback("synchronize_invalid_data");
      return;
    }

    Prefs.notificationdata.lastError = 0;
    Prefs.notificationdata.downloadStatus = "synchronize_ok";
    [
      Prefs.notificationdata.softExpiration,
      Prefs.notificationdata.hardExpiration
    ] = downloader.processExpirationInterval(EXPIRATION_INTERVAL);
    Prefs.notificationdata.downloadCount = downloadable.downloadCount;
    saveNotificationData();

    Notification.showNext();
  },

  _onDownloadError(downloadable, downloadURL, error, responseStatus,
                   redirectCallback)
  {
    Prefs.notificationdata.lastError = Date.now();
    Prefs.notificationdata.downloadStatus = error;
    saveNotificationData();
  },

  _onBlockedTotal()
  {
    Notification.showNext();
  },

  /**
   * Adds a listener for notifications to be shown.
   * @param {Function} listener Listener to be invoked when a notification is
   *                   to be shown
   */
  addShowListener(listener)
  {
    if (showListeners.indexOf(listener) == -1)
      showListeners.push(listener);
  },

  /**
   * Removes the supplied listener.
   * @param {Function} listener Listener that was added via addShowListener()
   */
  removeShowListener(listener)
  {
    let index = showListeners.indexOf(listener);
    if (index != -1)
      showListeners.splice(index, 1);
  },

  /**
   * Determines which notification is to be shown next.
   * @param {?(URL|URLInfo)} [url] URL to match notifications to (optional)
   * @return {Object} notification to be shown, or null if there is none
   */
  _getNextToShow(url)
  {
    let remoteData = [];
    if (typeof Prefs.notificationdata.data == "object" &&
        Prefs.notificationdata.data.notifications instanceof Array)
    {
      remoteData = Prefs.notificationdata.data.notifications;
    }

    let notifications = localData.concat(remoteData);
    if (notifications.length === 0)
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
      if (typeof notification.type === "undefined" ||
          notification.type !== "critical")
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
            continue;
        }

        if (notification.type !== "relentless" &&
            Prefs.notifications_ignoredcategories.indexOf("*") != -1)
        {
          continue;
        }
      }

      if (url || notification.urlFilters instanceof Array)
      {
        if (Prefs.enabled && url && notification.urlFilters instanceof Array)
        {
          let exception = defaultMatcher.matchesAny(
            url, RegExpFilter.typeMap.DOCUMENT, url.hostname, null
          );
          if (exception instanceof WhitelistFilter)
            continue;

          let matcher = new Matcher();
          for (let urlFilter of notification.urlFilters)
            matcher.add(Filter.fromText(urlFilter));
          if (!matcher.matchesAny(url, RegExpFilter.typeMap.DOCUMENT,
                                  url.hostname, null))
          {
            continue;
          }
        }
        else
          continue;
      }

      if (notification.targets instanceof Array)
      {
        let match = false;

        for (let target of notification.targets)
        {
          if (Object.keys(target).every(key =>
              targetChecks.hasOwnProperty(key) &&
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

      if (!notificationToShow ||
          getNumericalSeverity(notification) >
            getNumericalSeverity(notificationToShow))
        notificationToShow = notification;
    }

    return notificationToShow;
  },

  /**
   * Invokes the listeners added via addShowListener() with the next
   * notification to be shown.
   * @param {?(URL|URLInfo)} [url] URL to match notifications to (optional)
   */
  showNext(url)
  {
    let notification = Notification._getNextToShow(url);
    if (notification)
    {
      for (let showListener of showListeners)
        showListener(notification);
    }
  },

  /**
   * Marks a notification as shown.
   * @param {string} id ID of the notification to be marked as shown
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
  },

  /**
   * Localizes the texts of the supplied notification.
   * @param {Object} notification notification to translate
   * @return {Object} the translated texts
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
  },

  /**
   * Adds a local notification.
   * @param {Object} notification notification to add
   */
  addNotification(notification)
  {
    if (localData.indexOf(notification) == -1)
      localData.push(notification);
  },

  /**
   * Removes an existing local notification.
   * @param {Object} notification notification to remove
   */
  removeNotification(notification)
  {
    let index = localData.indexOf(notification);
    if (index > -1)
      localData.splice(index, 1);
  },

  /**
   * A callback function which listens to see if notifications were approved.
   *
   * @callback QuestionListener
   * @param {boolean} approved
   */

  /**
   * Adds a listener for question-type notifications
   * @param {string} id
   * @param {QuestionListener} listener
   */
  addQuestionListener(id, listener)
  {
    if (!(id in questionListeners))
      questionListeners[id] = [];
    if (questionListeners[id].indexOf(listener) === -1)
      questionListeners[id].push(listener);
  },

  /**
   * Removes a listener that was previously added via addQuestionListener
   * @param {string} id
   * @param {QuestionListener} listener
   */
  removeQuestionListener(id, listener)
  {
    if (!(id in questionListeners))
      return;
    let index = questionListeners[id].indexOf(listener);
    if (index > -1)
      questionListeners[id].splice(index, 1);
    if (questionListeners[id].length === 0)
      delete questionListeners[id];
  },

  /**
   * Notifies question listeners about interactions with a notification
   * @param {string} id notification ID
   * @param {boolean} approved indicator whether notification has been approved
   */
  triggerQuestionListeners(id, approved)
  {
    if (!(id in questionListeners))
      return;
    let listeners = questionListeners[id];
    for (let listener of listeners)
      listener(approved);
  },

  /**
   * Toggles whether notifications of a specific category should be ignored
   * @param {string} category notification category identifier
   * @param {boolean} [forceValue] force specified value
   */
  toggleIgnoreCategory(category, forceValue)
  {
    let categories = Prefs.notifications_ignoredcategories;
    let index = categories.indexOf(category);
    if (index == -1 && forceValue !== false)
      categories.push(category);
    else if (index != -1 && forceValue !== true)
      categories.splice(index, 1);

    // HACK: JSON values aren't saved unless they are assigned a
    // different object.
    Prefs.notifications_ignoredcategories =
      JSON.parse(JSON.stringify(categories));
  }
};
Notification.init();
