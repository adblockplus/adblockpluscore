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

const assert = require("assert");
const {createSandbox} = require("./_common");

describe("EventEmitter", function()
{
  let EventEmitter = null;

  beforeEach(function()
  {
    let sandboxedRequire = createSandbox();
    (
      {EventEmitter} = sandboxedRequire("../lib/events")
    );
  });

  describe("#on()", function()
  {
    let eventEmitter = null;

    beforeEach(function()
    {
      eventEmitter = new EventEmitter();
    });

    it("should not throw when listener is added", function()
    {
      assert.doesNotThrow(() => eventEmitter.on("event", function() {}));
    });

    it("should not throw when second listener is added for same event", function()
    {
      eventEmitter.on("event", function() {});

      assert.doesNotThrow(() => eventEmitter.on("event", function() {}));
    });

    it("should not throw when second listener is added for different event", function()
    {
      eventEmitter.on("event", function() {});

      assert.doesNotThrow(() => eventEmitter.on("otherEvent", function() {}));
    });

    it("should not throw when same listener is re-added for same event", function()
    {
      let listener = function() {};

      eventEmitter.on("event", listener);

      assert.doesNotThrow(() => eventEmitter.on("event", listener));
    });

    it("should not throw when same listener is re-added for different event", function()
    {
      let listener = function() {};

      eventEmitter.on("event", listener);

      assert.doesNotThrow(() => eventEmitter.on("otherEvent", listener));
    });

    it("should not throw when removed listener is re-added for same event", function()
    {
      let listener = function() {};

      eventEmitter.on("event", listener);
      eventEmitter.off("event", listener);

      assert.doesNotThrow(() => eventEmitter.on("event", listener));
    });

    it("should not throw when removed listener is re-added for different event", function()
    {
      let listener = function() {};

      eventEmitter.on("event", listener);
      eventEmitter.off("event", listener);

      assert.doesNotThrow(() => eventEmitter.on("otherEvent", listener));
    });

    it("should not throw when listener is added for event already dispatched", function()
    {
      eventEmitter.emit("event");

      assert.doesNotThrow(() => eventEmitter.on("event", function() {}));
    });

    it("should not throw when listener is added for event already dispatched and handled", function()
    {
      eventEmitter.on("event", function() {});
      eventEmitter.emit("event");

      assert.doesNotThrow(() => eventEmitter.on("event", function() {}));
    });

    it("should not throw when thousandth listener is added for same event", function()
    {
      for (let i = 0; i < 999; i++)
        eventEmitter.on("event", function() {});

      assert.doesNotThrow(() => eventEmitter.on("event", function() {}));
    });

    it("should not throw when thousandth listener is added for different events", function()
    {
      for (let i = 0; i < 999; i++)
        eventEmitter.on(`event-${i + 1}`, function() {});

      assert.doesNotThrow(() => eventEmitter.on("event-1000", function() {}));
    });
  });

  describe("#off()", function()
  {
    let eventEmitter = null;

    beforeEach(function()
    {
      eventEmitter = new EventEmitter();
    });

    it("should not throw when non-existent listener is removed", function()
    {
      assert.doesNotThrow(() => eventEmitter.off("event", function() {}));
    });

    it("should not throw when non-existent listener is removed a second time", function()
    {
      let listener = function() {};

      eventEmitter.off("event", listener);

      assert.doesNotThrow(() => eventEmitter.off("event", listener));
    });

    it("should not throw when second non-existent listener is removed", function()
    {
      eventEmitter.off("event", function() {});

      assert.doesNotThrow(() => eventEmitter.off("event", function() {}));
    });

    it("should not throw when previously added listener is removed", function()
    {
      let listener = function() {};

      eventEmitter.on("event", listener);

      assert.doesNotThrow(() => eventEmitter.off("event", listener));
    });

    it("should not throw when different listener than the one previously added is removed", function()
    {
      eventEmitter.on("event", function() {});

      assert.doesNotThrow(() => eventEmitter.off("event", function() {}));
    });

    it("should not throw when listener is removed for different event than the one for which it was added", function()
    {
      let listener = function() {};

      eventEmitter.on("event", listener);

      assert.doesNotThrow(() => eventEmitter.off("otherEvent", listener));
    });

    it("should not throw when previously added and removed listener is removed a second time", function()
    {
      let listener = function() {};

      eventEmitter.on("event", listener);
      eventEmitter.off("event", listener);

      assert.doesNotThrow(() => eventEmitter.off("event", listener));
    });

    it("should not throw when different listener than the one previously added and removed is removed", function()
    {
      let listener = function() {};

      eventEmitter.on("event", listener);
      eventEmitter.off("event", listener);

      assert.doesNotThrow(() => eventEmitter.off("event", function() {}));
    });

    it("should not throw when non-existent listener is removed for event already dispatched", function()
    {
      eventEmitter.emit("event");

      assert.doesNotThrow(() => eventEmitter.off("event", function() {}));
    });

    it("should not throw when non-existent listener is removed for event already dispatched and handled", function()
    {
      eventEmitter.on("event", function() {});
      eventEmitter.emit("event");

      assert.doesNotThrow(() => eventEmitter.off("event", function() {}));
    });

    it("should not throw when previously added listener is removed for event already dispatched and handled", function()
    {
      let listener = function() {};

      eventEmitter.on("event", listener);
      eventEmitter.emit("event");

      assert.doesNotThrow(() => eventEmitter.off("event", listener));
    });

    it("should not throw when thousandth previously added listener is removed for same event", function()
    {
      let listeners = new Array(1000);
      for (let i = 0; i < listeners.length; i++)
      {
        listeners[i] = function() {};
        eventEmitter.on("event", listeners[i]);
      }

      for (let i = 0; i < listeners.length - 1; i++)
        eventEmitter.off("event", listeners[i]);

      assert.doesNotThrow(() => eventEmitter.off("event", listeners[listeners.length - 1]));
    });

    it("should not throw when thousandth previously added listener is removed for different events", function()
    {
      let listeners = new Array(1000);
      for (let i = 0; i < listeners.length; i++)
      {
        listeners[i] = function() {};
        eventEmitter.on("event", listeners[i]);
      }

      for (let i = 0; i < listeners.length - 1; i++)
        eventEmitter.off(`event-${i + 1}`, listeners[i]);

      assert.doesNotThrow(() => eventEmitter.off("event-1000", listeners[listeners.length - 1]));
    });
  });
});
