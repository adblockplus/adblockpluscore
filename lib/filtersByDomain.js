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
 * Map to be used instead when a filter has a blank <code>domains</code>
 * property.
 * @type {Map.<string, boolean>}
 */
let defaultDomains = new Map([["", true]]);

/**
 * A <code>FilterMap</code> object contains a set of filters, each mapped to a
 * boolean value indicating whether the filter should be applied. It is used
 * by <code>{@link FiltersByDomain}</code>.
 *
 * @package
 */
class FilterMap
{
  /**
   * Creates a <code>FilterMap</code> object.
   * @private
   */
  constructor(...entries)
  {
    this._map = new Map(...entries);
  }

  /**
   * Returns the number of filters in the object.
   * @returns {number}
   */
  get size()
  {
    return this._map.size;
  }

  /**
   * Yields all the filters in the object along with a boolean value for each
   * filter indicating whether the filter should be applied.
   *
   * @yields {Array} A two-tuple containing an
   *   <code>{@link ActiveFilter}</code> object and a <code>boolean</code>
   *   value.
   */
  *entries()
  {
    yield* this._map;
  }

  /**
   * Returns a boolean value indicating whether the filter referenced by the
   * given key should be applied.
   *
   * @param {ActiveFilter} key The filter.
   *
   * @returns {boolean|undefined} Whether the filter should be applied. If the
   *   object does not contain the filter referenced by <code>key</code>,
   *   returns <code>undefined</code>.
   */
  get(key)
  {
    return this._map.get(key);
  }

  /**
   * Sets the boolean value for the filter referenced by the given key
   * indicating whether the filter should be applied.
   *
   * @param {ActiveFilter} key The filter.
   * @param {boolean} value The boolean value.
   */
  set(key, value)
  {
    this._map.set(key, value);
  }

  /**
   * Removes the filter referenced by the given key.
   *
   * @param {ActiveFilter} key The filter.
   */
  delete(key)
  {
    this._map.delete(key);
  }
}

exports.FilterMap = FilterMap;

/**
 * A <code>FiltersByDomain</code> object contains a set of domains, each mapped
 * to a set of filters along with a boolean value for each filter indicating
 * whether the filter should be applied to the domain.
 *
 * @package
 */
class FiltersByDomain
{
  /**
   * Creates a <code>FiltersByDomain</code> object.
   */
  constructor(...entries)
  {
    this._map = new Map(...entries);
  }

  /**
   * Returns the number of domains in the object.
   * @returns {number}
   */
  get size()
  {
    return this._map.size;
  }

  /**
   * Yields all the domains in the object along with a set of filters for each
   * domain, each filter in turn mapped to a boolean value indicating whether
   * the filter should be applied to the domain.
   *
   * @yields {Array} A two-tuple containing a <code>string</code> and either a
   *   <code>{@link FilterMap}</code> object or a single
   *   <code>{@link ActiveFilter}</code> object. In the latter case, it
   *   directly indicates that the filter should be applied.
   */
  *entries()
  {
    yield* this._map.entries();
  }

  /**
   * Returns a boolean value asserting whether the object contains the domain
   * referenced by the given key.
   *
   * @param {string} key The domain.
   *
   * @returns {boolean} Whether the object contains the domain referenced by
   *   <code>key</code>.
   */
  has(key)
  {
    return this._map.has(key);
  }

  /**
   * Returns a set of filters for the domain referenced by the given key, along
   * with a boolean value for each filter indicating whether the filter should
   * be applied to the domain.
   *
   * @param {string} key The domain.
   *
   * @returns {FilterMap|ActiveFilter|undefined} Either a
   *   <code>{@link FilterMap}</code> object or a single
   *   <code>{@link ActiveFilter}</code> object. In the latter case, it
   *   directly indicates that the filter should be applied. If this
   *   <code>FiltersByDomain</code> object does not contain the domain
   *   referenced by <code>key</code>, the return value is
   *   <code>undefined</code>.
   */
  get(key)
  {
    return this._map.get(key);
  }

  /**
   * Removes all the domains in the object.
   */
  clear()
  {
    this._map.clear();
  }

  /**
   * Adds a filter and all of its domains to the object.
   *
   * @param {ActiveFilter} filter The filter.
   * @param {Map.<string, boolean>} [domains] The filter's domains. If not
   *   given, the <code>{@link domains}</code> property of <code>filter</code>
   *   is used.
   */
  add(filter, domains = filter.domains)
  {
    for (let [domain, include] of domains || defaultDomains)
    {
      if (!include && domain == "")
        continue;

      let map = this._map.get(domain);
      if (!map)
      {
        this._map.set(domain, include ? filter :
                                new FilterMap([[filter, false]]));
      }
      else if (map.size == 1 && !(map instanceof FilterMap))
      {
        if (filter != map)
        {
          this._map.set(domain, new FilterMap([[map, true],
                                               [filter, include]]));
        }
      }
      else
      {
        map.set(filter, include);
      }
    }
  }

  /**
   * Removes a filter and all of its domains from the object.
   *
   * @param {ActiveFilter} filter The filter.
   * @param {Map.<string, boolean>} [domains] The filter's domains. If not
   *   given, the <code>{@link domains}</code> property of <code>filter</code>
   *   is used.
   */
  remove(filter, domains = filter.domains)
  {
    for (let domain of (domains || defaultDomains).keys())
    {
      let map = this._map.get(domain);
      if (map)
      {
        if (map.size > 1 || map instanceof FilterMap)
        {
          map.delete(filter);

          if (map.size == 0)
          {
            this._map.delete(domain);
          }
          else if (map.size == 1)
          {
            for (let [lastFilter, include] of map.entries())
            {
              // Reduce Map { "example.com" => Map { filter => true } } to
              // Map { "example.com" => filter }
              if (include)
                this._map.set(domain, lastFilter);

              break;
            }
          }
        }
        else if (filter == map)
        {
          this._map.delete(domain);
        }
      }
    }
  }
}

exports.FiltersByDomain = FiltersByDomain;
