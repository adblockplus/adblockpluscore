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
 * Map to be used instead when a filter has a blank `domains` property.
 * @type {Map.<string, boolean>}
 */
let defaultDomains = new Map([["", true]]);

let FilterMap =
/**
 * A `FilterMap` object contains a set of filters, each mapped to a boolean
 * value indicating whether the filter should be applied.
 *
 * It is used by
 * `{@link module:filtersByDomain.FiltersByDomain FiltersByDomain}`.
 *
 * @package
 */
exports.FilterMap = class FilterMap extends Map {};

/**
 * A `FiltersByDomain` object contains a set of domains, each mapped to a set
 * of filters along with a boolean value for each filter indicating whether the
 * filter should be applied to the domain.
 *
 * @package
 */
exports.FiltersByDomain = class FiltersByDomain extends Map {
  /**
   * Adds a filter and all of its domains to the object.
   *
   * @param {module:filterClasses.ActiveFilter} filter The filter.
   * @param {Map.<string, boolean>} [domains] The filter's domains. If not
   *   given, the `{@link module:filterClasses.ActiveFilter#domains domains}`
   *   property of `filter` is used.
   */
  add(filter, domains = filter.domains) {
    for (let [domain, include] of domains || defaultDomains) {
      if (!include && domain == "")
        continue;

      let map = this.get(domain);
      if (!map) {
        this.set(domain, include ? filter : new FilterMap([[filter, false]]));
      }
      else if (map.size == 1 && !(map instanceof FilterMap)) {
        if (filter != map)
          this.set(domain, new FilterMap([[map, true], [filter, include]]));
      }
      else {
        map.set(filter, include);
      }
    }
  }

  /**
   * Removes a filter and all of its domains from the object.
   *
   * @param {module:filterClasses.ActiveFilter} filter The filter.
   * @param {Map.<string, boolean>} [domains] The filter's domains. If not
   *   given, the `{@link module:filterClasses.ActiveFilter#domains domains}`
   *   property of `filter` is used.
   */
  remove(filter, domains = filter.domains) {
    for (let domain of (domains || defaultDomains).keys()) {
      let map = this.get(domain);
      if (map) {
        if (map.size > 1 || map instanceof FilterMap) {
          map.delete(filter);

          if (map.size == 0) {
            this.delete(domain);
          }
          else if (map.size == 1) {
            for (let [lastFilter, include] of map.entries()) {
              // Reduce Map { "example.com" => Map { filter => true } } to
              // Map { "example.com" => filter }
              if (include)
                this.set(domain, lastFilter);

              break;
            }
          }
        }
        else if (filter == map) {
          this.delete(domain);
        }
      }
    }
  }
};
