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

/* eslint-env webextensions */
/* eslint no-console: "off" */

"use strict";

/**
 * @typedef {object} FetchContentInfo
 * @property {function} remove
 * @property {Promise} result
 * @property {number} timer
 */

/**
 * @type {Map.<string, FetchContentInfo>}
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
 */
function injectCode(code, dependencies = [])
{
  for (let dependency of dependencies)
    code += dependency;

  let script = document.createElement("script");

  script.type = "application/javascript";
  script.async = false;

  // Firefox 58 only bypasses site CSPs when assigning to 'src',
  // while Chrome 67 only bypasses site CSPs when using 'textContent'.
  if (browser.runtime.getURL("").startsWith("chrome-extension://"))
  {
    script.textContent = code;
    document.documentElement.appendChild(script);
  }
  else
  {
    let url = URL.createObjectURL(new Blob([code]));
    script.src = url;
    document.documentElement.appendChild(script);
    URL.revokeObjectURL(url);
  }

  document.documentElement.removeChild(script);
}

/**
 * Converts a function and an optional list of arguments into a string of code
 * containing a function call. The function is converted to its string
 * representation using the <code>Function.prototype.toString</code> method.
 * Each argument is stringified using <code>JSON.stringify</code>. The
 * generated code begins with the <code>"use strict"</code> directive.
 *
 * @param {function} func The function to convert.
 * @param {...*} [params] The arguments to convert.
 *
 * @returns {string} The generated code containing the function call.
 */
function stringifyFunctionCall(func, ...params)
{
  // Call JSON.stringify on the arguments to avoid any arbitrary code
  // execution.
  return `"use strict";(${func})(${params.map(JSON.stringify).join(",")});`;
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
 * Observes changes to a DOM node using a <code>MutationObserver</code>.
 *
 * @param {Node} target The DOM node to observe for changes.
 * @param {MutationObserverInit?} [options] Options that describe what DOM
 *   mutations should be reported to the callback.
 * @param {function} callback A function that will be called on each DOM
 *   mutation, taking a <code>MutationRecord</code> as its parameter.
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
 */
function log(...args)
{
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
 */
function trace(...args)
{
  // We could simply use console.log here, but the goal is to demonstrate the
  // usage of snippet dependencies.
  log(...args);
}

exports.trace = makeInjector(trace, log);

// This is an implementation of the uabinject-defuser technique used by uBlock
// Origin
// https://github.com/uBlockOrigin/uAssets/blob/c091f861b63cd2254b8e9e4628f6bdcd89d43caa/filters/resources.txt#L640
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
 *
 * @param {string} search The string to look for in every HTML element's
 *   shadow. If the string begins and ends with a slash (<code>/</code>), the
 *   text in between is treated as a regular expression.
 * @param {string} selector The CSS selector that an HTML element must match
 *   for it to be hidden.
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
 * the text content of the element contains a given string.
 *
 * @param {string} search The string to look for in HTML elements. If the
 *   string begins and ends with a slash (<code>/</code>), the text in between
 *   is treated as a regular expression.
 * @param {string} selector The CSS selector that an HTML element must match
 *   for it to be hidden.
 * @param {string?} [searchSelector] The CSS selector that an HTML element
 *   containing the given string must match. Defaults to the value of the
 *   <code>selector</code> argument.
 */
function hideIfContains(search, selector = "*", searchSelector = null)
{
  if (searchSelector == null)
    searchSelector = selector;

  let re = toRegExp(search);

  new MutationObserver(() =>
  {
    for (let element of document.querySelectorAll(searchSelector))
    {
      if (re.test(element.textContent))
      {
        let closest = element.closest(selector);
        if (closest)
          hideElement(closest);
      }
    }
  })
  .observe(document, {childList: true, characterData: true, subtree: true});
}

exports["hide-if-contains"] = hideIfContains;

/**
 * Hides any HTML element or one of its ancestors matching a CSS selector if
 * the text content of the element contains a given string and, optionally, if
 * the element's computed style contains a given string.
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
 *
 * @param {string} [times=1] The number of times to call the
 *   <code>toString</code> method of the argument to <code>console.dir</code>.
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
  let currentDescriptor = Object.getOwnPropertyDescriptor(object, property);
  if (currentDescriptor && !currentDescriptor.configurable)
    return false;

  Object.defineProperty(object, property, descriptor);
  return true;
}

/**
 * Overrides the <code>onerror</code> handler to discard tagged error messages
 * from our property wrapping.
 *
 * @param {string} magic The magic string that tags the error message.
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
 *
 * @param {string} property The name of the property.
 */
function abortOnPropertyRead(property)
{
  if (!property)
    return;

  let rid = randomId();

  function abort()
  {
    throw new ReferenceError(rid);
  }

  if (wrapPropertyAccess(window, property, {get: abort, set() {}}))
    overrideOnError(rid);
}

exports["abort-on-property-read"] = makeInjector(abortOnPropertyRead,
                                                 wrapPropertyAccess,
                                                 overrideOnError,
                                                 randomId);

/**
 * Patches a property on the window object to abort execution when the
 * property is written.
 *
 * No error is printed to the console.
 *
 * The idea originates from
 * {@link https://github.com/uBlockOrigin/uAssets/blob/80b195436f8f8d78ba713237bfc268ecfc9d9d2b/filters/resources.txt#L1671 uBlock Origin}.
 *
 * @param {string} property The name of the property.
 */
function abortOnPropertyWrite(property)
{
  if (!property)
    return;

  let rid = randomId();

  function abort()
  {
    throw new ReferenceError(rid);
  }

  if (wrapPropertyAccess(window, property, {set: abort}))
    overrideOnError(rid);
}

exports["abort-on-property-write"] = makeInjector(abortOnPropertyWrite,
                                                  wrapPropertyAccess,
                                                  overrideOnError,
                                                  randomId);

/**
 * Aborts the execution of an inline script.
 *
 * @param {string} api API function or property name to anchor on.
 * @param {?string} [search] If specified, only scripts containing the given
 *   string are prevented from executing. If the string begins and ends with a
 *   slash (<code>/</code>), the text in between is treated as a regular
 *   expression.
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

    if (!object || typeof object != "object")
      return;
  }

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
      return currentValue;
    },
    set(value)
    {
      abort();
      currentValue = value;
    }
  };

  if (wrapPropertyAccess(object, name, descriptor))
    overrideOnError(rid);
}

exports["abort-current-inline-script"] =
  makeInjector(abortCurrentInlineScript, wrapPropertyAccess, toRegExp,
               overrideOnError, regexEscape, randomId);
