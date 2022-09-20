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
 * A `Recommendation` object represents a recommended filter subscription.
 */
class Recommendation {
  /**
   * Creates a `Recommendation` object from the given source object.
   * @param {object} source The source object.
   * @private
   */
  constructor(source) {
    this._source = source;
  }

  /**
   * The id (UUID) of the subscription.
   * If the id is not null, there is a 1:1 relationship with `id` : `url`.
   * @type {?string}
   */
  get id() {
    return this._source.id;
  }

  /**
   * The required subscription ids.
   * @type {?Array.<string>}
   */
  get requires() {
    return this._source.requires;
  }

  /**
   * The type of the recommended filter subscription.
   * @type {string}
   */
  get type() {
    return this._source.type;
  }

  /**
   * The languages of the recommended filter subscription.
   * @type {Array.<string>}
   */
  get languages() {
    return this._source.languages ? [...this._source.languages] : [];
  }

  /**
   * The title of the recommended filter subscription.
   * @type {string}
   */
  get title() {
    return this._source.title;
  }

  /**
   * The URL of the recommended filter subscription.
   * @type {string}
   */
  get url() {
    return this._source.url;
  }

  /**
   * The home page of the recommended filter subscription.
   * @type {string}
   */
  get homepage() {
    return this._source.homepage;
  }

  /**
   * The manifest v2 URL
   * @type {?string}
   */
  get mv2URL() {
    return this._source.mv2_url;
  }
}

let _recommendations = null;

/**
 * Set the recommendations. This is required. It should be done before
 * any other operation on subscriptions, and shouldn't be called more
 * than once.
 *
 * @param {object} recommendations The available recommended subscriptions.
 */
exports.setRecommendations = function(recommendations) {
  _recommendations = recommendations;
};

/**
 * Yields `{@link module:recommendations~Recommendation Recommendation}` objects
 * representing recommended filter subscriptions.
 *
 * @generator
 * @yields {module:recommendations~Recommendation} An object representing a
 *   recommended filter subscription.
 */
exports.recommendations = function* recommendations() {
  if (!_recommendations)
    _recommendations = require("../data/subscriptions.json");

  for (let source of _recommendations)
    yield new Recommendation(source);
};
