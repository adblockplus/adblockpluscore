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
 * @fileOverview Definition of Subscription class and its subclasses.
 */

const {ActiveFilter, BlockingFilter,
       WhitelistFilter, ElemHideBase} = require("./filterClasses");
const {filterNotifier} = require("./filterNotifier");
const {extend} = require("./coreUtils");

/**
 * Abstract base class for filter subscriptions
 *
 * @param {string} url    download location of the subscription
 * @param {string} [title]  title of the filter subscription
 * @constructor
 */
function Subscription(url, title)
{
  this.url = url;

  this._filterText = [];

  if (title)
    this._title = title;

  Subscription.knownSubscriptions.set(url, this);
}
exports.Subscription = Subscription;

Subscription.prototype =
{
  /**
   * Download location of the subscription
   * @type {string}
   */
  url: null,

  /**
   * Type of the subscription
   * @type {?string}
   */
  type: null,

  /**
   * Filter text contained in the filter subscription.
   * @type {Array.<string>}
   * @private
   */
  _filterText: null,

  _title: null,
  _fixedTitle: false,
  _disabled: false,

  /**
   * Title of the filter subscription
   * @type {string}
   */
  get title()
  {
    return this._title;
  },
  set title(value)
  {
    if (value != this._title)
    {
      let oldValue = this._title;
      this._title = value;
      filterNotifier.emit("subscription.title", this, value, oldValue);
    }
    return this._title;
  },

  /**
   * Determines whether the title should be editable
   * @type {boolean}
   */
  get fixedTitle()
  {
    return this._fixedTitle;
  },
  set fixedTitle(value)
  {
    if (value != this._fixedTitle)
    {
      let oldValue = this._fixedTitle;
      this._fixedTitle = value;
      filterNotifier.emit("subscription.fixedTitle", this, value, oldValue);
    }
    return this._fixedTitle;
  },

  /**
   * Defines whether the filters in the subscription should be disabled
   * @type {boolean}
   */
  get disabled()
  {
    return this._disabled;
  },
  set disabled(value)
  {
    if (value != this._disabled)
    {
      let oldValue = this._disabled;
      this._disabled = value;
      filterNotifier.emit("subscription.disabled", this, value, oldValue);
    }
    return this._disabled;
  },

  /**
   * The number of filters in the subscription.
   * @type {number}
   */
  get filterCount()
  {
    return this._filterText.length;
  },

  /**
   * Yields the text for each filter in the subscription.
   * @yields {string}
   */
  *filterText()
  {
    yield* this._filterText;
  },

  /**
   * Returns the filter text at the given 0-based index.
   * @param {number} index
   * @returns {?Filter}
   */
  filterTextAt(index)
  {
    return this._filterText[index] || null;
  },

  /**
   * Returns the 0-based index of the given filter.
   * @param {Filter} filter
   * @param {number} [fromIndex] The index from which to start the search.
   * @return {number}
   */
  searchFilter(filter, fromIndex = 0)
  {
    return this._filterText.indexOf(filter.text, fromIndex);
  },

  /**
   * Removes all filters from the subscription.
   */
  clearFilters()
  {
    this._filterText = [];
  },

  /**
   * Adds a filter to the subscription.
   * @param {Filter} filter
   */
  addFilter(filter)
  {
    this._filterText.push(filter.text);
  },

  /**
   * Adds a filter to the subscription.
   * @param {string} filterText
   */
  addFilterText(filterText)
  {
    this._filterText.push(filterText);
  },

  /**
   * Inserts a filter into the subscription.
   * @param {Filter} filter
   * @param {number} index The index at which to insert the filter.
   */
  insertFilterAt(filter, index)
  {
    this._filterText.splice(index, 0, filter.text);
  },

  /**
   * Deletes a filter from the subscription.
   * @param {number} index The index at which to delete the filter.
   */
  deleteFilterAt(index)
  {
    // Ignore index if out of bounds on the negative side, for consistency.
    if (index < 0)
      return;

    this._filterText.splice(index, 1);
  },

  /**
   * Serializes the subscription for writing out on disk.
   * @yields {string}
   */
  *serialize()
  {
    let {url, type, _title, _fixedTitle, _disabled} = this;

    yield "[Subscription]";
    yield "url=" + url;

    if (type)
      yield "type=" + type;
    if (_title)
      yield "title=" + _title;
    if (_fixedTitle)
      yield "fixedTitle=true";
    if (_disabled)
      yield "disabled=true";
  },

  *serializeFilters()
  {
    let {_filterText} = this;

    yield "[Subscription filters]";

    for (let text of _filterText)
      yield text.replace(/\[/g, "\\[");
  },

  toString()
  {
    return [...this.serialize()].join("\n");
  }
};

/**
 * Cache for known filter subscriptions, maps URL to subscription objects.
 * @type {Map.<string,Subscription>}
 */
Subscription.knownSubscriptions = new Map();

/**
 * Returns a subscription from its URL, creates a new one if necessary.
 * @param {string} url
 *   URL of the subscription
 * @return {Subscription}
 *   subscription or null if the subscription couldn't be created
 */
Subscription.fromURL = function(url)
{
  let subscription = Subscription.knownSubscriptions.get(url);
  if (subscription)
    return subscription;

  if (url[0] != "~")
    return new DownloadableSubscription(url, null);
  return new SpecialSubscription(url);
};

/**
 * Deserializes a subscription
 *
 * @param {Object}  obj
 *   map of serialized properties and their values
 * @return {Subscription}
 *   subscription or null if the subscription couldn't be created
 */
Subscription.fromObject = function(obj)
{
  let result;
  if (obj.url[0] != "~")
  {
    // URL is valid - this is a downloadable subscription
    result = new DownloadableSubscription(obj.url, obj.title);
    if ("type" in obj)
      result.type = obj.type;
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

/**
 * Class for special filter subscriptions (user's filters)
 * @param {string} url see {@link Subscription Subscription()}
 * @param {string} [title]  see {@link Subscription Subscription()}
 * @constructor
 * @augments Subscription
 */
function SpecialSubscription(url, title)
{
  Subscription.call(this, url, title);
}
exports.SpecialSubscription = SpecialSubscription;

SpecialSubscription.prototype = extend(Subscription, {
  /**
   * Filter types that should be added to this subscription by default
   * (entries should correspond to keys in SpecialSubscription.defaultsMap).
   * @type {string[]}
   */
  defaults: null,

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
  },

  /**
   * See Subscription.serialize()
   * @inheritdoc
   */
  *serialize()
  {
    let {defaults, _lastDownload} = this;

    yield* Subscription.prototype.serialize.call(this);

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
});

SpecialSubscription.defaultsMap = new Map([
  ["whitelist", WhitelistFilter],
  ["blocking", BlockingFilter],
  ["elemhide", ElemHideBase]
]);

/**
 * Creates a new user-defined filter group.
 * @param {string} [title]  title of the new filter group
 * @return {SpecialSubscription}
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
 * This group will act as the default group for this filter type.
 * @param {Filter} filter
 * @return {SpecialSubscription}
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

/**
 * Abstract base class for regular filter subscriptions (both
 * internally and externally updated)
 * @param {string} url    see {@link Subscription Subscription()}
 * @param {string} [title]  see {@link Subscription Subscription()}
 * @constructor
 * @augments Subscription
 */
function RegularSubscription(url, title)
{
  Subscription.call(this, url, title || url);
}
exports.RegularSubscription = RegularSubscription;

RegularSubscription.prototype = extend(Subscription, {
  _homepage: null,
  _lastDownload: 0,

  /**
   * Filter subscription homepage if known
   * @type {string}
   */
  get homepage()
  {
    return this._homepage;
  },
  set homepage(value)
  {
    if (value != this._homepage)
    {
      let oldValue = this._homepage;
      this._homepage = value;
      filterNotifier.emit("subscription.homepage", this, value, oldValue);
    }
    return this._homepage;
  },

  /**
   * Time of the last subscription download (in seconds since the
   * beginning of the epoch)
   * @type {number}
   */
  get lastDownload()
  {
    return this._lastDownload;
  },
  set lastDownload(value)
  {
    if (value != this._lastDownload)
    {
      let oldValue = this._lastDownload;
      this._lastDownload = value;
      filterNotifier.emit("subscription.lastDownload", this, value, oldValue);
    }
    return this._lastDownload;
  },

  /**
   * See Subscription.serialize()
   * @inheritdoc
   */
  *serialize()
  {
    let {_homepage, _lastDownload} = this;

    yield* Subscription.prototype.serialize.call(this);

    if (_homepage)
      yield "homepage=" + _homepage;
    if (_lastDownload)
      yield "lastDownload=" + _lastDownload;
  }
});

/**
 * Class for filter subscriptions updated externally (by other extension)
 * @param {string} url    see {@link Subscription Subscription()}
 * @param {string} [title]  see {@link Subscription Subscription()}
 * @constructor
 * @augments RegularSubscription
 */
function ExternalSubscription(url, title)
{
  RegularSubscription.call(this, url, title);
}
exports.ExternalSubscription = ExternalSubscription;

ExternalSubscription.prototype = extend(RegularSubscription, {
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
});

/**
 * Class for filter subscriptions updated externally (by other extension)
 * @param {string} url  see {@link Subscription Subscription()}
 * @param {string} [title]  see {@link Subscription Subscription()}
 * @constructor
 * @augments RegularSubscription
 */
function DownloadableSubscription(url, title)
{
  RegularSubscription.call(this, url, title);
}
exports.DownloadableSubscription = DownloadableSubscription;

DownloadableSubscription.prototype = extend(RegularSubscription, {
  _downloadStatus: null,
  _lastCheck: 0,
  _errors: 0,

  /**
   * Status of the last download (ID of a string)
   * @type {string}
   */
  get downloadStatus()
  {
    return this._downloadStatus;
  },
  set downloadStatus(value)
  {
    let oldValue = this._downloadStatus;
    this._downloadStatus = value;
    filterNotifier.emit("subscription.downloadStatus", this, value, oldValue);
    return this._downloadStatus;
  },

  /**
   * Time of the last successful download (in seconds since the beginning of the
   * epoch).
   */
  lastSuccess: 0,

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
  },
  set lastCheck(value)
  {
    if (value != this._lastCheck)
    {
      let oldValue = this._lastCheck;
      this._lastCheck = value;
      filterNotifier.emit("subscription.lastCheck", this, value, oldValue);
    }
    return this._lastCheck;
  },

  /**
   * Hard expiration time of the filter subscription (in seconds since
   * the beginning of the epoch)
   * @type {number}
   */
  expires: 0,

  /**
   * Soft expiration time of the filter subscription (in seconds since
   * the beginning of the epoch)
   * @type {number}
   */
  softExpiration: 0,

  /**
   * Number of download failures since last success
   * @type {number}
   */
  get errors()
  {
    return this._errors;
  },
  set errors(value)
  {
    if (value != this._errors)
    {
      let oldValue = this._errors;
      this._errors = value;
      filterNotifier.emit("subscription.errors", this, value, oldValue);
    }
    return this._errors;
  },

  /**
   * Version of the subscription data retrieved on last successful download
   * @type {number}
   */
  version: 0,

  /**
   * Minimal Adblock Plus version required for this subscription
   * @type {string}
   */
  requiredVersion: null,

  /**
   * Number indicating how often the object was downloaded.
   * @type {number}
   */
  downloadCount: 0,

  /**
   * See Subscription.serialize()
   * @inheritdoc
   */
  *serialize()
  {
    let {downloadStatus, lastSuccess, lastCheck, expires,
         softExpiration, errors, version, requiredVersion,
         downloadCount} = this;

    yield* RegularSubscription.prototype.serialize.call(this);

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
});
