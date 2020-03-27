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
 * @fileOverview Synchronization between filter storage and the filter engine.
 */

const {filterStorage} = require("./filterStorage");
const {filterNotifier} = require("./filterNotifier");
const {filterEngine} = require("./filterEngine");
const {isActiveFilter, Filter} = require("./filterClasses");
const {SpecialSubscription} = require("./subscriptionClasses");

/**
 * Checks whether filters from a given subscription should be deployed to the
 * filter engine.
 *
 * If the subscription is both valid and enabled, the function returns `true`;
 * otherwise, it returns `false`.
 *
 * @param {module:subscriptionClasses.Subscription} subscription
 *   The subscription.
 *
 * @returns {boolean} Whether filters from the subscription should be deployed
 *   to the filter engine.
 */
function shouldDeployFilters(subscription)
{
  return subscription.valid && !subscription.disabled;
}

/**
 * Deploys a filter to the filter engine.
 *
 * The filter is deployed only if it belongs to at least one subscription that
 * is both valid and enabled.
 *
 * If the filter is a snippet filter, it is deployed only if it belongs to at
 * least one subscription that is valid, enabled, and of
 * {@link module:subscriptionClasses.Subscription#type type}
 * `circumvention` or a
 * {@link module:subscriptionClasses.SpecialSubscription special subscription}
 * that keeps user-defined filters.
 *
 * @param {Filter} filter The filter.
 * @param {?Array.<module:subscriptionClasses.Subscription>} [subscriptions]
 *   A list of subscriptions to which the filter belongs. If omitted or `null`,
 *   the information is looked up from
 *   {@link module:filterStorage.filterStorage filter storage}.
 */
function deployFilter(filter, subscriptions = null)
{
  if (!isActiveFilter(filter) || filter.disabled)
    return;

  let deploy = false;
  let allowSnippets = false;

  for (let subscription of subscriptions ||
                           filterStorage.subscriptions(filter.text))
  {
    if (shouldDeployFilters(subscription))
    {
      deploy = true;

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

  if (!deploy)
    return;

  if (!allowSnippets && filter.type == "snippet")
    return;

  filterEngine.add(filter);
}

/**
 * Undeploys a filter from the filter engine.
 *
 * The filter is undeployed only if it does not belong to at least one
 * subscription that is both valid and enabled.
 *
 * @param {module:filterClasses.Filter} filter The filter.
 */
function undeployFilter(filter)
{
  if (!isActiveFilter(filter))
    return;

  if (!filter.disabled)
  {
    let keep = false;
    for (let subscription of filterStorage.subscriptions(filter.text))
    {
      if (shouldDeployFilters(subscription))
      {
        keep = true;
        break;
      }
    }

    if (keep)
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
        if (shouldDeployFilters(subscription))
        {
          promise = promise.then(() =>
          {
            for (let text of subscription.filterText())
              deployFilter(Filter.fromText(text), [subscription]);
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

    if (shouldDeployFilters(subscription))
    {
      for (let text of subscription.filterText())
        deployFilter(Filter.fromText(text), [subscription]);
    }
  }

  _onSubscriptionRemoved(subscription)
  {
    this._setDirty(1);

    if (shouldDeployFilters(subscription))
    {
      for (let text of subscription.filterText())
        undeployFilter(Filter.fromText(text));
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
          deployFilter(Filter.fromText(text), [subscription]);
      }
      else
      {
        for (let text of subscription.filterText())
          undeployFilter(Filter.fromText(text));
      }
    }
  }

  _onSubscriptionUpdated(subscription, textDelta)
  {
    this._setDirty(1);

    if (shouldDeployFilters(subscription) &&
        filterStorage.hasSubscription(subscription))
    {
      for (let text of textDelta.removed)
        undeployFilter(Filter.fromText(text));

      for (let text of textDelta.added)
        deployFilter(Filter.fromText(text), [subscription]);
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
      deployFilter(filter);
  }

  _onFilterRemoved(filter)
  {
    this._setDirty(1);

    if (!filter.disabled)
      undeployFilter(filter);
  }

  _onFilterDisabled(filter, newValue)
  {
    this._setDirty(1);

    if (newValue == false)
      deployFilter(filter);
    else
      undeployFilter(filter);
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
      if (shouldDeployFilters(subscription))
      {
        for (let text of subscription.filterText())
          deployFilter(Filter.fromText(text), [subscription]);
      }
    }
  }

  _onSave()
  {
    this._isDirty = 0;
  }
}

/**
 * Component synchronizing filter storage with the filter engine.
 * @type {module:filterListener~FilterListener}
 */
exports.filterListener = new FilterListener();
