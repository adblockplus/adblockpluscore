/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-2017 eyeo GmbH
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

const abpSelectorRegexp = /:-abp-([\w-]+)\(/i;

let reportError = () => {};

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

/** Return position of node from parent.
 * @param {Node} node the node to find the position of.
 * @return {number} One-based index like for :nth-child(), or 0 on error.
 */
function positionInParent(node)
{
  let {children} = node.parentNode;
  for (let i = 0; i < children.length; i++)
    if (children[i] == node)
      return i + 1;
  return 0;
}

function makeSelector(node, selector)
{
  if (!node.parentElement)
  {
    let newSelector = ":root";
    if (selector)
      newSelector += " > " + selector;
    return newSelector;
  }
  let idx = positionInParent(node);
  if (idx > 0)
  {
    let newSelector = `${node.tagName}:nth-child(${idx})`;
    if (selector)
      newSelector += " > " + selector;
    return makeSelector(node.parentElement, newSelector);
  }

  return selector;
}

function parseSelectorContent(content, startIndex)
{
  let parens = 1;
  let quote = null;
  let i = startIndex;
  for (; i < content.length; i++)
  {
    let c = content[i];
    if (c == "\\")
    {
      // Ignore escaped characters
      i++;
    }
    else if (quote)
    {
      if (c == quote)
        quote = null;
    }
    else if (c == "'" || c == '"')
      quote = c;
    else if (c == "(")
      parens++;
    else if (c == ")")
    {
      parens--;
      if (parens == 0)
        break;
    }
  }

  if (parens > 0)
    return null;
  return {text: content.substring(startIndex, i), end: i};
}

/** Stringified style objects
 * @typedef {Object} StringifiedStyle
 * @property {string} style CSS style represented by a string.
 * @property {string[]} subSelectors selectors the CSS properties apply to.
 */

/**
 * Produce a string representation of the stylesheet entry.
 * @param {CSSStyleRule} rule the CSS style rule.
 * @return {StringifiedStyle} the stringified style.
 */
function stringifyStyle(rule)
{
  let styles = [];
  for (let i = 0; i < rule.style.length; i++)
  {
    let property = rule.style.item(i);
    let value = rule.style.getPropertyValue(property);
    let priority = rule.style.getPropertyPriority(property);
    styles.push(`${property}: ${value}${priority ? " !" + priority : ""};`);
  }
  styles.sort();
  return {
    style: styles.join(" "),
    subSelectors: splitSelector(rule.selectorText)
  };
}

function* evaluate(chain, index, prefix, subtree, styles)
{
  if (index >= chain.length)
  {
    yield prefix;
    return;
  }
  for (let [selector, element] of
       chain[index].getSelectors(prefix, subtree, styles))
    yield* evaluate(chain, index + 1, selector, element, styles);
}

function PlainSelector(selector)
{
  this._selector = selector;
}

PlainSelector.prototype = {
  /**
   * Generator function returning a pair of selector
   * string and subtree.
   * @param {string} prefix the prefix for the selector.
   * @param {Node} subtree the subtree we work on.
   * @param {StringifiedStyle[]} styles the stringified style objects.
   */
  *getSelectors(prefix, subtree, styles)
  {
    yield [prefix + this._selector, subtree];
  }
};

const incompletePrefixRegexp = /[\s>+~]$/;

function HasSelector(selectors)
{
  this._innerSelectors = selectors;
}

HasSelector.prototype = {
  requiresHiding: true,

  *getSelectors(prefix, subtree, styles)
  {
    for (let element of this.getElements(prefix, subtree, styles))
      yield [makeSelector(element, ""), element];
  },

  /**
   * Generator function returning selected elements.
   * @param {string} prefix the prefix for the selector.
   * @param {Node} subtree the subtree we work on.
   * @param {StringifiedStyle[]} styles the stringified style objects.
   */
  *getElements(prefix, subtree, styles)
  {
    let actualPrefix = (!prefix || incompletePrefixRegexp.test(prefix)) ?
        prefix + "*" : prefix;
    let elements = subtree.querySelectorAll(actualPrefix);
    for (let element of elements)
    {
      let newPrefix = makeSelector(element, "");
      let iter = evaluate(this._innerSelectors, 0, newPrefix + " ",
                          element, styles);
      for (let selector of iter)
        // we insert a space between the two. It becomes a no-op if selector
        // doesn't have a combinator
        if (subtree.querySelector(selector))
          yield element;
    }
  }
};

function ContainsSelector(textContent)
{
  this._text = textContent;
}

ContainsSelector.prototype = {
  requiresHiding: true,

  *getSelectors(prefix, subtree, stylesheet)
  {
    for (let element of this.getElements(prefix, subtree, stylesheet))
      yield [makeSelector(element, ""), subtree];
  },

  *getElements(prefix, subtree, stylesheet)
  {
    let actualPrefix = (!prefix || incompletePrefixRegexp.test(prefix)) ?
        prefix + "*" : prefix;
    let elements = subtree.querySelectorAll(actualPrefix);
    for (let element of elements)
      if (element.textContent.includes(this._text))
        yield element;
  }
};

function PropsSelector(propertyExpression)
{
  let regexpString;
  if (propertyExpression.length >= 2 && propertyExpression[0] == "/" &&
      propertyExpression[propertyExpression.length - 1] == "/")
  {
    regexpString = propertyExpression.slice(1, -1)
      .replace("\\x7B ", "{").replace("\\x7D ", "}");
  }
  else
    regexpString = filterToRegExp(propertyExpression);

  this._regexp = new RegExp(regexpString, "i");
}

PropsSelector.prototype = {
  preferHideWithSelector: true,

  *findPropsSelectors(styles, prefix, regexp)
  {
    for (let style of styles)
      if (regexp.test(style.style))
        for (let subSelector of style.subSelectors)
          yield prefix + subSelector;
  },

  *getSelectors(prefix, subtree, styles)
  {
    for (let selector of this.findPropsSelectors(styles, prefix, this._regexp))
      yield [selector, subtree];
  }
};

function ElemHideEmulation(window, getFiltersFunc, addSelectorsFunc,
                           hideElemsFunc)
{
  this.window = window;
  this.getFiltersFunc = getFiltersFunc;
  this.addSelectorsFunc = addSelectorsFunc;
  this.hideElemsFunc = hideElemsFunc;
}

ElemHideEmulation.prototype = {
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

  /** Parse the selector
   * @param {string} selector the selector to parse
   * @return {Array} selectors is an array of objects,
   * or null in case of errors.
   */
  parseSelector(selector)
  {
    if (selector.length == 0)
      return [];

    let match = abpSelectorRegexp.exec(selector);
    if (!match)
      return [new PlainSelector(selector)];

    let selectors = [];
    if (match.index > 0)
      selectors.push(new PlainSelector(selector.substr(0, match.index)));

    let startIndex = match.index + match[0].length;
    let content = parseSelectorContent(selector, startIndex);
    if (!content)
    {
      this.window.console.error(
        new SyntaxError("Failed to parse Adblock Plus " +
                        `selector ${selector} ` +
                        "due to unmatched parentheses."));
      return null;
    }
    if (match[1] == "properties")
      selectors.push(new PropsSelector(content.text));
    else if (match[1] == "has")
    {
      let hasSelectors = this.parseSelector(content.text);
      if (hasSelectors == null)
        return null;
      selectors.push(new HasSelector(hasSelectors));
    }
    else if (match[1] == "contains")
      selectors.push(new ContainsSelector(content.text));
    else
    {
      // this is an error, can't parse selector.
      this.window.console.error(
        new SyntaxError("Failed to parse Adblock Plus " +
                        `selector ${selector}, invalid ` +
                        `pseudo-class :-abp-${match[1]}().`));
      return null;
    }

    let suffix = this.parseSelector(selector.substr(content.end + 1));
    if (suffix == null)
      return null;

    selectors.push(...suffix);

    if (selectors.length == 1 && selectors[0] instanceof ContainsSelector)
    {
      this.window.console.error(
        new SyntaxError("Failed to parse Adblock Plus " +
                        `selector ${selector}, can't ` +
                        "have a lonely :-abp-contains()."));
      return null;
    }
    return selectors;
  },

  addSelectors(stylesheets)
  {
    let selectors = [];
    let selectorFilters = [];

    let elements = [];
    let elementFilters = [];

    let cssStyles = [];

    for (let stylesheet of stylesheets)
    {
      // Explicitly ignore third-party stylesheets to ensure consistent behavior
      // between Firefox and Chrome.
      if (!this.isSameOrigin(stylesheet))
        continue;

      let rules = stylesheet.cssRules;
      if (!rules)
        continue;

      for (let rule of rules)
      {
        if (rule.type != rule.STYLE_RULE)
          continue;

        cssStyles.push(stringifyStyle(rule));
      }
    }

    let {document} = this.window;
    for (let pattern of this.patterns)
    {
      for (let selector of evaluate(pattern.selectors,
                                    0, "", document, cssStyles))
      {
        if (pattern.selectors.some(s => s.preferHideWithSelector) &&
            !pattern.selectors.some(s => s.requiresHiding))
        {
          selectors.push(selector);
          selectorFilters.push(pattern.text);
        }
        else
        {
          for (let element of document.querySelectorAll(selector))
          {
            elements.push(element);
            elementFilters.push(pattern.text);
          }
        }
      }
    }

    this.addSelectorsFunc(selectors, selectorFilters);
    this.hideElemsFunc(elements, elementFilters);
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
        let selectors = this.parseSelector(pattern.selector);
        if (selectors != null && selectors.length > 0)
          this.patterns.push({selectors, text: pattern.text});
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
