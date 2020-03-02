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
 * @fileOverview Synchronization between filter storage and filter containers.
 */

const {filterStorage} = require("./filterStorage");
const {filterNotifier} = require("./filterNotifier");
const {filterEngine} = require("./filterEngine");
const {Filter, ActiveFilter, SnippetFilter} = require("./filterClasses");
const {SpecialSubscription} = require("./subscriptionClasses");

/**
 * Notifies the filter engine about a new filter if necessary.
 * @param {Filter} filter filter that has been added
 * @param {?Array.<module:subscriptionClasses.Subscription>} [subscriptions]
 *   subscriptions to which the filter belongs
 */
function addFilter(filter, subscriptions = null)
{
  if (!(filter instanceof ActiveFilter) || filter.disabled)
    return;

  let hasEnabled = false;
  let allowSnippets = false;
  for (let subscription of subscriptions ||
                           filterStorage.subscriptions(filter.text))
  {
    if (!subscription.disabled)
    {
      hasEnabled = true;

      // Allow snippets to be executed only by the circumvention lists or the
      // user's own filters.
      if (subscription.type == "circumvention" ||
          subscription instanceof SpecialSubscription)
      {
        allowSnippets = true;
        break;
      }
    }
  }
  if (!hasEnabled)
    return;

  if (!allowSnippets && filter instanceof SnippetFilter)
    return;

  filterEngine.add(filter);
}

/**
 * Notifies the filter engine about removal of a filter if necessary.
 * @param {module:filterClasses.Filter} filter filter that has been removed
 */
function removeFilter(filter)
{
  if (!(filter instanceof ActiveFilter))
    return;

  if (!filter.disabled)
  {
    let hasEnabled = false;
    for (let subscription of filterStorage.subscriptions(filter.text))
    {
      if (!subscription.disabled)
      {
        hasEnabled = true;
        break;
      }
    }
    if (hasEnabled)
      return;
  }

  filterEngine.remove(filter);
}

/**
 * `{@link module:filterListener.filterListener filterListener}`
 * implementation.
 */
class FilterListener
{
  /**
   * Initializes filter listener on startup, registers the necessary hooks.
   *
   * Initialization is asynchronous; once complete,
   * `{@link module:filterNotifier.filterNotifier filterNotifier}` emits the
   * `ready` event.
   *
   * @hideconstructor
   */
  constructor()
  {
    /**
     * Increases on filter changes, filters will be saved if it exceeds 1.
     * @type {number}
     * @private
     */
    this._isDirty = 0;

    filterStorage.loadFromDisk().then(() =>
    {
      let promise = Promise.resolve();

      // Initialize filters from each subscription asynchronously on startup by
      // setting up a chain of promises.
      for (let subscription of filterStorage.subscriptions())
      {
        if (!subscription.disabled)
        {
          promise = promise.then(() =>
          {
            for (let text of subscription.filterText())
              addFilter(Filter.fromText(text), [subscription]);
          });
        }
      }

      return promise;
    })
    .then(() =>
    {
      filterNotifier.on("filter.hitCount", this._onFilterHitCount.bind(this));
      filterNotifier.on("filter.lastHit", this._onFilterLastHit.bind(this));
      filterNotifier.on("filter.added", this._onFilterAdded.bind(this));
      filterNotifier.on("filter.removed", this._onFilterRemoved.bind(this));
      filterNotifier.on("filter.disabled", this._onFilterDisabled.bind(this));
      filterNotifier.on("filter.moved", this._onGenericChange.bind(this));

      filterNotifier.on("subscription.added",
                        this._onSubscriptionAdded.bind(this));
      filterNotifier.on("subscription.removed",
                        this._onSubscriptionRemoved.bind(this));
      filterNotifier.on("subscription.disabled",
                        this._onSubscriptionDisabled.bind(this));
      filterNotifier.on("subscription.updated",
                        this._onSubscriptionUpdated.bind(this));
      filterNotifier.on("subscription.title", this._onGenericChange.bind(this));
      filterNotifier.on("subscription.fixedTitle",
                        this._onGenericChange.bind(this));
      filterNotifier.on("subscription.homepage",
                        this._onGenericChange.bind(this));
      filterNotifier.on("subscription.downloadStatus",
                        this._onGenericChange.bind(this));
      filterNotifier.on("subscription.lastCheck",
                        this._onGenericChange.bind(this));
      filterNotifier.on("subscription.errors",
                        this._onGenericChange.bind(this));

      filterNotifier.on("load", this._onLoad.bind(this));
      filterNotifier.on("save", this._onSave.bind(this));

      // Indicate that all filters are ready for use.
      filterNotifier.emit("ready");
    });
  }

