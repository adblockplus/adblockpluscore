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
 * @file Definition of Subscription class and its subclasses.
 */

const {recommendations} = require("./recommendations");
const {isActiveFilter} = require("./filterClasses");
const {filterNotifier} = require("./filterNotifier");
const {Downloader} = require("./downloader");
const {profiler} = require("./profiler");

let _recommendationsByURL = null;

/**
 * Subscription recommendation by URL.
 *
 * @returns {Map.<string, Recommendation>}
 */
function recommendationsByURL() {
  if (!_recommendationsByURL) {
    _recommendationsByURL = new Map(
      (function*() {
        for (let recommendation of recommendations())
          yield [recommendation.url, recommendation];
      })()
    );
  }
  return _recommendationsByURL;
}

let _urlByMv2URL = null;

/**
 * Subscription URL by mv2_url.
 *
 * @returns {Map.<string, string>}
 */
function urlByMv2URL() {
  if (!_urlByMv2URL) {
    _urlByMv2URL = new Map(
      (function*() {
        for (let {mv2URL, url} of recommendations()) {
          if (mv2URL)
            yield [mv2URL, url];
        }
      })()
    );
  }
  return _urlByMv2URL;
}

let Subscription =
/**
 * The `Subscription` class represents a filter subscription.
 * @abstract
 */
