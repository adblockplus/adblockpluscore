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

mergeInto(LibraryManager.library, {
  LogString: function(str)
  {
    console.log(readString(str));
  },

  LogInteger: function(i)
  {
    console.log(i);
  },

  LogPointer: function(ptr)
  {
    console.log(ptr);
  },

  LogError: function(str)
  {
    console.error(new Error(readString(str)).stack);
  },

  CharToLower: function(charCode)
  {
    return String.fromCharCode(charCode).toLowerCase().charCodeAt(0);
  },

  JSNotifyFilterChange: function(topic, filter)
  {
    FilterNotifier.triggerListeners(notifierTopics.get(topic),
        exports.Filter.fromPointer(filter));
  },

  JSNotifySubscriptionChange: function(topic, subscription)
  {
    FilterNotifier.triggerListeners(notifierTopics.get(topic),
        exports.Subscription.fromPointer(subscription));
  },

  $_regexp_data: Object.create(null),
  $_regexp_counter: 0,

  GenerateRegExp__deps: ["$_regexp_data", "$_regexp_counter"],
  GenerateRegExp: function(source, matchCase)
  {
    var id = ++_regexp_counter;
    try
    {
      _regexp_data[id] = new RegExp(readString(source), matchCase ? "" : "i");
      return id;
    }
    catch (e)
    {
      return -1;
    }
  },

  DeleteRegExp__deps: ["$_regexp_data"],
  DeleteRegExp: function(id)
  {
    delete _regexp_data[id];
  },

  TestRegExp__deps: ["$_regexp_data"],
  TestRegExp: function(id, str)
  {
    return _regexp_data[id].test(readString(str));
  }
});
