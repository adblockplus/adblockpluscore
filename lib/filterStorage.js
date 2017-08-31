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

const {FilterStorage} = require("compiled");
const {Subscription, SpecialSubscription} = require("subscriptionClasses");

// Backwards compatibility
FilterStorage.getGroupForFilter = FilterStorage.getSubscriptionForFilter;

/**
 * This property allows iterating over the list of subscriptions. It will delete
 * references automatically at the end of the current loop iteration. If you
 * need persistent references or element access by position you should use
 * FilterStorage.subscriptionAt() instead.
 * @type {Iterable}
 */
FilterStorage.subscriptions = {
  *[Symbol.iterator]()
  {
    for (let i = 0, l = FilterStorage.subscriptionCount; i < l; i++)
    {
      let subscription = FilterStorage.subscriptionAt(i);
      try
      {
        yield subscription;
      }
      finally
      {
        subscription.delete();
      }
    }
  }
};

/**
 * Adds a user-defined filter to the most suitable subscription in the list,
 * creates one if none found.
 * @param {Filter} filter
 * @returns {boolean}
 *    false if the filter was already in the list and no adding was performed
 */
FilterStorage.addFilter = function(filter)
{
  for (let subscription of this.subscriptions)
    if (!subscription.disabled && subscription.indexOfFilter(filter) >= 0)
      return false;

  let subscription = this.getSubscriptionForFilter(filter);
  try
  {
    if (!subscription)
    {
      subscription = Subscription.fromURL(null);
      subscription.makeDefaultFor(filter);
      this.addSubscription(subscription);
    }
    subscription.insertFilterAt(filter, subscription.filterCount);
  }
  finally
  {
    if (subscription)
      subscription.delete();
  }
  return true;
};

/**
 * Removes a user-defined filter from the list
 * @param {Filter} filter
 */
FilterStorage.removeFilter = function(filter)
{
  for (let subscription of this.subscriptions)
  {
    if (subscription instanceof SpecialSubscription)
    {
      while (true)
      {
        let index = subscription.indexOfFilter(filter);
        if (index >= 0)
          subscription.removeFilterAt(index);
        else
          break;
      }
    }
  }
};

exports.FilterStorage = FilterStorage;