  /**
   * Increases "dirty factor" of the filters and calls
   * filterStorage.saveToDisk() if it becomes 1 or more.
   *
   * Save is executed delayed to prevent multiple subsequent calls. If the
   * parameter is 0 it forces saving filters if any changes were recorded after
   * the previous save.
   *
   * @param {number} factor
   *
   * @private
   */
  _setDirty(factor)
  {
    if (factor == 0 && this._isDirty > 0)
      this._isDirty = 1;
    else
      this._isDirty += factor;
    if (this._isDirty >= 1)
    {
      this._isDirty = 0;
      filterStorage.saveToDisk();
    }
  }

  _onSubscriptionAdded(subscription)
  {
    this._setDirty(1);

    if (!subscription.disabled)
    {
      for (let text of subscription.filterText())
        addFilter(Filter.fromText(text), [subscription]);
    }
  }

  _onSubscriptionRemoved(subscription)
  {
    this._setDirty(1);

    if (!subscription.disabled)
    {
      for (let text of subscription.filterText())
        removeFilter(Filter.fromText(text));
    }
  }

  _onSubscriptionDisabled(subscription, newValue)
  {
    this._setDirty(1);

    if (filterStorage.hasSubscription(subscription))
    {
      if (newValue == false)
      {
        for (let text of subscription.filterText())
          addFilter(Filter.fromText(text), [subscription]);
      }
      else
      {
        for (let text of subscription.filterText())
          removeFilter(Filter.fromText(text));
      }
    }
  }

  _onSubscriptionUpdated(subscription, textDelta)
  {
    this._setDirty(1);

    if (!subscription.disabled &&
        filterStorage.hasSubscription(subscription))
    {
      for (let text of textDelta.removed)
        removeFilter(Filter.fromText(text));

      for (let text of textDelta.added)
        addFilter(Filter.fromText(text), [subscription]);
    }
  }

  _onFilterHitCount(filter, newValue)
  {
    if (newValue == 0)
      this._setDirty(0);
    else
      this._setDirty(0.002);
  }

  _onFilterLastHit()
  {
    this._setDirty(0.002);
  }

  _onFilterAdded(filter)
  {
    this._setDirty(1);

    if (!filter.disabled)
      addFilter(filter);
  }

  _onFilterRemoved(filter)
  {
    this._setDirty(1);

    if (!filter.disabled)
      removeFilter(filter);
  }

  _onFilterDisabled(filter, newValue)
  {
    this._setDirty(1);

    if (newValue == false)
      addFilter(filter);
    else
      removeFilter(filter);
  }

  _onGenericChange()
  {
    this._setDirty(1);
  }

  _onLoad()
  {
    this._isDirty = 0;

    filterEngine.clear();

    for (let subscription of filterStorage.subscriptions())
    {
      if (!subscription.disabled)
      {
        for (let text of subscription.filterText())
          addFilter(Filter.fromText(text), [subscription]);
      }
    }
  }

  _onSave()
  {
    this._isDirty = 0;
  }
}

/**
 * Component synchronizing filter storage with filter containers.
 * @type {module:filterListener~FilterListener}
 */
exports.filterListener = new FilterListener();
