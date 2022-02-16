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

const serializeField = "meta";

/**
 * `{@link module:filterMeta filterMeta}` implementation.
 */

class FilterMeta {
  constructor() {
    /**
     * Internal map containing filter meta data.
     * @type {Map.<string, Object>}
     */
    this.map = new Map();
  }

  /**
   * Serializes the meta data of a filter.
   * @param {string} filterText The text of the filter.
   * @yields {string} The next line in the serialized representation of the
   *   meta data of the filter.
   * @see module:filterMeta~FilterMeta#fromObject
   * @package
   */
  *serialize(filterText) {
    let metaData = this.map.get(filterText);
    if (!metaData)
      return;

    yield `${serializeField}=${JSON.stringify(metaData, null, null)}`;
  }

  /**
   * Reads the meta data of a filter from an object representation.
   * @param {string} filterText The text of the filter.
   * @param {Object} object An object containing meta data values
   * @see module:filterMeta~FilterMeta#serialize
   * @package
   */
  fromObject(filterText, object) {
    let metaString = object[serializeField];
    if (!metaString)
      return;

    let metaData = JSON.parse(metaString);
    this.map.set(filterText, metaData);
  }

  /**
   * Returns the filter meta data.
   * @param {string} filterText The text of the filter.
   * @returns {Object} The meta data object.
   */
  getMetaData(filterText) {
    return this.map.get(filterText);
  }

  /**
   * Sets the meta data of the filter.
   * @param {string} filterText The text of the filter.
   * @param {String} field The meta data field.
   * @param {Object} value The meta data field value.
   */
  setMetaData(filterText, field, value) {
    let metaData = this.map.get(filterText);
    if (!metaData)
      metaData = {};
    metaData[field] = value;
    this.map.set(filterText, metaData);
  }
}

/**
 * Maintains filter meta data.
 * @type {module:filterMeta~FilterMeta}
 */
exports.filterMeta = new FilterMeta();
