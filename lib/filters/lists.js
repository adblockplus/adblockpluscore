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

/** @module */

/**
 * Given some text containing a filter list, parse each line and return all
 * details.
 * @param {string} filters The filter list file/text to parse.
 * @returns {Object.<error?, lines?, params?, minVersion?>} All parsed details,
 *  if available. `lines` will contain the header in the first line.
 */
function parseFilterList(filters, exactLineNumbers) {
  let lines = filters.split(exactLineNumbers ? "\n" : /[\r\n]+/);
  // The filter list always start with a header, at minimum `[Adblock]`.
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

  for (let {hasOwnProperty} = Object.prototype, i = 1; i < lines.length; i++) {
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

exports.parseFilterList = parseFilterList;
