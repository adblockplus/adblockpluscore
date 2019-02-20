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

/**
 * @fileOverview INI parsing.
 */

const {Filter} = require("./filterClasses");
const {Subscription} = require("./subscriptionClasses");

/**
 * Parses filter data.
 */
class INIParser
{
  constructor()
  {
    /**
     * Properties of the filter data.
     * @type {object}
     */
    this.fileProperties = {};

    /**
     * The list of subscriptions in the filter data.
     * @type {Array.<Subscription>}
     */
    this.subscriptions = [];

    /**
     * Known filter texts mapped to their corresponding {@link Filter} objects.
     * @type {Map.<string, Filter>}
     */
    this.knownFilters = new Map();

    /**
     * Known subscription URLs mapped to their corresponding
     * {@link Subscription} objects.
     * @type {Map.<string, Subscription>}
     */
    this.knownSubscriptions = new Map();

    this._wantObj = true;
    this._curObj = this.fileProperties;
    this._curSection = null;
  }

  /**
   * Processes a line of filter data.
   *
   * @param {string?} line The line of filter data to process. This may be
   *   <code>null</code>, which indicates the end of the filter data.
   */
  process(line)
  {
    let origKnownFilters = Filter.knownFilters;
    Filter.knownFilters = this.knownFilters;

    let origKnownSubscriptions = Subscription.knownSubscriptions;
    Subscription.knownSubscriptions = this.knownSubscriptions;

    try
    {
      let match;
      if (this._wantObj === true && (match = /^(\w+)=(.*)$/.exec(line)))
      {
        this._curObj[match[1]] = match[2];
      }
      else if (line === null || (match = /^\s*\[(.+)\]\s*$/.exec(line)))
      {
        if (this._curObj)
        {
          // Process current object before going to next section
          switch (this._curSection)
          {
            case "filter":
              if ("text" in this._curObj)
                Filter.fromObject(this._curObj);
              break;

            case "subscription":
              let subscription = Subscription.fromObject(this._curObj);
              if (subscription)
                this.subscriptions.push(subscription);
              break;

            case "subscription filters":
              if (this.subscriptions.length)
              {
                let currentSubscription = this.subscriptions[
                  this.subscriptions.length - 1
                ];
                for (let text of this._curObj)
                  currentSubscription.addFilterText(text);
              }
              break;
          }
        }

        if (line === null)
          return;

        this._curSection = match[1].toLowerCase();
        switch (this._curSection)
        {
          case "filter":
          case "subscription":
            this._wantObj = true;
            this._curObj = {};
            break;
          case "subscription filters":
            this._wantObj = false;
            this._curObj = [];
            break;
          default:
            this._wantObj = null;
            this._curObj = null;
        }
      }
      else if (this._wantObj === false && line)
      {
        this._curObj.push(line.replace(/\\\[/g, "["));
      }
    }
    finally
    {
      Filter.knownFilters = origKnownFilters;
      Subscription.knownSubscriptions = origKnownSubscriptions;
    }
  }
}

exports.INIParser = INIParser;
