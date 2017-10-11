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

const {Subscription, UserDefinedSubscription, DownloadableSubscription} =
    require("compiled");

/**
 * This property allows iterating over the list of filters. It will delete
 * references automatically at the end of the current loop iteration. If you
 * need persistent references or element access by position you should use
 * Subscription.filterAt() instead.
 * @type {Iterable}
 */
Object.defineProperty(Subscription.prototype, "filters", {
  enumerable: true,
  get()
  {
    return {
      [Symbol.iterator]: function*()
      {
        for (let i = 0, l = this.filterCount; i < l; i++)
        {
          let filter = this.filterAt(i);
          try
          {
            yield filter;
          }
          finally
          {
            filter.delete();
          }
        }
      }.bind(this)
    };
  }
});

Object.defineProperty(DownloadableSubscription.prototype, "expires", {
  get()
  {
    return this.hardExpiration;
  },
  set(value)
  {
    this.hardExpiration = value;
  }
});

Object.defineProperty(DownloadableSubscription.prototype, "errors", {
  get()
  {
    return this.errorCount;
  },
  set(value)
  {
    this.errorCount = value;
  }
});

Object.defineProperty(DownloadableSubscription.prototype, "version", {
  get()
  {
    return this.dataRevision;
  },
  set(value)
  {
    this.dataRevision = value;
  }
});

exports.Subscription = Subscription;
exports.UserDefinedSubscription = UserDefinedSubscription;
exports.SpecialSubscription = UserDefinedSubscription;
exports.DownloadableSubscription = DownloadableSubscription;
