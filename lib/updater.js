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
 * @fileOverview Encapsulates the details of update logic.
 */

const {Filter} = require("./filterClasses");
const {filterStorage} = require("./filterStorage");

let FullUpdater =
/**
 * Full updater: fetches all subscription filters
 */
exports.FullUpdater = class FullUpdater {
  /**
   * Given some text containing filters, parse each line and return all details.
   * @param {string} responseText The subscription response text to parse.
   * @returns {Object.<error?,lines?,params?,minVersion?>} All parsed details,
   *  if available.
   */
  parseFilters(responseText) {
    let lines = responseText.split(/[\r\n]+/);
    let headerMatch = /\[Adblock(?:\s*Plus\s*([\d.]+)?)?\]/i.exec(lines[0]);

    if (!headerMatch)
      return {error: "synchronize_invalid_data"};

    let minVersion = headerMatch[1];

    let params = {
      redirect: null,
      homepage: null,
      title: null,
      version: null,
      expires: null,
      abtest: null
    };

    for (let {hasOwnProperty} = Object.prototype, i = 1; i < lines.length; i++){
      let match = /^\s*!\s*(.*?)\s*:\s*(.*)/.exec(lines[i]);
      if (!match)
        break;

      let keyword = match[1].toLowerCase();
      if (hasOwnProperty.call(params, keyword)) {
        params[keyword] = match[2];
        lines.splice(i--, 1);
      }
    }

    return {lines, params, minVersion};
  }

  /**
   * Given a list of parsed filters, normalize each line and update the
   * subscription.
   * @param {module:subscriptionClasses.Subscription} subscription The
   *  Subscription to use as reference for manually added filters.
   * @param {string[]} lines The parsed filters lines.
   */
  processFilters(subscription, lines) {
    subscription.mark("processing.started");

    lines.shift();
    let filterText = [];
    for (let line of lines) {
      line = Filter.normalize(line);
      if (line)
        filterText.push(line);
    }

    filterStorage.updateSubscriptionFilters(subscription, filterText);

    subscription.mark("processing.finished");
  }
};

exports.fullUpdater = new FullUpdater();