exports.Subscription = class Subscription {
  /**
   * Creates a `Subscription` object.
   * @param {string} url The URL of the subscription.
   * @param {string} [title] The title of the subscription.
   * @private
   */
  constructor(url, title) {
    /**
     * The URL of the subscription.
     * @type {string}
     * @see module:subscriptionClasses.Subscription#url
     * @private
     */
    this._url = url;

    /**
     * Whether the URL of the subscription is a valid subscription URL.
     * @type {boolean}
     * @private
     * @see module:subscriptionClasses.Subscription#valid
     */
    this._urlValid = Subscription.isValidURL(url);

    let recommendation = recommendationsByURL().get(url);
    /**
     * The type of the subscription.
     * @type {?string}
     * @default <code>null</code>
     * @private
     * @see module:subscriptionClasses.Subscription#type
     */
    this._type = recommendation ? recommendation.type : null;

    /**
     * The id (UUID) of the subscription.
     * @type {?string}
     * @default <code>null</code>
     * @private
     */
    this._id = recommendation ? recommendation.id : null;

    /**
     * Filter text contained in the subscription.
     * @type {Array.<string>}
     * @private
     */
    this._filterText = [];

    /**
     * A searchable index of filter text in the subscription.
     * @type {Set.<string>}
     * @private
     */
    this._filterTextIndex = new Set();

    /**
     * The title of the subscription.
     * @type {?string}
     * @default <code>null</code>
     * @private
     * @see module:subscriptionClasses.Subscription#title
     */
    this._title = null;

    if (title)
      this._title = title;

    /**
     * Whether the title of the subscription is non-editable.
     * @type {boolean}
     * @default <code>false</code>
     * @private
     * @see module:subscriptionClasses.Subscription#fixedTitle
     */
    this._fixedTitle = false;

    /**
     * Whether the subscription is disabled.
     * @type {boolean}
     * @default <code>false</code>
     * @private
     * @see module:subscriptionClasses.Subscription#disabled
     */
    this._disabled = false;

    Subscription.knownSubscriptions.set(url, this);
  }

  /**
   * The id (UUID) of the subscription.
   * @type {string}
   */
  get id() {
    return this._id;
  }

  /**
   * The URL of the subscription.
   * @type {string}
   */
  get url() {
    return this._url;
  }

  /**
   * Whether the subscription is valid.
   * @type {boolean}
   * @package
   */
  get valid() {
    // This should return a value based on Subscription#_urlValid after
    // https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/753
    return true;
  }

  /**
   * The type of the subscription.
   * @type {?string}
   * @default <code>null</code>
   */
  get type() {
    return this._type;
  }

  /**
   * True if this subscription can load filters that require
   * privileged access, like snippets.
   * @type {bool}
   */
  get privileged() {
    return this.type === "circumvention";
  }

  /**
   * The title of the subscription.
   * @type {string}
   */
  get title() {
    return this._title;
  }

  set title(value) {
    if (value != this._title) {
      let oldValue = this._title;
      this._title = value;
      filterNotifier.emit("subscription.title", this, value, oldValue);
    }
  }

  /**
   * Whether the title of the subscription is non-editable.
   * @type {boolean}
   * @default <code>false</code>
   */
  get fixedTitle() {
    return this._fixedTitle;
  }

  set fixedTitle(value) {
    if (value != this._fixedTitle) {
      let oldValue = this._fixedTitle;
      this._fixedTitle = value;
      filterNotifier.emit("subscription.fixedTitle", this, value, oldValue);
    }
  }

  /**
   * Whether the subscription is downloadable.
   * @type {boolean}
   * @default <code>false</code>
   */
  get downloadable() {
    return false;
  }

  /**
   * Whether the subscription is disabled.
   * @type {boolean}
   * @default <code>false</code>
   */
  get disabled() {
    return this._disabled;
  }

  set disabled(value) {
    if (value != this._disabled) {
      let oldValue = this._disabled;
      this._disabled = value;
      filterNotifier.emit("subscription.disabled", this, value, oldValue);
    }
  }

  /**
   * The number of filters in the subscription.
   * @type {number}
   * @default <code>0</code>
   */
  get filterCount() {
    return this._filterText.length;
  }

  /**
   * Returns an iterator that yields the text for each filter in the
   * subscription.
   * @returns {Iterator.<string>}
   */
  filterText() {
    return this._filterText[Symbol.iterator]();
  }

  /**
   * Set the filter text, and reset the index. Call this before adding
   * to the storage.
   *
   * It is important to not call this beside the initialisation of the
   * subscription as it doesn't notify of changes
   *
   * @param {Array.<string>} text The text strings.
   *
   * An error will be thrown if `text` isn't an array.
   */
  setFilterText(text) {
    if (!Array.isArray(text))
      throw new Error("setFilterText() must be called with an Array");

    this._filterText = [...text];
    this._filterTextIndex = new Set(this._filterText);
  }

  /**
   * Checks whether the subscription has the given filter text.
   * @param {string} filterText The filter text.
   * @returns {boolean} Whether the subscription has the filter text.
   * @package
   */
  hasFilterText(filterText) {
    return this._filterTextIndex.has(filterText);
  }

  /**
   * Returns the filter text at the given `0`-based index.
   * @param {number} index The `0`-based index. If the index is out of bounds,
   *   the return value is `null`.
   * @returns {?module:filterClasses.Filter} The filter text.
   */
  filterTextAt(index) {
    return this._filterText[index] || null;
  }

  /**
   * Returns the `0`-based index of the given filter.
   *
   * @param {module:filterClasses.Filter} filter The filter.
   * @param {number} [fromIndex] The `0`-based index from which to start the
   *   search.
   *
   * @returns {number} The `0`-based index at which the filter is found. If the
   *   filter is not found in the subscription, the return value is `-1`.
   */
  findFilterIndex(filter, fromIndex = 0) {
    return this._filterText.indexOf(filter.text, fromIndex);
  }

  /**
   * Removes all filters from the subscription.
   */
  clearFilters() {
    this._filterText = [];
    this._filterTextIndex.clear();
  }

  /**
   * Adds a filter to the subscription.
   * @param {Filter} filter The filter.
   */
  addFilter(filter) {
    this._filterText.push(filter.text);
    this._filterTextIndex.add(filter.text);
  }

  /**
   * Inserts a filter into the subscription at the given `0`-based index.
   *
   * @param {module:filterClasses.Filter} filter The filter.
   * @param {number} index The `0`-based index. If the index is out of bounds,
   *   the filter is inserted at the beginning or at the end accordingly.
   */
  insertFilterAt(filter, index) {
    this._filterText.splice(index, 0, filter.text);
    this._filterTextIndex.add(filter.text);
  }

  /**
   * Deletes a filter from the subscription at the given `0`-based index.
   * @param {number} index The `0`-based index. If the index is out of bounds,
   *   no filter is deleted.
   */
  deleteFilterAt(index) {
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
  updateFilterText(filterText) {
    let added = [];
    let removed = [];

    if (this._filterText.length == 0) {
      added = [...filterText];
    }
    else if (filterText.length > 0) {
      for (let text of filterText) {
        if (!this._filterTextIndex.has(text))
          added.push(text);
      }
    }

    this._filterTextIndex = new Set(filterText);

    if (filterText.length == 0) {
      removed = [...this._filterText];
    }
    else if (this._filterText.length > 0) {
      for (let text of this._filterText) {
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
   * @package
   */
  *serialize() {
    let {url, _title, _fixedTitle, _disabled, _id} = this;

    yield "[Subscription]";
    yield "url=" + url;

    if (_title)
      yield "title=" + _title;
    if (_fixedTitle)
      yield "fixedTitle=true";
    if (_disabled)
      yield "disabled=true";
    if (_id)
      yield "id=" + _id;
  }

  /**
   * Serializes the subscription's filter text for writing out on disk.
   * @yields {string}
   * @package
   */
  *serializeFilters() {
    let {_filterText} = this;

    yield "[Subscription filters]";

    for (let text of _filterText)
      yield text.replace(/\[/g, "\\[");
  }

  /**
   * Returns a string representing the subscription.
   * @returns {string}
   */
  toString() {
    return [...this.serialize()].join("\n");
  }
};

/**
 * Cache for known filter subscriptions that maps subscription URLs to
 * subscription objects.
 * @type {Map.<string, module:subscriptionClasses.Subscription>}
 * @package
 */
exports.Subscription.knownSubscriptions = new Map();
/**
 * We operate in DNR mode. Default is false.
 * @type {bool}
 * @package
 */
exports.Subscription.dnr = false;

/**
 * Returns the subscription object for a subscription URL.
 *
 * Every subscription URL maps to its own unique object. If no such object
 * exists, a new one is created internally; otherwise the existing object is
 * used.
 *
 * If `Subscription.dnr` is true, it will remap `mv2_url` to the canonical
 * `url` if necessary.
 *
 * @param {string} url The subscription URL.
 *
 * @returns {module:subscriptionClasses.Subscription} A subscription
 * object (can be any subclass thereof.
 */
exports.Subscription.fromURL = function(url) {
  let subscription = Subscription.knownSubscriptions.get(url);
  if (subscription)
    return subscription;

  if (url[0] != "~") {
    let downloadable = true;
    let title = null;
    if (Subscription.dnr) {
      // In DNR we check if we got a mv2 URL and remap.
      let actualUrl = urlByMv2URL().get(url);
      if (actualUrl) {
        subscription = Subscription.knownSubscriptions.get(actualUrl);
        if (subscription)
          return subscription;

        url = actualUrl;
      }

      let recommendation = recommendationsByURL().get(url);
      if (recommendation) {
        // In DNR currently "circumvention" list is downloadable.
        // This until we can tag subscription to be downloadable.
        downloadable = recommendation.type == "circumvention";
        // In DNR we use the recommendation title.
        title = recommendation.title;
      }
    }

    if (downloadable)
      subscription = new DownloadableSubscription(url, title);
    else
      subscription = new CountableSubscription(url, title);

    return subscription;
  }

  return new SpecialSubscription(url);
};

/**
 * Deserializes a subscription.
 * @param {Object} obj A map of serialized properties and their values.
 * @returns {module:subscriptionClasses.Subscription} A subscription object.
 * @package
 */
exports.Subscription.fromObject = function(obj) {
  let result;
  if (obj.url[0] != "~") {
    // URL is valid - this is a regular subscription
    // Unless indicated otherwise it is downloadable.
    if (("downloadable" in obj) && (obj.downloadable == "false"))
      result = new CountableSubscription(obj.url, obj.title);
    else
      result = new DownloadableSubscription(obj.url, obj.title);

    if (result.type)
      result.abtest = obj.abtest;

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
  else {
    result = new SpecialSubscription(obj.url, obj.title);
    if ("defaults" in obj)
      result.defaults = obj.defaults.split(" ");
    if ("metadata" in obj)
      result._metadata = JSON.parse(obj.metadata);
  }
  if ("id" in obj)
    result._id = obj.id;
  if ("fixedTitle" in obj)
    result._fixedTitle = (obj.fixedTitle == "true");
  if ("disabled" in obj)
    result._disabled = (obj.disabled == "true");

  return result;
};

/**
 * Checks whether a URL is a valid subscription URL.
 * @param {string} url The URL.
 * @returns {boolean} Whether the URL is a valid subscription URL.
 */
exports.Subscription.isValidURL = function isValidURL(url) {
  return url.startsWith("~user~") || Downloader.isValidURL(url);
};

let SpecialSubscription =
/**
 * The `SpecialSubscription` class represents a special filter subscription.
 *
 * This type of subscription is used for keeping user-defined filters.
 * @extends module:subscriptionClasses.Subscription
 */
exports.SpecialSubscription = class SpecialSubscription extends Subscription {
  /**
   * Creates a `SpecialSubscription` object.
   * @param {string} url The URL of the subscription.
   * @param {string} [title] The title of the subscription.
   * @private
   */
  constructor(url, title) {
    super(url, title);

    /**
     * Filter types that should be added to this subscription by default.
     *
     * Entries should correspond to keys in
     * `{@link module:subscriptionClasses.SpecialSubscription.defaultsMap}`.
     *
     * @type {?Array.<string>}
     *
     * @package
     */
    this.defaults = null;

    this._metadata = null;
  }

  get privileged() {
    return true;
  }

  /**
   * Checks whether the given filter should be added to this subscription by
   * default.
   * @param {Filter} filter The filter.
   * @returns {boolean} Whether the filter should be added to this subscription
   *   by default.
   * @package
   */
  isDefaultFor(filter) {
    if (this.defaults && this.defaults.length) {
      for (let type of this.defaults) {
        if (SpecialSubscription.defaultsMap.get(type).includes(filter.type))
          return true;
        if (!isActiveFilter(filter) && type == "blocking")
          return true;
      }
    }

    return false;
  }

  /**
   * Set the metadata block for the special subscription
   *
   * @param {object} [value] The metadata
   */
  set metadata(value) {
    let oldValue = this._metadata;
    this._metadata = value;
    filterNotifier.emit("subscription.metadata", this, value, oldValue);
  }

  /**
   * Get the metadata block.
   * @return {?object} the metadata object or null
   */
  get metadata() {
    return this._metadata;
  }

  /**
   * Serializes the subscription for writing out on disk.
   * @yields {string}
   * @package
   */
  *serialize() {
    let {defaults, _lastDownload, _metadata} = this;

    yield* super.serialize();

    if (defaults) {
      yield "defaults=" +
            defaults.map(
              // remap for the stored format.
              type => type == "allowing" ? "whitelist" : type
            ).filter(
              type => SpecialSubscription.defaultsMap.has(type)
            ).join(" ");
    }
    // Metadata is encoded as a JSON on a single line.
    // This should be safe.
    if (_metadata)
      yield "metadata=" + JSON.stringify(_metadata);

    if (_lastDownload)
      yield "lastDownload=" + _lastDownload;
  }
};

/**
 * A map of filter types.
 * @type {Map.<string, Array.<string>>}
 * @package
 */
exports.SpecialSubscription.defaultsMap = new Map([
  ["allowing", ["allowing"]],
  // deprecated terminology
  ["whitelist", ["allowing"]],
  ["blocking", ["blocking"]],
  ["elemhide", ["elemhide", "elemhideexception", "elemhideemulation"]]
]);

/**
 * Creates a new special subscription.
 * @param {string} [title] The title of the subscription.
 * @returns {module:subscriptionClasses.SpecialSubscription} A new special
 *   subscription.
 * @package
 */
exports.SpecialSubscription.create = function(title) {
  let url;
  do
    url = "~user~" + Math.round(Math.random() * 1000000);
  while (Subscription.knownSubscriptions.has(url));
  return new SpecialSubscription(url, title);
};

/**
 * Creates a new special subscription and adds the given filter to it.
 *
 * Once created, the subscription acts as the default for all filters of the
 * {@link module:filterClasses.Filter#type type}.
 *
 * @param {module:filterClasses.Filter} filter The filter.
 *
 * @returns {module:subscriptionClasses.SpecialSubscription} A new special
 *   subscription.
 *
 * @package
 */
exports.SpecialSubscription.createForFilter = function(filter) {
  let subscription = SpecialSubscription.create();
  subscription.addFilter(filter);
  for (let [type, mappedTypes] of SpecialSubscription.defaultsMap) {
    if (mappedTypes.includes(filter.type))
      subscription.defaults = [type];
  }
  if (!subscription.defaults)
    subscription.defaults = ["blocking"];
  return subscription;
};

let RegularSubscription =
/**
 * The `RegularSubscription` class represents a regular filter subscription
 * that is not by default downloaded off the internet.
 * `CountableSubscription` is a subclass of this.
 *
 * In a manifest v2 context it shouldn't be encountered. In manifest v3, it's
 * the default.
 *
 * @extends module:subscriptionClasses.Subscription
 */
exports.RegularSubscription = class RegularSubscription extends Subscription {
  /**
   * Creates a `RegularSubscription` object.
   * @param {string} url The URL of the subscription.
   * @param {string} [title] The title of the subscription.
   * @private
   */
  constructor(url, title) {
    super(url, title || url);

    /**
     * The homepage of the subscription.
     * @type {?string}
     * @default <code>null</code>
     * @private
     * @see module:subscriptionClasses.RegularSubscription#homepage
     */
    this._homepage = null;

    /**
     * The last time the subscription was downloaded, in seconds since the
     * beginning of the Unix epoch.
     * @type {number}
     * @default <code>0</code>
     * @private
     * @see module:subscriptionClasses.RegularSubscription#lastDownload
     */
    this._lastDownload = 0;

    let recommendation = recommendationsByURL().get(url);
    /**
     * The languages that apply for this subscription.
     * @type {?Array.<string>}
     */
    this._languages = recommendation ? recommendation.languages : null;
  }

  /**
   * The homepage of the subscription.
   * @type {?string}
   * @default <code>null</code>
   */
  get homepage() {
    return this._homepage;
  }

  set homepage(value) {
    if (value != this._homepage) {
      let oldValue = this._homepage;
      this._homepage = value;
      filterNotifier.emit("subscription.homepage", this, value, oldValue);
    }
  }

  /**
   * The languages that apply for this subscription.
   * @type {?Array.<string>}
   * @default <code>null</code>
   */
  get languages() {
    return this._languages;
  }

  /**
   * The last time the subscription was downloaded, in seconds since the
   * beginning of the Unix epoch.
   * @type {number}
   * @default <code>0</code>
   */
  get lastDownload() {
    return this._lastDownload;
  }

  set lastDownload(value) {
    if (value != this._lastDownload) {
      let oldValue = this._lastDownload;
      this._lastDownload = value;
      filterNotifier.emit("subscription.lastDownload", this, value, oldValue);
    }
  }

  /**
   * Serializes the subscription for writing out on disk.
   * @yields {string}
   * @package
   */
  *serialize() {
    let {_homepage, _lastDownload} = this;

    yield* super.serialize();

    // To keep compatibility dowloadable is true if missing
    if (!this.downloadable)
      yield "downloadable=false";
    if (_homepage)
      yield "homepage=" + _homepage;
    if (_lastDownload)
      yield "lastDownload=" + _lastDownload;
  }
};

/**
 * Once initialized, the shared Synchronizer singleton will be stored in here.
 * @type {module:synchronizer.Synchronizer}
 */
let synchronizer = null;

let CountableSubscription =
/**
 * The `CountableSubscription` class represents a regular filter
 * subscription which will indicate it to the remote `url` it is in
 * use by issuing a `HEAD` http request instead of a `GET`.
 *
 * However it will have its property `downloadable` still set to
 * `false`.
 *
 * @extends module:subscriptionClasses.RegularSubscription
 */
exports.CountableSubscription =
class CountableSubscription extends RegularSubscription {
  /**
   * Allows downloadable subscriptions to update themselves once re-enabled,
   * via receiving the Synchronizer singleton.
   * @param {module:synchronizer~Synchronizer} reference the Synchronizer
   */
  static useSynchronizer(reference) {
    synchronizer = reference;
  }

  /**
   * Creates a `CountableSubscription` object.
   *
   * @param {string} url The URL of the subscription.
   * @param {string} [title] The title of the subscription.
   * @private
   */
  constructor(url, title) {
    super(url, title);

    /**
     * The status of the last download.
     * @type {?string}
     * @default <code>null</code>
     * @private
     * @see module:subscriptionClasses.CountableSubscription#downloadStatus
     */
    this._downloadStatus = null;

    /**
     * The last time the subscription was considered for an update, in seconds
     * since the beginning of the Unix epoch.
     * @type {number}
     * @default <code>0</code>
     * @private
     * @see module:subscriptionClasses.CountableSubscription#lastCheck
     */
    this._lastCheck = 0;

    /**
     * The number of download failures since the last successful download.
     * @type {number}
     * @default <code>0</code>
     * @private
     * @see module:subscriptionClasses.CountableSubscription#errors
     */
    this._errors = 0;

    /**
     * The last time the subscription was successfully downloaded, in seconds
     * since the beginning of the Unix epoch.
     * @type {number}
     * @default <code>0</code>
     */
    this.lastSuccess = 0;

    /**
     * The hard expiration time of the subscription, in seconds since the
     * beginning of the Unix epoch.
     *
     * Updates should be downloaded if `{@link
     * module:subscriptionClasses.CountableSubscription#softExpiration}`
     * or `expires` are in the past.
     * @type {number}
     * @default <code>0</code>
     */
    this.expires = 0;

    /**
     * The soft expiration time of the subscription, in seconds since the
     * beginning of the Unix epoch.
     *
     * Updates should be downloaded if `softExpiration` or
     * `{@link module:subscriptionClasses.CountableSubscription#expires}`
     * are in the past.
     * @type {number}
     * @default <code>0</code>
     */
    this.softExpiration = 0;

    /**
     * The version of the subscription data that was retrieved on last
     * successful download.
     * @type {number}
     * @default <code>0</code>
     */
    this.version = 0;

    /**
     * The minimal Adblock Plus version required for the subscription.
     * @type {?string}
     * @default <code>null</code>
     */
    this.requiredVersion = null;

    /**
     * The number of times the subscription has been downloaded.
     * @type {number}
     * @default <code>0</code>
     */
    this.downloadCount = 0;

    this._p = profiler(`CountableSubscription@${url}`);
    this._p.start();
  }

  /**
   * Whether this is a countable subscription, i.e. a subscription that
   * will connect to the URL. A downloadable subscription is countable,
   * but not the other way around.
   *
   * @type {boolean}
   * @default <code>true</code>
   */
  get countable() {
    return true;
  }

  /**
   * Whether the subscription is disabled. Once re-enabled, it ensures the
   * synchronizer downloads latest version of this subscription.
   * @type {boolean}
   * @default <code>false</code>
   */
  get disabled() {
    return super.disabled;
  }

  set disabled(value) {
    let {_disabled} = this;
    super.disabled = value;
    if (synchronizer && _disabled && !value)
      synchronizer.execute(this);
  }

  /**
   * The status of the last download.
   *
   * A message ID which can have the following values: `synchronize_ok`,
   * `synchronize_connection_error` or `synchronize_invalid_url`. If the
   * initial download is not completed yet, then it is null.
   *
   * @type {?string}
   * @default <code>null</code>
   */
  get downloadStatus() {
    return this._downloadStatus;
  }

  set downloadStatus(value) {
    let oldValue = this._downloadStatus;
    this._downloadStatus = value;
    filterNotifier.emit("subscription.downloadStatus", this, value, oldValue);
  }

  /**
   * The last time the subscription was considered for an update, in seconds
   * since the beginning of the Unix epoch.
   *
   * This is used to increase the soft expiration time if the user doesn't use
   * Adblock Plus for some time.
   *
   * @type {number}
   * @default <code>0</code>
   */
  get lastCheck() {
    return this._lastCheck;
  }

  set lastCheck(value) {
    if (value != this._lastCheck) {
      let oldValue = this._lastCheck;
      this._lastCheck = value;
      filterNotifier.emit("subscription.lastCheck", this, value, oldValue);
    }
  }

  /**
   * The number of download failures since the last successful download.
   * @type {number}
   * @default <code>0</code>
   */
  get errors() {
    return this._errors;
  }

  set errors(value) {
    if (value != this._errors) {
      let oldValue = this._errors;
      this._errors = value;
      filterNotifier.emit("subscription.errors", this, value, oldValue);
    }
  }

  /**
   * Serializes the subscription for writing out on disk.
   * @yields {string}
   * @package
   */
  *serialize() {
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

  /**
   * Put a benchmarking event
   * @param {string} event benchmarking event
   */
  mark(event) {
    this._p.mark(event);
  }
};

let DownloadableSubscription =
/**
 * The `DownloadableSubscription` class represents a regular filter
 * subscription whose content (filter text) is downloaded from a filter list
 * off the internet from `url`.
 *
 * It will have its property `downloadable` set to `true`.
 *
 * @extends module:subscriptionClasses.CountableSubscription
 */
exports.DownloadableSubscription =
class DownloadableSubscription extends CountableSubscription {
  /** Construct a new DownloadableSubscription
   *
   * @param {string} url The URL of the subscription.
   * @param {string} [title] The title of the subscription.
   *
   * @private
   */
  constructor(url, title) {
    super(url, title);
  }

  /**
   * Whether the subscription is downloadable.
   * @type {boolean}
   * @default <code>true</code>
   */
  get downloadable() {
    return true;
  }
};
