/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-2016 Eyeo GmbH
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

/**
 * @fileOverview This component manages listeners and calls them to distributes
 * messages about filter changes.
 */

let {EventEmitter} = require("events");
let {desc} = require("coreUtils");

const CATCH_ALL = "__all";

/**
 * This class allows registering and triggering listeners for filter events.
 * @class
 */
exports.FilterNotifier = Object.create(new EventEmitter(), desc({
  /**
   * Adds a listener
   *
   * @deprecated use FilterNotifier.on(action, callback)
   */
  addListener: function(/**function(action, item, newValue, oldValue)*/ listener)
  {
    let listeners = this._listeners[CATCH_ALL];
    if (!listeners || listeners.indexOf(listener) == -1)
      this.on(CATCH_ALL, listener);
  },

  /**
   * Removes a listener that was previosly added via addListener
   *
   * @deprecated use FilterNotifier.off(action, callback)
   */
  removeListener: function(/**function(action, item, newValue, oldValue)*/ listener)
  {
    this.off(CATCH_ALL, listener);
  },

  /**
   * Notifies listeners about an event
   * @param {String} action event code ("load", "save", "elemhideupdate",
   *                 "subscription.added", "subscription.removed",
   *                 "subscription.disabled", "subscription.title",
   *                 "subscription.lastDownload", "subscription.downloadStatus",
   *                 "subscription.homepage", "subscription.updated",
   *                 "filter.added", "filter.removed", "filter.moved",
   *                 "filter.disabled", "filter.hitCount", "filter.lastHit")
   * @param {Subscription|Filter} item item that the change applies to
   * @deprecated use FilterNotifier.emit(action)
   */
  triggerListeners: function(action, item, param1, param2, param3)
  {
    this.emit(action, item, param1, param2, param3);
    this.emit(CATCH_ALL, action, item, param1, param2, param3);
  }
}));
