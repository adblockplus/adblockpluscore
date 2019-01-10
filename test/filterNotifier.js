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

const {createSandbox} = require("./_common");

let filterNotifier = null;

exports.setUp = function(callback)
{
  let sandboxedRequire = createSandbox();
  (
    {filterNotifier} = sandboxedRequire("../lib/filterNotifier")
  );

  callback();
};

let triggeredListeners = [];
let listeners = [
  (...args) => triggeredListeners.push(["listener1", ...args]),
  (...args) => triggeredListeners.push(["listener2", ...args]),
  (...args) => triggeredListeners.push(["listener3", ...args])
];

function addListener(listener)
{
  filterNotifier.on("foo", listener);
}

function removeListener(listener)
{
  filterNotifier.off("foo", listener);
}

function compareListeners(test, testDescription, list)
{
  test.equal(filterNotifier.hasListeners(), list.length > 0, testDescription);
  test.equal(filterNotifier.hasListeners("foo"), list.length > 0,
             testDescription);

  test.equal(filterNotifier.hasListeners("bar"), false, testDescription);

  let result1 = triggeredListeners = [];
  filterNotifier.emit("foo", {bar: true});

  let result2 = triggeredListeners = [];
  for (let observer of list)
    observer({bar: true});

  test.deepEqual(result1, result2, testDescription);
}

exports.testAddingRemovingListeners = function(test)
{
  let [listener1, listener2, listener3] = listeners;

  compareListeners(test, "No listeners", []);

  addListener(listener1);
  compareListeners(test, "addListener(listener1)", [listener1]);

  addListener(listener1);
  compareListeners(test, "addListener(listener1) again", [listener1, listener1]);

  addListener(listener2);
  compareListeners(test, "addListener(listener2)", [listener1, listener1, listener2]);

  removeListener(listener1);
  compareListeners(test, "removeListener(listener1)", [listener1, listener2]);

  removeListener(listener1);
  compareListeners(test, "removeListener(listener1) again", [listener2]);

  addListener(listener3);
  compareListeners(test, "addListener(listener3)", [listener2, listener3]);

  addListener(listener1);
  compareListeners(test, "addListener(listener1)", [listener2, listener3, listener1]);

  removeListener(listener3);
  compareListeners(test, "removeListener(listener3)", [listener2, listener1]);

  removeListener(listener1);
  compareListeners(test, "removeListener(listener1)", [listener2]);

  removeListener(listener2);
  compareListeners(test, "removeListener(listener2)", []);

  test.done();
};

exports.testRemovingListenersWhileBeingCalled = function(test)
{
  let listener1 = function(...args)
  {
    listeners[0](...args);
    removeListener(listener1);
  };
  let listener2 = listeners[1];
  addListener(listener1);
  addListener(listener2);

  compareListeners(test, "Initial call", [listener1, listener2]);
  compareListeners(test, "Subsequent calls", [listener2]);

  test.done();
};
