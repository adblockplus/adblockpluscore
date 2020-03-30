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

/* eslint-env webextensions */
/* eslint no-console: "off" */

"use strict";

/**
 * @typedef {object} FetchContentInfo
 * @property {function} remove
 * @property {Promise} result
 * @property {number} timer
 * @private
 */

/**
 * @type {Map.<string, FetchContentInfo>}
 * @private
 */
let fetchContentMap = new Map();

/**
 * Returns a potentially already resolved fetch auto cleaning,
 * if not requested again, after a certain amount of milliseconds.
 * The resolved fetch is by default <code>arrayBuffer</code> but it can be
 * any other kind through the configuration object.
 *
 * @param {string} url The url to fetch
 * @param {object} [options] Optional configuration options.
 *                            By default is {as: "arrayBuffer", cleanup: 60000}
 * @param {string} [options.as] The fetch type: "arrayBuffer", "json", "text"..
 * @param {number} [options.cleanup] The cache auto-cleanup delay in ms: 60000
 *
 * @returns {Promise} The fetched result as Uint8Array|string.
 *
 * @example
 * fetchContent('https://any.url.com').then(arrayBuffer => { ... })
 * @example
 * fetchContent('https://a.com', {as: 'json'}).then(json => { ... })
 * @example
 * fetchContent('https://a.com', {as: 'text'}).then(text => { ... })
 * @private
 */
function fetchContent(url, {as = "arrayBuffer", cleanup = 60000} = {})
{
  // make sure the fetch type is unique as the url fetching text or arrayBuffer
  // will fetch same url twice but it will resolve it as expected instead of
  // keeping the fetch potentially hanging forever.
  let uid = as + ":" + url;
  let details = fetchContentMap.get(uid) || {
    remove: () => fetchContentMap.delete(uid),
    result: null,
    timer: 0
  };
  clearTimeout(details.timer);
  details.timer = setTimeout(details.remove, cleanup);
  if (!details.result)
  {
    details.result = fetch(url).then(response => response[as]());
    details.result.catch(details.remove);
    fetchContentMap.set(uid, details);
  }
  return details.result;
}

/**
 * Escapes regular expression special characters in a string. The returned
 * string may be passed to the <code>RegExp</code> constructor to match the
 * original string.
 *
 * @param {string} string The string in which to escape special characters.
 *
 * @returns {string} A new string with the special characters escaped.
 * @private
 */
