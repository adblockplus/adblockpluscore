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

"use strict";

/**
 * Registers and emits named events.
 *
 * @constructor
 */
exports.EventEmitter = function()
{
  this._listeners = Object.create(null);
};

exports.EventEmitter.prototype = {
  /**
   * Adds a listener for the specified event name.
   *
   * @param {string}   name
   * @param {function} listener
   */
  on(name, listener)
  {
    if (name in this._listeners)
      this._listeners[name].push(listener);
    else
      this._listeners[name] = [listener];
  },

  /**
   * Removes a listener for the specified event name.
   *
   * @param {string}   name
   * @param {function} listener
   */
  off(name, listener)
  {
    let listeners = this._listeners[name];
    if (listeners)
    {
      let idx = listeners.indexOf(listener);
      if (idx != -1)
        listeners.splice(idx, 1);
    }
  },

  /**
   * Adds a one time listener and returns a promise that
   * is resolved the next time the specified event is emitted.
   * @param {string} name
   * @return {Promise}
   */
  once(name)
  {
    return new Promise(resolve =>
    {
      let listener = () =>
      {
        this.off(name, listener);
        resolve();
      };

      this.on(name, listener);
    });
  },

  /**
   * Returns a copy of the array of listeners for the specified event.
   *
   * @param {string} name
   * @return {function[]}
   */
  listeners(name)
  {
    let listeners = this._listeners[name];
    return listeners ? listeners.slice() : [];
  },

  /**
   * Calls all previously added listeners for the given event name.
   *
   * @param {string} name
   * @param {...*}   [arg]
   */
  emit(name, ...args)
  {
    let listeners = this.listeners(name);
    for (let listener of listeners)
      listener(...args);
  }
};
