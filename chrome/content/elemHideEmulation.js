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

/* globals filterToRegExp */

"use strict";

let propertySelectorRegExp = /\[-abp-properties=(["'])([^"']+)\1\]/;

function splitSelector(selector)
{
  if (selector.indexOf(",") == -1)
    return [selector];

  let selectors = [];
  let start = 0;
  let level = 0;
  let sep = "";

  for (let i = 0; i < selector.length; i++)
  {
    let chr = selector[i];

    if (chr == "\\")        // ignore escaped characters
      i++;
    else if (chr == sep)    // don't split within quoted text
      sep = "";             // e.g. [attr=","]
    else if (sep == "")
    {
      if (chr == '"' || chr == "'")
        sep = chr;
      else if (chr == "(")  // don't split between parentheses
        level++;            // e.g. :matches(div,span)
      else if (chr == ")")
        level = Math.max(0, level - 1);
      else if (chr == "," && level == 0)
      {
        selectors.push(selector.substring(start, i));
        start = i + 1;
      }
    }
  }

  selectors.push(selector.substring(start));
  return selectors;
}

function ElemHideEmulation(window, getFiltersFunc, addSelectorsFunc)
{
  this.window = window;
  this.getFiltersFunc = getFiltersFunc;
  this.addSelectorsFunc = addSelectorsFunc;
}

ElemHideEmulation.prototype = {
  stringifyStyle(style)
  {
    let styles = [];
    for (let i = 0; i < style.length; i++)
    {
      let property = style.item(i);
      let value = style.getPropertyValue(property);
      let priority = style.getPropertyPriority(property);
      styles.push(property + ": " + value + (priority ? " !" + priority : "") +
                  ";");
    }
    styles.sort();
    return styles.join(" ");
  },

  isSameOrigin(stylesheet)
  {
    try
    {
      return new URL(stylesheet.href).origin == this.window.location.origin;
    }
    catch (e)
    {
      // Invalid URL, assume that it is first-party.
      return true;
    }
  },

  findSelectors(stylesheet, selectors, filters)
  {
    // Explicitly ignore third-party stylesheets to ensure consistent behavior
    // between Firefox and Chrome.
    if (!this.isSameOrigin(stylesheet))
      return;

    let rules = stylesheet.cssRules;
    if (!rules)
      return;

    for (let rule of rules)
    {
      if (rule.type != rule.STYLE_RULE)
        continue;

      let style = this.stringifyStyle(rule.style);
      for (let pattern of this.patterns)
      {
        if (pattern.regexp.test(style))
        {
          let subSelectors = splitSelector(rule.selectorText);
          for (let subSelector of subSelectors)
          {
            selectors.push(pattern.prefix + subSelector + pattern.suffix);
            filters.push(pattern.text);
          }
        }
      }
    }
  },

  addSelectors(stylesheets)
  {
    let selectors = [];
    let filters = [];
    for (let stylesheet of stylesheets)
      this.findSelectors(stylesheet, selectors, filters);
    this.addSelectorsFunc(selectors, filters);
  },

  onLoad(event)
  {
    let stylesheet = event.target.sheet;
    if (stylesheet)
      this.addSelectors([stylesheet]);
  },

  apply()
  {
    this.getFiltersFunc(patterns =>
    {
      this.patterns = [];
      for (let pattern of patterns)
      {
        let match = propertySelectorRegExp.exec(pattern.selector);
        if (!match)
          continue;

        let propertyExpression = match[2];
        let regexpString;
        if (propertyExpression.length >= 2 && propertyExpression[0] == "/" &&
            propertyExpression[propertyExpression.length - 1] == "/")
        {
          regexpString = propertyExpression.slice(1, -1)
              .replace("\\x7B ", "{").replace("\\x7D ", "}");
        }
        else
          regexpString = filterToRegExp(propertyExpression);

        this.patterns.push({
          text: pattern.text,
          regexp: new RegExp(regexpString, "i"),
          prefix: pattern.selector.substr(0, match.index),
          suffix: pattern.selector.substr(match.index + match[0].length)
        });
      }

      if (this.patterns.length > 0)
      {
        let {document} = this.window;
        this.addSelectors(document.styleSheets);
        document.addEventListener("load", this.onLoad.bind(this), true);
      }
    });
  }
};