function regexEscape(string)
{
  return string.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

/**
 * Converts a given pattern to a regular expression.
 *
 * @param {string} pattern The pattern to convert. If the pattern begins and
 * ends with a slash (<code>/</code>), the text in between is treated as a
 * regular expression; otherwise the pattern is treated as raw text.
 *
 * @returns {RegExp} A <code>RegExp</code> object based on the given pattern.
 * @private
 */
function toRegExp(pattern)
{
  if (pattern.length >= 2 && pattern[0] == "/" &&
      pattern[pattern.length - 1] == "/")
  {
    return new RegExp(pattern.substring(1, pattern.length - 1));
  }

  return new RegExp(regexEscape(pattern));
}

/**
 * Converts a number to its hexadecimal representation.
 *
 * @param {number} number The number to convert.
 * @param {number} [length] The <em>minimum</em> length of the hexadecimal
 *   representation. For example, given the number <code>1024</code> and the
 *   length <code>8</code>, the function returns the value
 *   <code>"00000400"</code>.
 *
 * @returns {string} The hexadecimal representation of the given number.
 * @private
 */
function toHex(number, length = 2)
{
  let hex = number.toString(16);

  if (hex.length < length)
    hex = "0".repeat(length - hex.length) + hex;

  return hex;
}

/**
 * Converts a <code>Uint8Array</code> object into its hexadecimal
 * representation.
 *
 * @param {Uint8Array} uint8Array The <code>Uint8Array</code> object to
 * convert.
 *
 * @returns {string} The hexadecimal representation of the given
 *   <code>Uint8Array</code> object.
 * @private
 */
function uint8ArrayToHex(uint8Array)
{
  return uint8Array.reduce((hex, byte) => hex + toHex(byte), "");
}

/**
 * Returns the value of the <code>cssText</code> property of the object
 * returned by <code>getComputedStyle</code> for the given element. If the
 * value of the <code>cssText</code> property is blank, this function computes
 * the value out of the properties available in the object.
 *
 * @param {Element} element The element for which to get the computed CSS text.
 *
 * @returns {string} The computed CSS text.
 * @private
 */
function getComputedCSSText(element)
{
  let style = getComputedStyle(element);
  let {cssText} = style;

  if (cssText)
    return cssText;

  for (let property of style)
    cssText += `${property}: ${style[property]}; `;

  return cssText.trim();
}

/**
 * Injects JavaScript code into the document using a temporary
 * <code>script</code> element.
 *
 * @param {string} code The code to inject.
 * @param {Array.<function|string>} [dependencies] A list of dependencies
 *   to inject along with the code. A dependency may be either a function or a
 *   string containing some executable code.
 * @private
 */
function injectCode(code, dependencies = [])
{
  let executable = `
    (function()
    {
      "use strict";
      let debug = ${debug};
      ${dependencies.join("\n")}
      ${code}
    })();
  `;

  let script = document.createElement("script");

  script.type = "application/javascript";
  script.async = false;

  // Firefox 58 only bypasses site CSPs when assigning to 'src',
  // while Chrome 67 and Microsoft Edge (tested on 44.17763.1.0)
  // only bypass site CSPs when using 'textContent'.
  if (browser.runtime.getURL("").startsWith("moz-extension://"))
  {
    let url = URL.createObjectURL(new Blob([executable]));
    script.src = url;
    document.documentElement.appendChild(script);
    URL.revokeObjectURL(url);
  }
  else
  {
    script.textContent = executable;
    document.documentElement.appendChild(script);
  }

  document.documentElement.removeChild(script);
}

/**
 * Converts a function and an optional list of arguments into a string of code
 * containing a function call. The function is converted to its string
 * representation using the <code>Function.prototype.toString</code> method.
 * Each argument is stringified using <code>JSON.stringify</code>.
 *
 * @param {function} func The function to convert.
 * @param {...*} [params] The arguments to convert.
 *
 * @returns {string} The generated code containing the function call.
 * @private
 */
function stringifyFunctionCall(func, ...params)
{
  // Call JSON.stringify on the arguments to avoid any arbitrary code
  // execution.
  return `(${func})(${params.map(JSON.stringify).join(",")});`;
}

/**
 * Wraps a function and its dependencies into an injector. The injector, when
 * called with zero or more arguments, generates code that calls the function,
 * with the given arguments, if any, and injects the code, along with any
 * dependencies, into the document using a temporary <code>script</code>
 * element.
 *
 * @param {function} injectable The function to wrap into an injector.
 * @param {...(function|string)} [dependencies] Any dependencies of the
 *   function. A dependency may be either a function or a string containing
 *   some executable code.
 *
 * @returns {function} The generated injector.
 * @private
 */
function makeInjector(injectable, ...dependencies)
{
  return (...args) => injectCode(stringifyFunctionCall(injectable, ...args),
                                 dependencies);
}

/**
 * Hides an HTML element by setting its <code>style</code> attribute to
 * <code>display: none !important</code>.
 *
 * @param {HTMLElement} element The HTML element to hide.
 * @private
 */
function hideElement(element)
{
  element.style.setProperty("display", "none", "important");

  // Listen for changes to the style property and if our values are unset
  // then reset them.
  new MutationObserver(() =>
  {
    if (element.style.getPropertyValue("display") != "none" ||
        element.style.getPropertyPriority("display") != "important")
    {
      element.style.setProperty("display", "none", "important");
    }
  })
  .observe(element, {attributes: true, attributeFilter: ["style"]});
}

/**
 * Highlights an HTML element by setting its `style` attribute to
 * `border: red; border-width: thick; border-style: dashed;`.
 *
 * @param {HTMLElement} element The HTML element to highlight.
 * @private
 */
function highlightElement(element)
{
  element.style.setProperty("border", "red");
  element.style.setProperty("border-width", "thick");
  element.style.setProperty("border-style", "dashed");
}

/**
 * Observes changes to a DOM node using a <code>MutationObserver</code>.
 *
 * @param {Node} target The DOM node to observe for changes.
 * @param {MutationObserverInit?} [options] Options that describe what DOM
 *   mutations should be reported to the callback.
 * @param {function} callback A function that will be called on each DOM
 *   mutation, taking a <code>MutationRecord</code> as its parameter.
 * @private
 */
function observe(target, options, callback)
{
  new MutationObserver(mutations =>
  {
    for (let mutation of mutations)
      callback(mutation);
  })
  .observe(target, options);
}

/**
 * Logs its arguments to the console. This may be used for testing and
 * debugging.
 *
 * @param {...*} [args] The arguments to log.
 *
 * @since Adblock Plus 3.3
 */
function log(...args)
{
  if (debug)
  {
    args.unshift("%c DEBUG", "font-weight: bold");
  }
  console.log(...args);
}

exports.log = log;

/**
 * Similar to {@link log}, but does the logging in the context of the document
 * rather than the content script. This may be used for testing and debugging,
 * especially to verify that the injection of snippets into the document is
 * working without any errors.
 *
 * @param {...*} [args] The arguments to log.
 *
 * @since Adblock Plus 3.3
 */
function trace(...args)
{
  // We could simply use console.log here, but the goal is to demonstrate the
  // usage of snippet dependencies.
  log(...args);
}

exports.trace = makeInjector(trace, log);

/**
 * This is an implementation of the <code>uabinject-defuser</code> technique
 * used by
 * {@link https://github.com/uBlockOrigin/uAssets/blob/c091f861b63cd2254b8e9e4628f6bdcd89d43caa/filters/resources.txt#L640 uBlock Origin}.
 * @alias module:content/snippets.uabinject-defuser
 *
 * @since Adblock Plus 3.3
 */
function uabinjectDefuser()
{
  window.trckd = true;
  window.uabpdl = true;
  window.uabInject = true;
  window.uabDetect = true;
}

exports["uabinject-defuser"] = makeInjector(uabinjectDefuser);

/**
 * Hides any HTML element or one of its ancestors matching a CSS selector if
 * the text content of the element's shadow contains a given string.
 * @alias module:content/snippets.hide-if-shadow-contains
 *
 * @param {string} search The string to look for in every HTML element's
 *   shadow. If the string begins and ends with a slash (<code>/</code>), the
 *   text in between is treated as a regular expression.
 * @param {string} selector The CSS selector that an HTML element must match
 *   for it to be hidden.
 *
 * @since Adblock Plus 3.3
 */
function hideIfShadowContains(search, selector = "*")
{
  let originalAttachShadow = Element.prototype.attachShadow;

  // If there's no Element.attachShadow API present then we don't care, it must
  // be Firefox or an older version of Chrome.
  if (!originalAttachShadow)
    return;

  let re = toRegExp(search);

  // Mutation observers mapped to their corresponding shadow roots and their
  // hosts.
  let shadows = new WeakMap();

  function observeShadow(mutations, observer)
  {
    let {host, root} = shadows.get(observer) || {};

    // Since it's a weak map, it's possible that either the element or its
    // shadow has been removed.
    if (!host || !root)
      return;

    // If the shadow contains the given text, check if the host or one of its
    // ancestors matches the selector; if a matching element is found, hide
    // it.
    if (re.test(root.textContent))
    {
      let closest = host.closest(selector);
      if (closest)
        hideElement(closest);
    }
  }

  Object.defineProperty(Element.prototype, "attachShadow", {
    value(...args)
    {
      // Create the shadow root first. It doesn't matter if it's a closed
      // shadow root, we keep the reference in a weak map.
      let root = originalAttachShadow.apply(this, args);

      // Listen for relevant DOM mutations in the shadow.
      let observer = new MutationObserver(observeShadow);
      observer.observe(root, {
        childList: true,
        characterData: true,
        subtree: true
      });

      // Keep references to the shadow root and its host in a weak map. If
      // either the shadow is detached or the host itself is removed from the
      // DOM, the mutation observer too will be freed eventually and the entry
      // will be removed.
      shadows.set(observer, {host: this, root});

      return root;
    }
  });
}

exports["hide-if-shadow-contains"] = makeInjector(hideIfShadowContains,
                                                  toRegExp, regexEscape,
                                                  hideElement);

/**
 * Hides any HTML element or one of its ancestors matching a CSS selector if
 * it matches the provided condition.
 *
 * @param {function} match The function that provides the matching condition.
 * @param {string} selector The CSS selector that an HTML element must match
 *   for it to be hidden.
 * @param {?string} [searchSelector] The CSS selector that an HTML element
 *   containing the given string must match. Defaults to the value of the
 *   <code>selector</code> argument.
 * @private
 */
function hideIfMatches(match, selector, searchSelector)
{
  if (searchSelector == null)
    searchSelector = selector;

  let callback = () =>
  {
    for (let element of document.querySelectorAll(searchSelector))
    {
      let closest = element.closest(selector);
      if (closest && match(element, closest))
        hideElement(closest);
    }
  };
  new MutationObserver(callback)
    .observe(document, {childList: true, characterData: true, subtree: true});
  callback();
}

/**
 * Hides any HTML element or one of its ancestors matching a CSS selector if
 * the text content of the element contains a given string.
 * @alias module:content/snippets.hide-if-contains
 *
 * @param {string} search The string to look for in HTML elements. If the
 *   string begins and ends with a slash (<code>/</code>), the text in between
 *   is treated as a regular expression.
 * @param {string} selector The CSS selector that an HTML element must match
 *   for it to be hidden.
 * @param {?string} [searchSelector] The CSS selector that an HTML element
 *   containing the given string must match. Defaults to the value of the
 *   <code>selector</code> argument.
 *
 * @since Adblock Plus 3.3
 */
function hideIfContains(search, selector = "*", searchSelector = null)
{
  let re = toRegExp(search);

  hideIfMatches(element => re.test(element.textContent),
                selector, searchSelector);
}

exports["hide-if-contains"] = hideIfContains;

/**
 * Hides any HTML element matching a CSS selector if the visible text content
 * of the element contains a given string.
 * @alias module:content/snippets.hide-if-contains-visible-text
 *
 * @param {string} search The string to match to the visible text. Is considered
 *   visible text that isn't hidden by CSS properties or other means.
 *   If the string begins and ends with a slash (<code>/</code>), the
 *   text in between is treated as a regular expression.
 * @param {string} selector The CSS selector that an HTML element must match
 *   for it to be hidden.
 * @param {?string} [searchSelector] The CSS selector that an HTML element
 *   containing the given string must match. Defaults to the value of the
 *   <code>selector</code> argument.
 *
 * @since Adblock Plus 3.6
 */
function hideIfContainsVisibleText(search, selector, searchSelector = null)
{
  /**
   * Determines if the text inside the element is visible.
   *
   * @param {Element} element The element we are checking.
   * @param {?CSSStyleDeclaration} style The computed style of element. If
   *   falsey it will be queried.
   * @returns {bool} Whether the text is visible.
   * @private
   */
  function isTextVisible(element, style)
  {
    if (!style)
      style = window.getComputedStyle(element);

    if (style.getPropertyValue("opacity") == "0")
      return false;
    if (style.getPropertyValue("font-size") == "0px")
      return false;

    let color = style.getPropertyValue("color");
    // if color is transparent...
    if (color == "rgba(0, 0, 0, 0)")
      return false;
    if (style.getPropertyValue("background-color") == color)
      return false;

    return true;
  }

  /**
   * Check if an element is visible
   *
   * @param {Element} element The element to check visibility of.
   * @param {CSSStyleDeclaration} style The computed style of element.
   * @param {?Element} closest The closest parent to reach.
   * @return {bool} Whether the element is visible.
   * @private
   */
  function isVisible(element, style, closest)
  {
    if (style.getPropertyValue("display") == "none")
      return false;

    let visibility = style.getPropertyValue("visibility");
    if (visibility == "hidden" || visibility == "collapse")
      return false;

    if (!closest || element == closest)
      return true;

    let parent = element.parentElement;
    if (!parent)
      return true;

    return isVisible(parent, window.getComputedStyle(parent), closest);
  }

  /**
   * Check if a pseudo element has visible text via `content`.
   *
   * @param {Element} element The element to check visibility of.
   * @param {string} pseudo The `::before` or `::after` pseudo selector.
   * @return {string} The pseudo content or an empty string.
   * @private
   */
  function getPseudoContent(element, pseudo)
  {
    let style = window.getComputedStyle(element, pseudo);
    if (!isVisible(element, style) || !isTextVisible(element, style))
      return "";

    let {content} = style;
    if (content && content !== "none")
    {
      let strings = [];

      // remove all strings, in quotes, including escaping chars, putting
      // instead `\x01${string-index}` in place, which is not valid CSS,
      // so that it's safe to parse it back at the end of the operation.
      content = content.trim().replace(
        /(["'])(?:(?=(\\?))\2.)*?\1/g,
        value => `\x01${strings.push(value.slice(1, -1)) - 1}`
      );

      // replace attr(...) with the attribute value or an empty string,
      // ignoring units and fallback values, as these do not work, or have,
      // any meaning in the CSS `content` property value.
      content = content.replace(
        /\s*attr\(\s*([^\s,)]+)[^)]*?\)\s*/g,
        (_, name) => element.getAttribute(name) || ""
      );

      // replace back all `\x01${string-index}` values with their corresponding
      // strings, so that the outcome is a real, cleaned up, `content` value.
      return content.replace(/\x01(\d+)/g, (_, index) => strings[index]);
    }
    return "";
  }

  /**
   * Returns the visible text content from an element and its descendants.
   *
   * @param {Element} element The element whose visible text we want.
   * @param {Element} closest The closest parent to reach while checking
   *   for visibility.
   * @param {?CSSStyleDeclaration} style The computed style of element. If
   *   falsey it will be queried.
   * @returns {string} The text that is visible.
   * @private
   */
  function getVisibleContent(element, closest, style)
  {
    let checkClosest = !style;
    if (checkClosest)
      style = window.getComputedStyle(element);

    if (!isVisible(element, style, checkClosest && closest))
      return "";

    let text = getPseudoContent(element, ":before");
    for (let node of element.childNodes)
    {
      switch (node.nodeType)
      {
        case Node.ELEMENT_NODE:
          text += getVisibleContent(node,
                                    element,
                                    window.getComputedStyle(node));
          break;
        case Node.TEXT_NODE:
          if (isTextVisible(element, style))
            text += node.nodeValue;
          break;
      }
    }
    return text + getPseudoContent(element, ":after");
  }

  let re = toRegExp(search);
  let seen = new WeakSet();

  hideIfMatches(
    (element, closest) =>
    {
      if (seen.has(element))
        return false;

      seen.add(element);
      let text = getVisibleContent(element, closest);
      let result = re.test(text);
      if (debug && text.length)
        log(result, re, text);
      return result;
    },
    selector,
    searchSelector
  );
}

exports["hide-if-contains-visible-text"] = hideIfContainsVisibleText;

/**
 * Hides any HTML element or one of its ancestors matching a CSS selector if
 * the text content of the element contains a given string and, optionally, if
 * the element's computed style contains a given string.
 * @alias module:content/snippets.hide-if-contains-and-matches-style
 *
 * @param {string} search The string to look for in HTML elements. If the
 *   string begins and ends with a slash (<code>/</code>), the text in between
 *   is treated as a regular expression.
 * @param {string} selector The CSS selector that an HTML element must match
 *   for it to be hidden.
 * @param {string?} [searchSelector] The CSS selector that an HTML element
 *   containing the given string must match. Defaults to the value of the
 *   <code>selector</code> argument.
 * @param {string?} [style] The string that the computed style of an HTML
 *   element matching <code>selector</code> must contain. If the string begins
 *   and ends with a slash (<code>/</code>), the text in between is treated as
 *   a regular expression.
 * @param {string?} [searchStyle] The string that the computed style of an HTML
 *   element matching <code>searchSelector</code> must contain. If the string
 *   begins and ends with a slash (<code>/</code>), the text in between is
 *   treated as a regular expression.
 *
 * @since Adblock Plus 3.3.2
 */
function hideIfContainsAndMatchesStyle(search, selector = "*",
                                       searchSelector = null, style = null,
                                       searchStyle = null)
{
  if (searchSelector == null)
    searchSelector = selector;

  let searchRegExp = toRegExp(search);

  let styleRegExp = style ? toRegExp(style) : null;
  let searchStyleRegExp = searchStyle ? toRegExp(searchStyle) : null;

  new MutationObserver(() =>
  {
    for (let element of document.querySelectorAll(searchSelector))
    {
      if (searchRegExp.test(element.textContent) &&
          (!searchStyleRegExp ||
           searchStyleRegExp.test(getComputedCSSText(element))))
      {
        let closest = element.closest(selector);
        if (closest && (!styleRegExp ||
                        styleRegExp.test(getComputedCSSText(closest))))
        {
          hideElement(closest);
        }
      }
    }
  })
  .observe(document, {childList: true, characterData: true, subtree: true});
}

exports["hide-if-contains-and-matches-style"] = hideIfContainsAndMatchesStyle;

/**
 * Hides any HTML element or one of its ancestors matching a CSS selector if a
 * descendant of the element matches a given CSS selector and, optionally, if
 * the element's computed style contains a given string.
 * @alias module:content/snippets.hide-if-has-and-matches-style
 *
 * @param {string} search The CSS selector against which to match the
 *   descendants of HTML elements.
 * @param {string} selector The CSS selector that an HTML element must match
 *   for it to be hidden.
 * @param {?string} [searchSelector] The CSS selector that an HTML element
 *   containing the specified descendants must match. Defaults to the value of
 *   the <code>selector</code> argument.
 * @param {?string} [style] The string that the computed style of an HTML
 *   element matching <code>selector</code> must contain. If the string begins
 *   and ends with a slash (<code>/</code>), the text in between is treated as
 *   a regular expression.
 * @param {?string} [searchStyle] The string that the computed style of an HTML
 *   element matching <code>searchSelector</code> must contain. If the string
 *   begins and ends with a slash (<code>/</code>), the text in between is
 *   treated as a regular expression.
 *
 * @since Adblock Plus 3.4.2
 */
function hideIfHasAndMatchesStyle(search, selector = "*",
                                  searchSelector = null, style = null,
                                  searchStyle = null)
{
  if (searchSelector == null)
    searchSelector = selector;

  let styleRegExp = style ? toRegExp(style) : null;
  let searchStyleRegExp = searchStyle ? toRegExp(searchStyle) : null;

  new MutationObserver(() =>
  {
    for (let element of document.querySelectorAll(searchSelector))
    {
      if (element.querySelector(search) &&
          (!searchStyleRegExp ||
           searchStyleRegExp.test(getComputedCSSText(element))))
      {
        let closest = element.closest(selector);
        if (closest && (!styleRegExp ||
                        styleRegExp.test(getComputedCSSText(closest))))
        {
          hideElement(closest);
        }
      }
    }
  })
  .observe(document, {childList: true, subtree: true});
}

exports["hide-if-has-and-matches-style"] = hideIfHasAndMatchesStyle;

/**
 * Hides any HTML element or one of its ancestors matching a CSS selector if
 * the background image of the element matches a given pattern.
 * @alias module:content/snippets.hide-if-contains-image
 *
 * @param {string} search The pattern to look for in the background images of
 *   HTML elements. This must be the hexadecimal representation of the image
 *   data for which to look. If the string begins and ends with a slash
 *   (<code>/</code>), the text in between is treated as a regular expression.
 * @param {string} selector The CSS selector that an HTML element must match
 *   for it to be hidden.
 * @param {?string} [searchSelector] The CSS selector that an HTML element
 *   containing the given pattern must match. Defaults to the value of the
 *   <code>selector</code> argument.
 *
 * @since Adblock Plus 3.4.2
 */
function hideIfContainsImage(search, selector, searchSelector)
{
  if (searchSelector == null)
    searchSelector = selector;

  let searchRegExp = toRegExp(search);

  new MutationObserver(() =>
  {
    for (let element of document.querySelectorAll(searchSelector))
    {
      let style = getComputedStyle(element);
      let match = style["background-image"].match(/^url\("(.*)"\)$/);
      if (match)
      {
        fetchContent(match[1]).then(content =>
        {
          if (searchRegExp.test(uint8ArrayToHex(new Uint8Array(content))))
          {
            let closest = element.closest(selector);
            if (closest)
              hideElement(closest);
          }
        });
      }
    }
  })
  .observe(document, {childList: true, subtree: true});
}

exports["hide-if-contains-image"] = hideIfContainsImage;

/**
 * Readds to the document any removed HTML elements that match a CSS selector.
 *
 * @param {string} selector The CSS selector that a removed HTML element should
 *   match for it to be added back.
 * @param {string?} [parentSelector] The CSS selector that a removed HTML
 *   element's former parent should match for it to be added back.
 *
 * @since Adblock Plus 3.3
 */
function readd(selector, parentSelector = null)
{
  observe(document, {childList: true, subtree: true}, mutation =>
  {
    if (mutation.removedNodes &&
        (!parentSelector || (mutation.target instanceof Element &&
                             mutation.target.matches(parentSelector))))
    {
      for (let node of mutation.removedNodes)
      {
        if (node instanceof HTMLElement && node.matches(selector))
        {
          // We don't have the location of the element in its former parent,
          // but it's usually OK to just add it at the end.
          mutation.target.appendChild(node);
        }
      }
    }
  });
}

exports.readd = readd;

/**
 * Wraps the <code>console.dir</code> API to call the <code>toString</code>
 * method of the argument.
 * @alias module:content/snippets.dir-string
 *
 * @param {string} [times=1] The number of times to call the
 *   <code>toString</code> method of the argument to <code>console.dir</code>.
 *
 * @since Adblock Plus 3.4
 */
function dirString(times = "1")
{
  let {dir} = console;

  console.dir = function(object)
  {
    for (let i = 0; i < times; i++)
      object + "";

    if (typeof dir == "function")
      dir.call(this, object);
  };
}

exports["dir-string"] = makeInjector(dirString);

/**
 * Generates a random alphanumeric ID consisting of 6 base-36 digits
 * from the range 100000..zzzzzz (both inclusive).
 *
 * @returns {string} The random ID.
 * @private
 */
function randomId()
{
  // 2176782336 is 36^6 which mean 6 chars [a-z0-9]
  // 60466176 is 36^5
  // 2176782336 - 60466176 = 2116316160. This ensure to always have 6
  // chars even if Math.random() returns its minimum value 0.0
  //
  return Math.floor(Math.random() * 2116316160 + 60466176).toString(36);
}

function wrapPropertyAccess(object, property, descriptor)
{
  let dotIndex = property.indexOf(".");
  if (dotIndex == -1)
  {
    // simple property case.
    let currentDescriptor = Object.getOwnPropertyDescriptor(object, property);
    if (currentDescriptor && !currentDescriptor.configurable)
      return;

    // Keep it configurable because the same property can be wrapped via
    // multiple snippet filters (#7373).
    let newDescriptor = Object.assign({}, descriptor, {configurable: true});

    if (!currentDescriptor && !newDescriptor.get && newDescriptor.set)
    {
      let propertyValue = object[property];
      newDescriptor.get = () => propertyValue;
    }

    Object.defineProperty(object, property, newDescriptor);
    return;
  }

  let name = property.slice(0, dotIndex);
  property = property.slice(dotIndex + 1);
  let value = object[name];
  if (value && (typeof value == "object" || typeof value == "function"))
    wrapPropertyAccess(value, property, descriptor);

  let currentDescriptor = Object.getOwnPropertyDescriptor(object, name);
  if (currentDescriptor && !currentDescriptor.configurable)
    return;

  let setter = newValue =>
  {
    value = newValue;
    if (newValue && (typeof newValue == "object" || typeof value == "function"))
      wrapPropertyAccess(newValue, property, descriptor);
  };

  Object.defineProperty(object, name, {
    get: () => value,
    set: setter,
    configurable: true
  });
}

/**
 * Overrides the <code>onerror</code> handler to discard tagged error messages
 * from our property wrapping.
 *
 * @param {string} magic The magic string that tags the error message.
 * @private
 */
function overrideOnError(magic)
{
  let {onerror} = window;
  window.onerror = (message, ...rest) =>
  {
    if (typeof message == "string" && message.includes(magic))
      return true;
    if (typeof onerror == "function")
      return (() => {}).call.call(onerror, this, message, ...rest);
  };
}

/**
 * Patches a property on the window object to abort execution when the
 * property is read.
 *
 * No error is printed to the console.
 *
 * The idea originates from
 * {@link https://github.com/uBlockOrigin/uAssets/blob/80b195436f8f8d78ba713237bfc268ecfc9d9d2b/filters/resources.txt#L1703 uBlock Origin}.
 * @alias module:content/snippets.abort-on-property-read
 *
 * @param {string} property The name of the property.
 *
 * @since Adblock Plus 3.4.1
 */
function abortOnPropertyRead(property)
{
  let debugLog = (debug ? log : () => {})
                  .bind(null, "abort-on-property-read");

  if (!property)
  {
    debugLog("no property to abort on read");
    return;
  }

  let rid = randomId();

  function abort()
  {
    debugLog(`${property} access aborted`);
    throw new ReferenceError(rid);
  }

  debugLog(`aborting on ${property} access`);

  wrapPropertyAccess(window, property, {get: abort, set() {}});
  overrideOnError(rid);
}

exports["abort-on-property-read"] = makeInjector(abortOnPropertyRead,
                                                 wrapPropertyAccess,
                                                 overrideOnError,
                                                 randomId,
                                                 log);

/**
 * Patches a property on the window object to abort execution when the
 * property is written.
 *
 * No error is printed to the console.
 *
 * The idea originates from
 * {@link https://github.com/uBlockOrigin/uAssets/blob/80b195436f8f8d78ba713237bfc268ecfc9d9d2b/filters/resources.txt#L1671 uBlock Origin}.
 * @alias module:content/snippets.abort-on-property-write
 *
 * @param {string} property The name of the property.
 *
 * @since Adblock Plus 3.4.3
 */
function abortOnPropertyWrite(property)
{
  let debugLog = (debug ? log : () => {})
                  .bind(null, "abort-on-property-write");

  if (!property)
  {
    debugLog("no property to abort on write");
    return;
  }

  let rid = randomId();

  function abort()
  {
    debugLog(`setting ${property} aborted`);
    throw new ReferenceError(rid);
  }

  debugLog(`aborting when setting ${property}`);

  wrapPropertyAccess(window, property, {set: abort});
  overrideOnError(rid);
}

exports["abort-on-property-write"] = makeInjector(abortOnPropertyWrite,
                                                  wrapPropertyAccess,
                                                  overrideOnError,
                                                  randomId,
                                                  log);

/**
 * Aborts the execution of an inline script.
 * @alias module:content/snippets.abort-current-inline-script
 *
 * @param {string} api API function or property name to anchor on.
 * @param {?string} [search] If specified, only scripts containing the given
 *   string are prevented from executing. If the string begins and ends with a
 *   slash (<code>/</code>), the text in between is treated as a regular
 *   expression.
 *
 * @since Adblock Plus 3.4.3
 */
function abortCurrentInlineScript(api, search = null)
{
  let re = search ? toRegExp(search) : null;

  let rid = randomId();
  let us = document.currentScript;

  let object = window;
  let path = api.split(".");
  let name = path.pop();

  for (let node of path)
  {
    object = object[node];

    if (!object || !(typeof object == "object" || typeof object == "function"))
      return;
  }

  let {get: prevGetter, set: prevSetter} =
    Object.getOwnPropertyDescriptor(object, name) || {};

  let currentValue = object[name];

  let abort = () =>
  {
    let element = document.currentScript;
    if (element instanceof HTMLScriptElement && element.src == "" &&
        element != us && (!re || re.test(element.textContent)))
    {
      throw new ReferenceError(rid);
    }
  };

  let descriptor = {
    get()
    {
      abort();

      if (prevGetter)
        return prevGetter.call(this);

      return currentValue;
    },
    set(value)
    {
      abort();

      if (prevSetter)
        prevSetter.call(this, value);
      else
        currentValue = value;
    }
  };

  wrapPropertyAccess(object, name, descriptor);

  overrideOnError(rid);
}

exports["abort-current-inline-script"] =
  makeInjector(abortCurrentInlineScript, wrapPropertyAccess, toRegExp,
               overrideOnError, regexEscape, randomId);

/**
 * Strips a query string parameter from <code>fetch()</code> calls.
 * @alias module:content/snippets.strip-fetch-query-parameter
 *
 * @param {string} name The name of the parameter.
 * @param {?string} [urlPattern] An optional pattern that the URL must match.
 *
 * @since Adblock Plus 3.5.1
 */
function stripFetchQueryParameter(name, urlPattern = null)
{
  let fetch_ = window.fetch;
  if (typeof fetch_ != "function")
    return;

  let urlRegExp = urlPattern ? toRegExp(urlPattern) : null;
  window.fetch = function fetch(...args)
  {
    let [source] = args;
    if (typeof source == "string" &&
        (!urlRegExp || urlRegExp.test(source)))
    {
      let url = new URL(source);
      url.searchParams.delete(name);
      args[0] = url.href;
    }

    return fetch_.apply(this, args);
  };
}

exports["strip-fetch-query-parameter"] = makeInjector(stripFetchQueryParameter,
                                                      toRegExp, regexEscape);

/**
 * Represents an undirected graph. Used for producing adjacency and feature
 * matrices.
 */
class UndirectedGraph
{
  /**
   * Initialize an empty graph of a predefined size
   * @param {number} numOfVertices - size of a new graph
   * @private
   */
  constructor(numOfVertices)
  {
    // Create adjacency matrix and initialize it with '0's
    let emptyMatrix = new Array(numOfVertices);
    for (let i = 0; i < numOfVertices; i++)
    {
      emptyMatrix[i] = new Array(numOfVertices).fill(0);
    }
    this.adjacencyMatrix = emptyMatrix;
  }

  /**
   * Add an edge from node A to node B
   * @param {number} posA - number of a node from which to add an edge
   * @param {number} posB - number of a node into which to add an edge
   * @return {bool} whether operation was succesful
   * @private
   */
  addEdge(posA, posB)
  {
    if (posA < 0 || posB < 0)
      throw new Error("Can't add an Edge to vertex at negative position ");

    let numOfVertices = this.adjacencyMatrix.length;
    if (posA >= numOfVertices || posB >= numOfVertices)
      return false;
    this.adjacencyMatrix[posA][posB] = 1;
    // We want to be symmetric, as this is undirected graph
    this.adjacencyMatrix[posB][posA] = 1;
    return true;
  }
}

// Source: https://github.com/sindresorhus/html-tags/blob/master/html-tags.json
const htmlTags = [
  "a", "abbr", "address", "area", "article", "aside", "audio",
  "b", "base", "bdi", "bdo", "blockquote", "body", "br", "button", "canvas",
  "caption", "cite", "code", "col", "colgroup", "data", "datalist", "dd", "del",
  "details", "dfn", "dialog", "div", "dl", "dt", "em", "embed", "fieldset",
  "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6",
  "head", "header", "hgroup", "hr", "html", "i", "iframe", "img", "input",
  "ins", "kbd", "keygen", "label", "legend", "li", "link", "main", "map",
  "mark", "math", "menu", "menuitem", "meta", "meter", "nav", "noscript",
  "object", "ol", "optgroup", "option", "output", "p", "param", "picture",
  "pre", "progress", "q", "rb", "rp", "rt", "rtc", "ruby", "s", "samp",
  "script", "section", "select", "slot", "small", "source", "span", "strong",
  "style", "sub", "summary", "sup", "svg", "table", "tbody", "td", "template",
  "textarea", "tfoot", "th", "thead", "time", "title", "tr", "track", "u",
  "ul", "var", "video", "wbr"
];
const GRAPH_CUT_OFF = 200;
const THRESHOLD = 0.5;

/**
* A (tag, int) Map of all HTML tags with values reflecting the number of a tag
* in alphabetical enumeration.
* @type {Map}
*/
let htmlTagsMap = new Map(
  htmlTags.map((name, index) => [name.toUpperCase(), index + 1])
);


/**
 * Builds an adjecency matrix and a feature matrix based on an input element.
 * @param {Element} target Input element to convert.
 * @param {string} tagName An HTML tag name to filter mutations.
 * @returns {Tuple} (adjMatrix, elementTags) - a 2D array that represent an
 * adjacency matrix of an element. HTML elements are undirected trees, so the
 * adjacency matrix is symmetric.
 * elementTags - a 1D feature matrix, where each element is represents a type
 * of a node.
 * @private
 */
function processElement(target)
{
  let elementGraph = new UndirectedGraph(GRAPH_CUT_OFF);
  let numOfElements = 1;

  let elementTags = new Array(GRAPH_CUT_OFF).fill(0);

  let addEdges = (parentElement, parentPos) =>
  {
    let children = parentElement.children;
    for (let child of children)
    {
      if (numOfElements > GRAPH_CUT_OFF)
      {
        break;
      }

      elementTags[numOfElements] = htmlTagsMap.get(child.tagName) || 0;
      elementGraph.addEdge(parentPos, numOfElements);
      addEdges(child, numOfElements++);
    }
  };

  elementTags[0] = (htmlTagsMap.get(target.tagName) || 0);

  // Kick off recursive graph building
  addEdges(target, 0);
  let adjMatrix = elementGraph.adjacencyMatrix;
  return {adjMatrix, elementTags};
}

/**
* Runs a ML prediction on each element that matches a selector
* @param {String} selector - a selector to use for finding candidates
* @param {WeakSet} seenMlTargets - matched elements to ignore
*/
function predictAds(selector, seenMlTargets)
{
  let debugLog = (debug ? log : () => {})
                  .bind(null, "ml-hide-if-graph-matches");

  let targets = document.querySelectorAll(selector);
  for (let target of targets)
  {
    if (seenMlTargets.has(target))
      continue;

    if (target.innerText == "")
    {
      continue;
    }
    seenMlTargets.add(target);
    let processedElement = processElement(target);

    browser.runtime.sendMessage({
      type: "ml.inference",
      inputs: [
        {
          data: [processedElement.elementTags], preprocess: [
                        {funcName: "cast", args: "int32"},
                        {funcName: "pad", args: GRAPH_CUT_OFF},
                        {funcName: "oneHot", args: htmlTags.length},
                        {funcName: "cast", args: "float32"}
          ]
        },
        {
          data: [processedElement.adjMatrix], preprocess: [
                        {funcName: "pad", args: GRAPH_CUT_OFF},
                        {funcName: "unstack"},
                        {funcName: "localPooling"},
                        {funcName: "stack"}
          ]
        }
      ],
      model: "mlHideIfGraphMatches"
    }).then(rawPrediction =>
    {
      debugLog(rawPrediction);

      let predictionValues = Object.values(rawPrediction);

      if (!predictionValues.some(value => value > 0))
        throw new Error("ML prediction results are corrupted");

      let result = predictionValues.filter((element, index) =>
        index % 2 == 0
      ).map(element => element > THRESHOLD);

      if (!result[0])
      {
        debugLog("Detected ad: " + target.innerText);
        debug ? highlightElement(target) : hideElement(target);
      }
    });
  }
}

/**
 * Hides any HTML element if its structure (graph) is classified as an ad
 * by a built-in machine learning model.
 * @alias ml-hide-if-graph-matches
 *
 * @param {string} selector A selector that produces a list of targets to
 * classify.
 * @param {string} tagName An HTML tag name to filter mutations.
 *
 * @since Adblock Plus 3.8.0
 */
function mlHideIfGraphMatches(selector, tagName)
{
  let scheduled = false;
  let seenMlTargets = new WeakSet();

  if (typeof browser === "undefined")
    self.browser = chrome;

  let relevantTagName = tagName;
  let callback = mutations =>
  {
    for (let mutation of mutations)
    {
      if (mutation.target.tagName == relevantTagName)
      {
        if (!scheduled)
        {
          scheduled = true;
          requestAnimationFrame(() =>
          {
            scheduled = false;
            predictAds(selector, seenMlTargets);
          });
        }
        break;
      }
    }
  };

  new MutationObserver(callback)
    .observe(document, {childList: true, characterData: true, subtree: true});

  predictAds(selector, seenMlTargets);
}

exports["ml-hide-if-graph-matches"] = mlHideIfGraphMatches;
/**
 * Calculates and returns the perceptual hash of the supplied image.
 *
 * The following lines are based off the blockhash-js library which is
 * licensed under the MIT licence
 * {@link https://github.com/commonsmachinery/blockhash-js/tree/2084417e40005e37f4ad957dbd2bca08ddc222bc Blockhash.js}
 *
 * @param {object} imageData ImageData object containing the image data of the
 *  image for which a hash should be calculated
 * @param {?number} [blockBits] The block width used to generate the perceptual
 *   image hash, a number of 4 will split the image into 16 blocks
 *   (width/4 * height/4). Defaults to 8.
 * @returns {string} The resulting hash
 * @private
 */
function hashImage(imageData, blockBits)
{
  function median(mdarr)
  {
    mdarr.sort((a, b) => a - b);
    let {length} = mdarr;
    if (length % 2 === 0)
    {
      return (mdarr[length / 2 - 1] + mdarr[length / 2]) / 2.0;
    }
    return mdarr[(length / 2) | 0];
  }

  function translateBlocksToBits(blocks, pixelsPerBlock)
  {
    let halfBlockValue = pixelsPerBlock * 256 * 3 / 2;
    let bandsize = blocks.length / 4;

    // Compare medians across four horizontal bands
    for (let i = 0; i < 4; i++)
    {
      let index = i * bandsize;
      let length = (i + 1) * bandsize;
      let m = median(blocks.slice(index, length));
      for (let j = index; j < length; j++)
      {
        let v = blocks[j];

        // Output a 1 if the block is brighter than the median.
        // With images dominated by black or white, the median may
        // end up being 0 or the max value, and thus having a lot
        // of blocks of value equal to the median.  To avoid
        // generating hashes of all zeros or ones, in that case output
        // 0 if the median is in the lower value space, 1 otherwise
        blocks[j] = (v > m || (m - v < 1 && m > halfBlockValue)) ? 1 : 0;
      }
    }
  }

  function bitsToHexhash(bitsArray)
  {
    let hex = [];
    let {length} = bitsArray;
    for (let i = 0; i < length; i += 4)
    {
      let nibble = bitsArray.slice(i, i + 4);
      hex.push(parseInt(nibble.join(""), 2).toString(16));
    }

    return hex.join("");
  }

  function bmvbhashEven(data, bits)
  {
    let {width, height, data: imgData} = data;
    let blocksizeX = (width / bits) | 0;
    let blocksizeY = (height / bits) | 0;

    let result = new Array(bits * bits);

    for (let y = 0; y < bits; y++)
    {
      for (let x = 0; x < bits; x++)
      {
        let total = 0;

        for (let iy = 0; iy < blocksizeY; iy++)
        {
          let ii = ((y * blocksizeY + iy) * width + x * blocksizeX) * 4;

          for (let ix = 0; ix < blocksizeX; ix++)
          {
            let alpha = imgData[ii + 3];
            if (alpha === 0)
            {
              total += 765;
            }
            else
            {
              total += imgData[ii] + imgData[ii + 1] + imgData[ii + 2];
            }

            ii += 4;
          }
        }

        result[y * bits + x] = total;
      }
    }

    translateBlocksToBits(result, blocksizeX * blocksizeY);
    return bitsToHexhash(result);
  }

  function bmvbhash(data, bits)
  {
    let x; let y;
    let blockWidth; let blockHeight;
    let weightTop; let weightBottom; let weightLeft; let weightRight;
    let blockTop; let blockBottom; let blockLeft; let blockRight;
    let yMult; let yFrac; let yInt;
    let xMult; let xFrac; let xInt;
    let {width, height, data: imgData} = data;

    let evenX = width % bits === 0;
    let evenY = height % bits === 0;

    if (evenX && evenY)
    {
      return bmvbhashEven(data, bits);
    }

    // initialize blocks array with 0s
    let result = new Array(bits * bits).fill(0);

    blockWidth = width / bits;
    blockHeight = height / bits;

    yInt = 1;
    yFrac = 0;

    yMult = blockHeight;

    weightTop = 1;
    weightBottom = 0;

    let ii = 0;
    for (y = 0; y < height; y++)
    {
      if (evenY)
      {
        blockTop = blockBottom = (y / blockHeight) | 0;
      }
      else
      {
        if (y + 1 >= yMult)
        {
          let mod = (y + 1) % blockHeight;
          yInt = mod | 0;
          yFrac = mod - yInt;

          if (blockHeight > 1)
            yMult = Math.ceil((y + 1) / blockHeight) * blockHeight;

          weightTop = (1 - yFrac);
          weightBottom = (yFrac);
        }

        // yInt will be 0 on bottom/right borders and on block boundaries
        if (yInt > 0 || (y + 1) === height)
        {
          blockTop = blockBottom = (y / blockHeight) | 0;
        }
        else
        {
          let div = y / blockHeight;
          blockTop = div | 0;
          blockBottom = blockTop === div ? blockTop : blockTop + 1;
        }
      }

      xInt = 1;
      xFrac = 0;

      xMult = blockWidth;

      weightLeft = 1;
      weightRight = 0;

      for (x = 0; x < width; x++)
      {
        let avgvalue = 765;
        let alpha = imgData[ii + 3];
        if (alpha !== 0)
        {
          avgvalue = imgData[ii] + imgData[ii + 1] + imgData[ii + 2];
        }

        if (evenX)
        {
          blockLeft = blockRight = (x / blockWidth) | 0;
        }
        else
        {
          if (x + 1 >= xMult)
          {
            let mod = (x + 1) % blockWidth;
            xInt = mod | 0;
            xFrac = mod - xInt;

            if (blockWidth > 1)
              xMult = Math.ceil((x + 1) / blockWidth) * blockWidth;

            weightLeft = 1 - xFrac;
            weightRight = xFrac;
          }

          // xInt will be 0 on bottom/right borders and on block boundaries
          if (xInt > 0 || (x + 1) === width)
          {
            blockLeft = blockRight = (x / blockWidth) | 0;
          }
          else
          {
            let div = x / blockWidth;
            blockLeft = div | 0;
            blockRight = blockLeft === div ? blockLeft : blockLeft + 1;
          }
        }

        // add weighted pixel value to relevant blocks
        result[blockTop * bits + blockLeft] +=
          avgvalue * weightTop * weightLeft;
        result[blockTop * bits + blockRight] +=
          avgvalue * weightTop * weightRight;
        result[blockBottom * bits + blockLeft] +=
          avgvalue * weightBottom * weightLeft;
        result[blockBottom * bits + blockRight] +=
          avgvalue * weightBottom * weightRight;

        ii += 4;

        xInt++;
      }

      yInt++;
    }

    translateBlocksToBits(result, blockWidth * blockHeight);
    return bitsToHexhash(result);
  }

  return bmvbhash(imageData, blockBits);
}

/**
 * Calculate the hamming distance for two hashes in hex format
 *
 * The following lines are based off the blockhash-js library which is
 * licensed under the MIT licence
 * {@link https://github.com/commonsmachinery/blockhash-js/tree/2084417e40005e37f4ad957dbd2bca08ddc222bc Blockhash.js}
 *
 * @param {string} hash1 the first hash of the comparison
 * @param {string} hash2 the second hash of the comparison
 * @returns {number} The resulting hamming distance between hash1 and hash2
 * @private
 */
function hammingDistance(hash1, hash2)
{
  let oneBits = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

  let d = 0;
  let i;

  if (hash1.length !== hash2.length)
  {
    throw new Error("Can't compare hashes with different length");
  }

  for (i = 0; i < hash1.length; i++)
  {
    let n1 = parseInt(hash1[i], 16);
    let n2 = parseInt(hash2[i], 16);
    d += oneBits[n1 ^ n2];
  }
  return d;
}

/**
 * Hides any HTML element or one of its ancestors matching a CSS selector if
 * the perceptual hash of the image src or background image of the element
 * matches the given perceptual hash.
 * @alias module:content/snippets.hide-if-contains-image-hash
 *
 * @param {string} hashes List of comma seperated  perceptual hashes of the
 *  images that should be blocked, see also <code>maxDistance</code>.
 * @param {?string} [selector] The CSS selector that an HTML element
 *   containing the given pattern must match. Defaults to the image element
 *   itself.
 * @param {?string} [maxDistance] The maximum hamming distance between
 *   <code>hash</code> and the perceptual hash of the image to be considered a
 *   match.
 * @param {?number} [blockBits] The block width used to generate the perceptual
 *   image hash, a number of 4 will split the image into 16 blocks
 *   (width/4 * height/4). Defaults to 8. The maximum value allowed is 64.
 * @param {?string} [selection] A string with image coordinates in the format
 *   XxYxWIDTHxHEIGHT for which a perceptual hash should be computated. If
 *   ommitted the entire image will be hashed. The X and Y values can be
 *   negative, in this case they will be relative to the right/bottom corner.
 *
 * @since Adblock Plus 3.6.2
 */
function hideIfContainsImageHash(hashes,
                                 selector,
                                 maxDistance,
                                 blockBits,
                                 selection)
{
  if (selector == null)
    selector = "img";

  if (maxDistance == null)
    maxDistance = 0;

  if (blockBits == null)
    blockBits = 8;

  if (isNaN(maxDistance) || isNaN(blockBits))
    return;

  blockBits |= 0;

  if (blockBits < 1 || blockBits > 64)
    return;

  selection = (selection || "").split("x");

  let seenImages = new Set();

  let callback = images =>
  {
    for (let image of images)
    {
      seenImages.add(image.src);

      let imageElement = new Image();
      imageElement.crossOrigin = "anonymous";
      imageElement.onload = () =>
      {
        let canvas = document.createElement("canvas");
        let context = canvas.getContext("2d");

        let {width, height} = imageElement;

        // If a selection is present we are only going to look at that
        // part of the image
        let sX = parseInt(selection[0], 10) || 0;
        let sY = parseInt(selection[1], 10) || 0;
        let sWidth = parseInt(selection[2], 10) || width;
        let sHeight = parseInt(selection[3], 10) || height;

        if (sWidth == 0 || sHeight == 0)
          return;

        // if sX or sY is negative start from the right/bottom respectively
        if (sX < 0)
          sX = width + sX;
        if (sY < 0)
          sY = height + sY;

        if (sX < 0)
          sX = 0;
        if (sY < 0)
          sY = 0;
        if (sWidth > width)
          sWidth = width;
        if (sHeight > height)
          sHeight = height;

        canvas.width = sWidth;
        canvas.height = sHeight;

        context.drawImage(
          imageElement, sX, sY, sWidth, sHeight, 0, 0, sWidth, sHeight);

        let imageData = context.getImageData(0, 0, sWidth, sHeight);
        let result = hashImage(imageData, blockBits);

        for (let hash of hashes.split(","))
        {
          if (result.length == hash.length)
          {
            if (hammingDistance(result, hash) <= maxDistance)
            {
              let closest = image.closest(selector);
              if (closest)
              {
                hideElement(closest);
                return;
              }
            }
          }
        }
      };
      imageElement.src = image.src;
    }
  };
  callback(document.images);

  new MutationObserver(records =>
  {
    let images = new Set();
    for (let img of document.images)
    {
      if (!seenImages.has(img.src))
      {
        images.add(img);
      }
    }

    if (images.size)
    {
      callback(images);
    }
  }).observe(document, {childList: true, subtree: true, attributes: true});
}

exports["hide-if-contains-image-hash"] = hideIfContainsImageHash;

/**
 * Whether debug mode is enabled.
 * @type {boolean}
 * @private
 */
let debug = false;

/**
 * Enables debug mode.
 * @alias module:content/snippets.debug
 *
 * @example
 * example.com#$#debug; log 'Hello, world!'
 */
function setDebug()
{
  debug = true;
}

exports["debug"] = setDebug;
