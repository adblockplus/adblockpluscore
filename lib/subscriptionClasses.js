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
 * @fileOverview Definition of Subscription class and its subclasses.
 */

const {recommendations} = require("./recommendations");
const {ActiveFilter, BlockingFilter,
       WhitelistFilter, ElemHideBase} = require("./filterClasses");
const {filterNotifier} = require("./filterNotifier");

/**
 * Subscription types by URL.
 *
 * @type {Map.<string, string>}
 */
let typesByURL = new Map(
  (function*()
  {
    for (let {type, url} of recommendations())
      yield [url, type];
  })()
);

let Subscription =
/**
 * Abstract base class for filter subscriptions
 */
exports.Subscription = class Subscription
{
  /**
   * @param {string} url    download location of the subscription
   * @param {string} [title]  title of the filter subscription
   * @private
   */
  constructor(url, title)
  {
    /**
     * Download location of the subscription
     * @type {string}
     */
    this.url = url;

    this._type = null;

    /**
     * Filter text contained in the filter subscription.
     * @type {Array.<string>}
     * @private
     */
    this._filterText = [];

    /**
     * A searchable index of filter text in the filter subscription.
     * @type {Set.<string>}
     * @private
     */
    this._filterTextIndex = new Set();

    if (title)
      this._title = title;
    else
      this._title = null;

    this._fixedTitle = false;
    this._disabled = false;

    Subscription.knownSubscriptions.set(url, this);
  }

  /**
   * Type of the subscription
   * @type {?string}
   */
  get type()
  {
    return this._type;
  }

  /**
   * Title of the filter subscription
   * @type {string}
   */
  get title()
  {
    return this._title;
  }

  set title(value)
  {
    if (value != this._title)
    {
      let oldValue = this._title;
      this._title = value;
      filterNotifier.emit("subscription.title", this, value, oldValue);
    }
  }

  /**
   * Determines whether the title should be editable
   * @type {boolean}
   */
  get fixedTitle()
  {
    return this._fixedTitle;
  }

  set fixedTitle(value)
  {
    if (value != this._fixedTitle)
    {
      let oldValue = this._fixedTitle;
      this._fixedTitle = value;
      filterNotifier.emit("subscription.fixedTitle", this, value, oldValue);
    }
  }

  /**
   * Defines whether the filters in the subscription should be disabled
   * @type {boolean}
   */
  get disabled()
  {
    return this._disabled;
  }

  set disabled(value)
  {
    if (value != this._disabled)
    {
      let oldValue = this._disabled;
      this._disabled = value;
      filterNotifier.emit("subscription.disabled", this, value, oldValue);
    }
  }

  /**
   * The number of filters in the subscription.
   * @type {number}
   */
  get filterCount()
  {
    return this._filterText.length;
  }

  /**
   * Returns an iterator that yields the text for each filter in the
   * subscription.
   * @returns {Iterator.<string>}
   */
  filterText()
  {
    return this._filterText[Symbol.iterator]();
  }

  /**
   * Checks whether the subscription has the given filter text.
   * @param {string} filterText
   * @returns {boolean}
   * @package
   */
  hasFilterText(filterText)
  {
    return this._filterTextIndex.has(filterText);
  }

  /**
   * Returns the filter text at the given 0-based index.
   * @param {number} index
   * @returns {?module:filterClasses.Filter}
   */
  filterTextAt(index)
  {
    return this._filterText[index] || null;
  }

  /**
   * Returns the 0-based index of the given filter.
   * @param {module:filterClasses.Filter} filter
   * @param {number} [fromIndex] The index from which to start the search.
   * @return {number}
   */
  findFilterIndex(filter, fromIndex = 0)
  {
    return this._filterText.indexOf(filter.text, fromIndex);
  }

  /**
   * Removes all filters from the subscription.
   */
  clearFilters()
  {
    this._filterText = [];
    this._filterTextIndex.clear();
  }

  /**
   * Adds a filter to the subscription.
   * @param {Filter} filter
   */
  addFilter(filter)
  {
    this._filterText.push(filter.text);
    this._filterTextIndex.add(filter.text);
  }

  /**
   * Inserts a filter into the subscription.
   * @param {module:filterClasses.Filter} filter
   * @param {number} index The index at which to insert the filter.
   */
  insertFilterAt(filter, index)
  {
    this._filterText.splice(index, 0, filter.text);
    this._filterTextIndex.add(filter.text);
  }

  /**
   * Deletes a filter from the subscription.
   * @param {number} index The index at which to delete the filter.
   */
  deleteFilterAt(index)
  {
    // Ignore index if out of bounds on the negative side, for consistency.
    if (index < 0)
      return;

    let [filterText] = this._filterText.splice(index, 1);
    if (!this._filterText.includes(filterText))
      this._filterTextIndex.delete(filterText);
  }

  /**
   * Updates the filter text of the subscription.
   * @param {Array.<string>} filterText The new filter text.
   * @returns {{added: Array.<string>, removed: Array.<string>}} An object
   *   containing two lists of the text of added and removed filters
   *   respectively.
   * @package
   */
  updateFilterText(filterText)
  {
    let added = [];
    let removed = [];

    if (this._filterText.length == 0)
    {
      added = [...filterText];
    }
    else if (filterText.length > 0)
    {
      for (let text of filterText)
      {
        if (!this._filterTextIndex.has(text))
          added.push(text);
      }
    }

    this._filterTextIndex = new Set(filterText);

    if (filterText.length == 0)
    {
      removed = [...this._filterText];
    }
    else if (this._filterText.length > 0)
    {
      for (let text of this._filterText)
      {
        if (!this._filterTextIndex.has(text))
          removed.push(text);
      }
    }

    this._filterText = [...filterText];

    return {added, removed};
  }

  /**
   * Serializes the subscription for writing out on disk.
   * @yields {string}
   */
  *serialize()
  {
    let {url, _title, _fixedTitle, _disabled} = this;

    yield "[Subscription]";
    yield "url=" + url;

    if (_title)
      yield "title=" + _title;
    if (_fixedTitle)
      yield "fixedTitle=true";
    if (_disabled)
      yield "disabled=true";
  }

  *serializeFilters()
  {
    let {_filterText} = this;

    yield "[Subscription filters]";

    for (let text of _filterText)
      yield text.replace(/\[/g, "\\[");
  }

  toString()
  {
    return [...this.serialize()].join("\n");
  }
};

/**
 * Cache for known filter subscriptions, maps URL to subscription objects.
 * @type {Map.<string,module:subscriptionClasses.Subscription>}
 */
Subscription.knownSubscriptions = new Map();

/**
 * Returns a subscription from its URL, creates a new one if necessary.
 * @param {string} url
 *   URL of the subscription
 * @return {module:subscriptionClasses.Subscription}
 *   subscription or null if the subscription couldn't be created
 */
Subscription.fromURL = function(url)
{
  let subscription = Subscription.knownSubscriptions.get(url);
  if (subscription)
    return subscription;

  if (url[0] != "~")
  {
    subscription = new DownloadableSubscription(url, null);

    let type = typesByURL.get(url);
    if (typeof type != "undefined")
      subscription._type = type;

    return subscription;
  }

  return new SpecialSubscription(url);
};

/**
 * Deserializes a subscription
 *
 * @param {Object}  obj
 *   map of serialized properties and their values
 * @return {module:subscriptionClasses.Subscription}
 *   subscription or null if the subscription couldn't be created
 */
Subscription.fromObject = function(obj)
{
  let result;
  if (obj.url[0] != "~")
  {
    // URL is valid - this is a downloadable subscription
    result = new DownloadableSubscription(obj.url, obj.title);
    if ("downloadStatus" in obj)
      result._downloadStatus = obj.downloadStatus;
    if ("lastSuccess" in obj)
      result.lastSuccess = parseInt(obj.lastSuccess, 10) || 0;
    if ("lastCheck" in obj)
      result._lastCheck = parseInt(obj.lastCheck, 10) || 0;
    if ("expires" in obj)
      result.expires = parseInt(obj.expires, 10) || 0;
    if ("softExpiration" in obj)
      result.softExpiration = parseInt(obj.softExpiration, 10) || 0;
    if ("errors" in obj)
      result._errors = parseInt(obj.errors, 10) || 0;
    if ("version" in obj)
      result.version = parseInt(obj.version, 10) || 0;
    if ("requiredVersion" in obj)
      result.requiredVersion = obj.requiredVersion;
    if ("homepage" in obj)
      result._homepage = obj.homepage;
    if ("lastDownload" in obj)
      result._lastDownload = parseInt(obj.lastDownload, 10) || 0;
    if ("downloadCount" in obj)
      result.downloadCount = parseInt(obj.downloadCount, 10) || 0;

    let type = typesByURL.get(obj.url);
    if (typeof type != "undefined")
      result._type = type;
  }
  else
  {
    result = new SpecialSubscription(obj.url, obj.title);
    if ("defaults" in obj)
      result.defaults = obj.defaults.split(" ");
  }
  if ("fixedTitle" in obj)
    result._fixedTitle = (obj.fixedTitle == "true");
  if ("disabled" in obj)
    result._disabled = (obj.disabled == "true");

  return result;
};

let SpecialSubscription =
/**
 * Class for special filter subscriptions (user's filters)
 */
exports.SpecialSubscription = class SpecialSubscription extends Subscription
{
  /**
   * @param {string} url see
   *   {@link module:subscriptionClasses.Subscription Subscription()}
   * @param {string} [title]  see
   *   {@link module:subscriptionClasses.Subscription Subscription()}
   * @augments module:subscriptionClasses.Subscription
   * @private
   */
  constructor(url, title)
  {
    super(url, title);

    /**
     * Filter types that should be added to this subscription by default
     * (entries should correspond to keys in SpecialSubscription.defaultsMap).
     * @type {string[]}
     */
    this.defaults = null;
  }

  /**
   * Tests whether a filter should be added to this group by default
   * @param {Filter} filter filter to be tested
   * @return {boolean}
   */
  isDefaultFor(filter)
  {
    if (this.defaults && this.defaults.length)
    {
      for (let type of this.defaults)
      {
        if (filter instanceof SpecialSubscription.defaultsMap.get(type))
          return true;
        if (!(filter instanceof ActiveFilter) && type == "blocking")
          return true;
      }
    }

    return false;
  }

  /**
   * See Subscription.serialize()
   * @inheritdoc
   */
  *serialize()
  {
    let {defaults, _lastDownload} = this;

    yield* super.serialize();

    if (defaults)
    {
      yield "defaults=" +
            defaults.filter(
              type => SpecialSubscription.defaultsMap.has(type)
            ).join(" ");
    }
    if (_lastDownload)
      yield "lastDownload=" + _lastDownload;
  }
};

SpecialSubscription.defaultsMap = new Map([
  ["whitelist", WhitelistFilter],
  ["blocking", BlockingFilter],
  ["elemhide", ElemHideBase]
]);

/**
 * Creates a new user-defined filter group.
 * @param {string} [title]  title of the new filter group
 * @return {module:subscriptionClasses.SpecialSubscription}
 */
SpecialSubscription.create = function(title)
{
  let url;
  do
  {
    url = "~user~" + Math.round(Math.random() * 1000000);
  } while (Subscription.knownSubscriptions.has(url));
  return new SpecialSubscription(url, title);
};

/**
 * Creates a new user-defined filter group and adds the given filter to it.
 *
 * This group will act as the default group for this filter type.
 *
 * @param {module:filterClasses.Filter} filter
 *
 * @return {module:subscriptionClasses.SpecialSubscription}
 */
SpecialSubscription.createForFilter = function(filter)
{
  let subscription = SpecialSubscription.create();
  subscription.addFilter(filter);
  for (let [type, class_] of SpecialSubscription.defaultsMap)
  {
    if (filter instanceof class_)
      subscription.defaults = [type];
  }
  if (!subscription.defaults)
    subscription.defaults = ["blocking"];
  return subscription;
};

let RegularSubscription =
/**
 * Abstract base class for regular filter subscriptions (both
 * internally and externally updated)
 */
exports.RegularSubscription = class RegularSubscription extends Subscription
{
  /**
   * @param {string} url    see
   *   {@link module:subscriptionClasses.Subscription Subscription()}
   * @param {string} [title]  see
   *   {@link module:subscriptionClasses.Subscription Subscription()}
   * @augments module:subscriptionClasses.Subscription
   * @private
   */
  constructor(url, title)
  {
    super(url, title || url);

    this._homepage = null;
    this._lastDownload = 0;
  }

  /**
   * Filter subscription homepage if known
   * @type {string}
   */
  get homepage()
  {
    return this._homepage;
  }

  set homepage(value)
  {
    if (value != this._homepage)
    {
      let oldValue = this._homepage;
      this._homepage = value;
      filterNotifier.emit("subscription.homepage", this, value, oldValue);
    }
  }

  /**
   * Time of the last subscription download (in seconds since the
   * beginning of the epoch)
   * @type {number}
   */
  get lastDownload()
  {
    return this._lastDownload;
  }

  set lastDownload(value)
  {
    if (value != this._lastDownload)
    {
      let oldValue = this._lastDownload;
      this._lastDownload = value;
      filterNotifier.emit("subscription.lastDownload", this, value, oldValue);
    }
  }

  /**
   * See Subscription.serialize()
   * @inheritdoc
   */
  *serialize()
  {
    let {_homepage, _lastDownload} = this;

    yield* super.serialize();

    if (_homepage)
      yield "homepage=" + _homepage;
    if (_lastDownload)
      yield "lastDownload=" + _lastDownload;
  }
};

/**
 * Class for filter subscriptions updated externally (by other extension)
 */
exports.ExternalSubscription =
class ExternalSubscription extends RegularSubscription
{
  /**
   * @param {string} url    see
   *   {@link module:subscriptionClasses.Subscription Subscription()}
   * @param {string} [title]  see
   *   {@link module:subscriptionClasses.Subscription Subscription()}
   * @augments module:subscriptionClasses.RegularSubscription
   * @private
   */
  constructor(url, title)
  {
    super(url, title);
  }

  /**
   * See Subscription.serialize()
   * @inheritdoc
   */
  *serialize() // eslint-disable-line require-yield
  {
    throw new Error(
      "Unexpected call, external subscriptions should not be serialized"
    );
  }
};

let DownloadableSubscription =
/**
 * Class for filter subscriptions updated externally (by other extension)
 */
exports.DownloadableSubscription =
class DownloadableSubscription extends RegularSubscription
{
  /**
   * @param {string} url  see
   *   {@link module:subscriptionClasses.Subscription Subscription()}
   * @param {string} [title]  see
   *   {@link module:subscriptionClasses.Subscription Subscription()}
   * @augments module:subscriptionClasses.RegularSubscription
   * @private
   */
  constructor(url, title)
  {
    super(url, title);

    this._downloadStatus = null;
    this._lastCheck = 0;
    this._errors = 0;

    /**
     * Time of the last successful download (in seconds since the beginning of
     * the epoch).
     */
    this.lastSuccess = 0;

    /**
     * Hard expiration time of the filter subscription (in seconds since
     * the beginning of the epoch)
     * @type {number}
     */
    this.expires = 0;

    /**
     * Soft expiration time of the filter subscription (in seconds since
     * the beginning of the epoch)
     * @type {number}
     */
    this.softExpiration = 0;

    /**
     * Version of the subscription data retrieved on last successful download
     * @type {number}
     */
    this.version = 0;

    /**
     * Minimal Adblock Plus version required for this subscription
     * @type {string}
     */
    this.requiredVersion = null;

    /**
     * Number indicating how often the object was downloaded.
     * @type {number}
     */
    this.downloadCount = 0;
  }

  /**
   * Status of the last download (ID of a string)
   * @type {string}
   */
  get downloadStatus()
  {
    return this._downloadStatus;
  }

  set downloadStatus(value)
  {
    let oldValue = this._downloadStatus;
    this._downloadStatus = value;
    filterNotifier.emit("subscription.downloadStatus", this, value, oldValue);
  }

  /**
   * Time when the subscription was considered for an update last time
   * (in seconds since the beginning of the epoch). This will be used
   * to increase softExpiration if the user doesn't use Adblock Plus
   * for some time.
   * @type {number}
   */
  get lastCheck()
  {
    return this._lastCheck;
  }

  set lastCheck(value)
  {
    if (value != this._lastCheck)
    {
      let oldValue = this._lastCheck;
      this._lastCheck = value;
      filterNotifier.emit("subscription.lastCheck", this, value, oldValue);
    }
  }

  /**
   * Number of download failures since last success
   * @type {number}
   */
  get errors()
  {
    return this._errors;
  }

  set errors(value)
  {
    if (value != this._errors)
    {
      let oldValue = this._errors;
      this._errors = value;
      filterNotifier.emit("subscription.errors", this, value, oldValue);
    }
  }

  /**
   * See Subscription.serialize()
   * @inheritdoc
   */
  *serialize()
  {
    let {downloadStatus, lastSuccess, lastCheck, expires,
         softExpiration, errors, version, requiredVersion,
         downloadCount} = this;

    yield* super.serialize();

    if (downloadStatus)
      yield "downloadStatus=" + downloadStatus;
    if (lastSuccess)
      yield "lastSuccess=" + lastSuccess;
    if (lastCheck)
      yield "lastCheck=" + lastCheck;
    if (expires)
      yield "expires=" + expires;
    if (softExpiration)
      yield "softExpiration=" + softExpiration;
    if (errors)
      yield "errors=" + errors;
    if (version)
      yield "version=" + version;
    if (requiredVersion)
      yield "requiredVersion=" + requiredVersion;
    if (downloadCount)
      yield "downloadCount=" + downloadCount;
  }
};
