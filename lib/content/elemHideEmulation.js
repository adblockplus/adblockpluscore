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

const {makeRegExpParameter, splitSelector,
       qualifySelector} = require("../common");
const {filterToRegExp} = require("../patterns");

const DEFAULT_MIN_INVOCATION_INTERVAL = 3000;
let minInvocationInterval = DEFAULT_MIN_INVOCATION_INTERVAL;
const DEFAULT_MAX_SYCHRONOUS_PROCESSING_TIME = 50;
let maxSynchronousProcessingTime = DEFAULT_MAX_SYCHRONOUS_PROCESSING_TIME;

let abpSelectorRegexp = /:(-abp-[\w-]+|has|has-text|xpath|not)\(/;

let testInfo = null;

function toCSSStyleDeclaration(value) {
  return Object.assign(document.createElement("test"), {style: value}).style;
}

/**
 * Enables test mode, which tracks additional metadata about the inner
 * workings for test purposes. This also allows overriding internal
 * configuration.
 *
 * @param {object} options
 * @param {number} options.minInvocationInterval Overrides how long
 *   must be waited between filter processing runs
 * @param {number} options.maxSynchronousProcessingTime Overrides how
 *   long the thread may spend processing filters before it must yield
 *   its thread
 */
exports.setTestMode = function setTestMode(options) {
  if (typeof options.minInvocationInterval !== "undefined")
    minInvocationInterval = options.minInvocationInterval;
  if (typeof options.maxSynchronousProcessingTime !== "undefined")
    maxSynchronousProcessingTime = options.maxSynchronousProcessingTime;

  testInfo = {
    lastProcessedElements: new Set(),
    failedAssertions: []
  };
};

exports.getTestInfo = function getTestInfo() {
  return testInfo;
};

exports.clearTestMode = function() {
  minInvocationInterval = DEFAULT_MIN_INVOCATION_INTERVAL;
  maxSynchronousProcessingTime = DEFAULT_MAX_SYCHRONOUS_PROCESSING_TIME;
  testInfo = null;
};

/**
 * Creates a new IdleDeadline.
 *
 * Note: This function is synchronous and does NOT request an idle
 * callback.
 *
 * See {@link https://developer.mozilla.org/en-US/docs/Web/API/IdleDeadline}.
 * @return {IdleDeadline}
 */
function newIdleDeadline() {
  let startTime = performance.now();
  return {
    didTimeout: false,
    timeRemaining() {
      let elapsed = performance.now() - startTime;
      let remaining = maxSynchronousProcessingTime - elapsed;
      return Math.max(0, remaining);
    }
  };
}

/**
 * Returns a promise that is resolved when the browser is next idle.
 *
 * This is intended to be used for long running tasks on the UI thread
 * to allow other UI events to process.
 *
 * @return {Promise.<IdleDeadline>}
 *    A promise that is fulfilled when you can continue processing
 */
function yieldThread() {
  return new Promise(resolve => {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(resolve);
    }
    else {
      setTimeout(() => {
        resolve(newIdleDeadline());
      }, 0);
    }
  });
}


function getCachedPropertyValue(object, name, defaultValueFunc = () => {}) {
  let value = object[name];
  if (typeof value == "undefined")
    Object.defineProperty(object, name, {value: value = defaultValueFunc()});
  return value;
}

/**
 * Return position of node from parent.
 * @param {Node} node the node to find the position of.
 * @return {number} One-based index like for :nth-child(), or 0 on error.
 */
function positionInParent(node) {
  let index = 0;
  for (let child of node.parentNode.children) {
    if (child == node)
      return index + 1;

    index++;
  }

  return 0;
}

function makeSelector(node, selector = "") {
  if (node == null)
    return null;
  if (!node.parentElement) {
    let newSelector = ":root";
    if (selector)
      newSelector += " > " + selector;
    return newSelector;
  }
  let idx = positionInParent(node);
  if (idx > 0) {
    let newSelector = `${node.tagName}:nth-child(${idx})`;
    if (selector)
      newSelector += " > " + selector;
    return makeSelector(node.parentElement, newSelector);
  }

  return selector;
}

function parseSelectorContent(content, startIndex) {
  let parens = 1;
  let quote = null;
  let i = startIndex;
  for (; i < content.length; i++) {
    let c = content[i];
    if (c == "\\") {
      // Ignore escaped characters
      i++;
    }
    else if (quote) {
      if (c == quote)
        quote = null;
    }
    else if (c == "'" || c == '"') {
      quote = c;
    }
    else if (c == "(") {
      parens++;
    }
    else if (c == ")") {
      parens--;
      if (parens == 0)
        break;
    }
  }

  if (parens > 0)
    return null;
  return {text: content.substring(startIndex, i), end: i};
}

/**
 * Stringified style objects
 * @typedef {Object} StringifiedStyle
 * @property {string} style CSS style represented by a string.
 * @property {string[]} subSelectors selectors the CSS properties apply to.
 */

/**
 * Produce a string representation of the stylesheet entry.
 * @param {CSSStyleRule} rule the CSS style rule.
 * @return {StringifiedStyle} the stringified style.
 */
function stringifyStyle(rule) {
  let styles = [];
  for (let i = 0; i < rule.style.length; i++) {
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

let scopeSupported = null;

function tryQuerySelector(subtree, selector, all) {
  let elements = null;
  try {
    elements = all ? subtree.querySelectorAll(selector) :
      subtree.querySelector(selector);
    scopeSupported = true;
  }
  catch (e) {
    // Edge doesn't support ":scope"
    scopeSupported = false;
  }
  return elements;
}

/**
 * Query selector.
 *
 * If it is relative, will try :scope.
 *
 * @param {Node} subtree the element to query selector
 * @param {string} selector the selector to query
 * @param {bool} [all=false] true to perform querySelectorAll()
 *
 * @returns {?(Node|NodeList)} result of the query. null in case of error.
 */
function scopedQuerySelector(subtree, selector, all) {
  if (selector[0] == ">") {
    selector = ":scope" + selector;
    if (scopeSupported) {
      return all ? subtree.querySelectorAll(selector) :
        subtree.querySelector(selector);
    }
    if (scopeSupported == null)
      return tryQuerySelector(subtree, selector, all);
    return null;
  }
  return all ? subtree.querySelectorAll(selector) :
    subtree.querySelector(selector);
}

function scopedQuerySelectorAll(subtree, selector) {
  return scopedQuerySelector(subtree, selector, true);
}

class PlainSelector {
  constructor(selector) {
    this._selector = selector;
    this.maybeDependsOnAttributes = /[#.:]|\[.+\]/.test(selector);
    this.maybeContainsSiblingCombinators = /[~+]/.test(selector);
  }

  /**
   * Generator function returning a pair of selector string and subtree.
   * @param {string} prefix the prefix for the selector.
   * @param {Node} subtree the subtree we work on.
   * @param {Node[]} [targets] the nodes we are interested in.
   */
  *getSelectors(prefix, subtree, targets) {
    yield [prefix + this._selector, subtree];
  }
}

const incompletePrefixRegexp = /[\s>+~]$/;

class NotSelector {
  constructor(selectors) {
    this._innerPattern = new Pattern(selectors);
  }

  get dependsOnStyles() {
    return this._innerPattern.dependsOnStyles;
  }

  get dependsOnCharacterData() {
    return this._innerPattern.dependsOnCharacterData;
  }

  get maybeDependsOnAttributes() {
    return this._innerPattern.maybeDependsOnAttributes;
  }

  *getSelectors(prefix, subtree, targets) {
    for (let element of this.getElements(prefix, subtree, targets))
      yield [makeSelector(element), element];
  }

  /**
   * Generator function returning selected elements.
   * @param {string} prefix the prefix for the selector.
   * @param {Node} subtree the subtree we work on.
   * @param {Node[]} [targets] the nodes we are interested in.
   */
  *getElements(prefix, subtree, targets) {
    let actualPrefix = (!prefix || incompletePrefixRegexp.test(prefix)) ?
      prefix + "*" : prefix;
    let elements = scopedQuerySelectorAll(subtree, actualPrefix);
    if (elements) {
      for (let element of elements) {
        // If the element is neither an ancestor nor a descendant of one of the
        // targets, we can skip it.
        if (targets && !targets.some(target => element.contains(target) ||
                                               target.contains(element))) {
          yield null;
          continue;
        }

        if (testInfo)
          testInfo.lastProcessedElements.add(element);

        if (!this._innerPattern.matches(element, subtree))
          yield element;

        yield null;
      }
    }
  }

  setStyles(styles) {
    this._innerPattern.setStyles(styles);
  }
}

class HasSelector {
  constructor(selectors) {
    this._innerPattern = new Pattern(selectors);
  }

  get dependsOnStyles() {
    return this._innerPattern.dependsOnStyles;
  }

  get dependsOnCharacterData() {
    return this._innerPattern.dependsOnCharacterData;
  }

  get maybeDependsOnAttributes() {
    return this._innerPattern.maybeDependsOnAttributes;
  }

  *getSelectors(prefix, subtree, targets) {
    for (let element of this.getElements(prefix, subtree, targets))
      yield [makeSelector(element), element];
  }

  /**
   * Generator function returning selected elements.
   * @param {string} prefix the prefix for the selector.
   * @param {Node} subtree the subtree we work on.
   * @param {Node[]} [targets] the nodes we are interested in.
   */
  *getElements(prefix, subtree, targets) {
    let actualPrefix = (!prefix || incompletePrefixRegexp.test(prefix)) ?
      prefix + "*" : prefix;
    let elements = scopedQuerySelectorAll(subtree, actualPrefix);
    if (elements) {
      for (let element of elements) {
        // If the element is neither an ancestor nor a descendant of one of the
        // targets, we can skip it.
        if (targets && !targets.some(target => element.contains(target) ||
                                               target.contains(element))) {
          yield null;
          continue;
        }

        if (testInfo)
          testInfo.lastProcessedElements.add(element);

        for (let selector of this._innerPattern.evaluate(element, targets)) {
          if (selector == null)
            yield null;
          else if (scopedQuerySelector(element, selector))
            yield element;
        }

        yield null;
      }
    }
  }

  setStyles(styles) {
    this._innerPattern.setStyles(styles);
  }
}

class XPathSelector {
  constructor(textContent) {
    this.dependsOnCharacterData = true;
    this.maybeDependsOnAttributes = true;

    let evaluator = new XPathEvaluator();
    this._expression = evaluator.createExpression(textContent, null);
  }

  *getSelectors(prefix, subtree, targets) {
    for (let element of this.getElements(prefix, subtree, targets))
      yield [makeSelector(element), element];
  }

  *getElements(prefix, subtree, targets) {
    let {ORDERED_NODE_SNAPSHOT_TYPE: flag} = XPathResult;
    let elements = prefix ? scopedQuerySelectorAll(subtree, prefix) : [subtree];
    for (let parent of elements) {
      let result = this._expression.evaluate(parent, flag, null);
      for (let i = 0, {snapshotLength} = result; i < snapshotLength; i++)
        yield result.snapshotItem(i);
    }
  }
}

class ContainsSelector {
  constructor(textContent) {
    this.dependsOnCharacterData = true;

    this._regexp = makeRegExpParameter(textContent);
  }

  *getSelectors(prefix, subtree, targets) {
    for (let element of this.getElements(prefix, subtree, targets))
      yield [makeSelector(element), subtree];
  }

  *getElements(prefix, subtree, targets) {
    let actualPrefix = (!prefix || incompletePrefixRegexp.test(prefix)) ?
      prefix + "*" : prefix;

    let elements = scopedQuerySelectorAll(subtree, actualPrefix);

    if (elements) {
      let lastRoot = null;
      for (let element of elements) {
        // For a filter like div:-abp-contains(Hello) and a subtree like
        // <div id="a"><div id="b"><div id="c">Hello</div></div></div>
        // we're only interested in div#a
        if (lastRoot && lastRoot.contains(element)) {
          yield null;
          continue;
        }

        lastRoot = element;

        if (targets && !targets.some(target => element.contains(target) ||
                                               target.contains(element))) {
          yield null;
          continue;
        }

        if (testInfo)
          testInfo.lastProcessedElements.add(element);

        if (this._regexp && this._regexp.test(element.textContent))
          yield element;
        else
          yield null;
      }
    }
  }
}

class PropsSelector {
  constructor(propertyExpression) {
    this.dependsOnStyles = true;
    this.maybeDependsOnAttributes = true;

    let regexpString;
    if (propertyExpression.length >= 2 && propertyExpression[0] == "/" &&
        propertyExpression[propertyExpression.length - 1] == "/")
      regexpString = propertyExpression.slice(1, -1);
    else
      regexpString = filterToRegExp(propertyExpression);

    this._regexp = new RegExp(regexpString, "i");

    this._subSelectors = [];
  }

  *getSelectors(prefix, subtree, targets) {
    for (let subSelector of this._subSelectors) {
      if (subSelector.startsWith("*") &&
          !incompletePrefixRegexp.test(prefix))
        subSelector = subSelector.substring(1);

      yield [qualifySelector(subSelector, prefix), subtree];
    }
  }

  setStyles(styles) {
    this._subSelectors = [];
    for (let style of styles) {
      if (this._regexp.test(style.style)) {
        for (let subSelector of style.subSelectors) {
          let idx = subSelector.lastIndexOf("::");
          if (idx != -1)
            subSelector = subSelector.substring(0, idx);

          this._subSelectors.push(subSelector);
        }
      }
    }
  }
}

class Pattern {
  constructor(selectors, text) {
    this.selectors = selectors;
    this.text = text;
  }

  get dependsOnStyles() {
    return getCachedPropertyValue(
      this, "_dependsOnStyles", () => this.selectors.some(
        selector => selector.dependsOnStyles
      )
    );
  }

  get maybeDependsOnAttributes() {
    // Observe changes to attributes if either there's a plain selector that
    // looks like an ID selector, class selector, or attribute selector in one
    // of the patterns (e.g. "a[href='https://example.com/']")
    // or there's a properties selector nested inside a has selector
    // (e.g. "div:-abp-has(:-abp-properties(color: blue))")
    return getCachedPropertyValue(
      this, "_maybeDependsOnAttributes", () => this.selectors.some(
        selector => selector.maybeDependsOnAttributes ||
                    (selector instanceof HasSelector &&
                     selector.dependsOnStyles)
      )
    );
  }

  get dependsOnCharacterData() {
    // Observe changes to character data only if there's a contains selector in
    // one of the patterns.
    return getCachedPropertyValue(
      this, "_dependsOnCharacterData", () => this.selectors.some(
        selector => selector.dependsOnCharacterData
      )
    );
  }

  get maybeContainsSiblingCombinators() {
    return getCachedPropertyValue(
      this, "_maybeContainsSiblingCombinators", () => this.selectors.some(
        selector => selector.maybeContainsSiblingCombinators
      )
    );
  }

  matchesMutationTypes(mutationTypes) {
    let mutationTypeMatchMap = getCachedPropertyValue(
      this, "_mutationTypeMatchMap", () => new Map([
        // All types of DOM-dependent patterns are affected by mutations of
        // type "childList".
        ["childList", true],
        ["attributes", this.maybeDependsOnAttributes],
        ["characterData", this.dependsOnCharacterData]
      ])
    );

    for (let mutationType of mutationTypes) {
      if (mutationTypeMatchMap.get(mutationType))
        return true;
    }

    return false;
  }

  /**
   * Generator function returning CSS selectors for all elements that
   * match the pattern.
   *
   * This allows transforming from selectors that may contain custom
   * :-abp- selectors to pure CSS selectors that can be used to select
   * elements.
   *
   * The selectors returned from this function may be invalidated by DOM
   * mutations.
   *
   * @param {Node} subtree the subtree we work on
   * @param {Node[]} [targets] the nodes we are interested in. May be
   * used to optimize search.
   */
  *evaluate(subtree, targets) {
    let selectors = this.selectors;
    function* evaluateInner(index, prefix, currentSubtree) {
      if (index >= selectors.length) {
        yield prefix;
        return;
      }
      for (let [selector, element] of selectors[index].getSelectors(
        prefix, currentSubtree, targets
      )) {
        if (selector == null)
          yield null;
        else
          yield* evaluateInner(index + 1, selector, element);
      }
      // Just in case the getSelectors() generator above had to run some heavy
      // document.querySelectorAll() call which didn't produce any results, make
      // sure there is at least one point where execution can pause.
      yield null;
    }
    yield* evaluateInner(0, "", subtree);
  }

  /**
   * Checks if a pattern matches a specific element
   * @param {Node} [target] the element we're interested in checking for
   * matches on.
   * @param {Node} subtree the subtree we work on
   * @return {bool}
   */
  matches(target, subtree) {
    let targetFilter = [target];
    if (this.maybeContainsSiblingCombinators)
      targetFilter = null;

    let selectorGenerator = this.evaluate(subtree, targetFilter);
    for (let selector of selectorGenerator) {
      if (selector && target.matches(selector))
        return true;
    }
    return false;
  }

  setStyles(styles) {
    for (let selector of this.selectors) {
      if (selector.dependsOnStyles)
        selector.setStyles(styles);
    }
  }
}

function extractMutationTypes(mutations) {
  let types = new Set();

  for (let mutation of mutations) {
    types.add(mutation.type);

    // There are only 3 types of mutations: "attributes", "characterData", and
    // "childList".
    if (types.size == 3)
      break;
  }

  return types;
}

function extractMutationTargets(mutations) {
  if (!mutations)
    return null;

  let targets = new Set();

  for (let mutation of mutations) {
    if (mutation.type == "childList") {
      // When new nodes are added, we're interested in the added nodes rather
      // than the parent.
      for (let node of mutation.addedNodes)
        targets.add(node);
      if (mutation.removedNodes.length > 0)
        targets.add(mutation.target);
    }
    else {
      targets.add(mutation.target);
    }
  }

  return [...targets];
}

function filterPatterns(patterns, {stylesheets, mutations}) {
  if (!stylesheets && !mutations)
    return patterns.slice();

  let mutationTypes = mutations ? extractMutationTypes(mutations) : null;

  return patterns.filter(
    pattern => (stylesheets && pattern.dependsOnStyles) ||
               (mutations && pattern.matchesMutationTypes(mutationTypes))
  );
}

function shouldObserveAttributes(patterns) {
  return patterns.some(pattern => pattern.maybeDependsOnAttributes);
}

function shouldObserveCharacterData(patterns) {
  return patterns.some(pattern => pattern.dependsOnCharacterData);
}

function shouldObserveStyles(patterns) {
  return patterns.some(pattern => pattern.dependsOnStyles);
}

/**
 * @callback hideElemsFunc
 * @param {Node[]} elements Elements on the page that should be hidden
 * @param {string[]} elementFilters
 *   The filter text that caused the elements to be hidden
 */

/**
 * @callback unhideElemsFunc
 * @param {Node[]} elements Elements on the page that should be hidden
 */


/**
 * Manages the front-end processing of element hiding emulation filters.
 */
exports.ElemHideEmulation = class ElemHideEmulation {
  /**
   * @param {module:content/elemHideEmulation~hideElemsFunc} hideElemsFunc
   *   A callback that should be provided to do the actual element hiding.
   * @param {module:content/elemHideEmulation~unhideElemsFunc} unhideElemsFunc
   *   A callback that should be provided to unhide previously hidden elements.
   */
  constructor(hideElemsFunc = () => {}, unhideElemsFunc = () => {}) {
    this._filteringInProgress = false;
    this._nextFilteringScheduled = false;
    this._lastInvocation = -minInvocationInterval;
    this._scheduledProcessing = null;

    this.document = document;
    this.hideElemsFunc = hideElemsFunc;
    this.unhideElemsFunc = unhideElemsFunc;
    this.observer = new MutationObserver(this.observe.bind(this));
    this.hiddenElements = new Set();
  }

  isSameOrigin(stylesheet) {
    try {
      return new URL(stylesheet.href).origin == this.document.location.origin;
    }
    catch (e) {
      // Invalid URL, assume that it is first-party.
      return true;
    }
  }

  /**
   * Parse the selector
   * @param {string} selector the selector to parse
   * @return {Array} selectors is an array of objects,
   * or null in case of errors.
   */
  parseSelector(selector) {
    if (selector.length == 0)
      return [];

    let match = abpSelectorRegexp.exec(selector);
    if (!match)
      return [new PlainSelector(selector)];

    let selectors = [];
    if (match.index > 0)
      selectors.push(new PlainSelector(selector.substring(0, match.index)));

    let startIndex = match.index + match[0].length;
    let content = parseSelectorContent(selector, startIndex);
    if (!content) {
      console.warn(new SyntaxError("Failed to parse Adblock Plus " +
                                   `selector ${selector} ` +
                                   "due to unmatched parentheses."));
      return null;
    }
    if (match[1] == "-abp-properties") {
      selectors.push(new PropsSelector(content.text));
    }
    else if (match[1] == "-abp-has" || match[1] == "has") {
      let hasSelectors = this.parseSelector(content.text);
      if (hasSelectors == null)
        return null;
      selectors.push(new HasSelector(hasSelectors));
    }
    else if (match[1] == "-abp-contains" || match[1] == "has-text") {
      selectors.push(new ContainsSelector(content.text));
    }
    else if (match[1] === "xpath") {
      try {
        selectors.push(new XPathSelector(content.text));
      }
      catch ({message}) {
        console.warn(
          new SyntaxError(
            "Failed to parse Adblock Plus " +
            `selector ${selector}, invalid ` +
            `xpath: ${content.text} ` +
            `error: ${message}.`
          )
        );

        return null;
      }
    }
    else if (match[1] == "not") {
      let notSelectors = this.parseSelector(content.text);
      if (notSelectors == null)
        return null;

      // if all of the inner selectors are PlainSelectors, then we
      // don't actually need to use our selector at all. We're better
      // off delegating to the browser :not implementation.
      if (notSelectors.every(s => s instanceof PlainSelector))
        selectors.push(new PlainSelector(`:not(${content.text})`));
      else
        selectors.push(new NotSelector(notSelectors));
    }
    else {
      // this is an error, can't parse selector.
      console.warn(new SyntaxError("Failed to parse Adblock Plus " +
                                   `selector ${selector}, invalid ` +
                                   `pseudo-class :${match[1]}().`));
      return null;
    }

    let suffix = this.parseSelector(selector.substring(content.end + 1));
    if (suffix == null)
      return null;

    selectors.push(...suffix);

    if (selectors.length == 1 && selectors[0] instanceof ContainsSelector) {
      console.warn(new SyntaxError("Failed to parse Adblock Plus " +
                                   `selector ${selector}, can't ` +
                                   "have a lonely :-abp-contains()."));
      return null;
    }
    return selectors;
  }

  /**
   * Reads the rules out of CSS stylesheets
   * @param {CSSStyleSheet[]} [stylesheets] The list of stylesheets to
   * read.
   * @return {CSSStyleRule[]}
   */
  _readCssRules(stylesheets) {
    let cssStyles = [];

    for (let stylesheet of stylesheets || []) {
      // Explicitly ignore third-party stylesheets to ensure consistent behavior
      // between Firefox and Chrome.
      if (!this.isSameOrigin(stylesheet))
        continue;

      let rules;
      try {
        rules = stylesheet.cssRules;
      }
      catch (e) {
        // On Firefox, there is a chance that an InvalidAccessError
        // get thrown when accessing cssRules. Just skip the stylesheet
        // in that case.
        // See https://searchfox.org/mozilla-central/rev/f65d7528e34ef1a7665b4a1a7b7cdb1388fcd3aa/layout/style/StyleSheet.cpp#699
        continue;
      }

      if (!rules)
        continue;

      for (let rule of rules) {
        if (rule.type != rule.STYLE_RULE)
          continue;

        cssStyles.push(stringifyStyle(rule));
      }
    }
    return cssStyles;
  }

  /**
   * Processes the current document and applies all rules to it.
   * @param {CSSStyleSheet[]} [stylesheets]
   *    The list of new stylesheets that have been added to the document and
   *    made reprocessing necessary. This parameter shouldn't be passed in for
   *    the initial processing, all of document's stylesheets will be considered
   *    then and all rules, including the ones not dependent on styles.
   * @param {MutationRecord[]} [mutations]
   *    The list of DOM mutations that have been applied to the document and
   *    made reprocessing necessary. This parameter shouldn't be passed in for
   *    the initial processing, the entire document will be considered
   *    then and all rules, including the ones not dependent on the DOM.
   * @return {Promise}
   *    A promise that is fulfilled once all filtering is completed
   */
  async _addSelectors(stylesheets, mutations) {
    if (testInfo)
      testInfo.lastProcessedElements.clear();

    let deadline = newIdleDeadline();

    if (shouldObserveStyles(this.patterns))
      this._refreshPatternStyles();

    let patternsToCheck = filterPatterns(
      this.patterns, {stylesheets, mutations}
    );

    let targets = extractMutationTargets(mutations);

    let elementsToHide = [];
    let elementFilters = [];
    let elementsToUnhide = new Set(this.hiddenElements);

    for (let pattern of patternsToCheck) {
      let evaluationTargets = targets;

      // If the pattern appears to contain any sibling combinators, we can't
      // easily optimize based on the mutation targets. Since this is a
      // special case, skip the optimization. By setting it to null here we
      // make sure we process the entire DOM.
      if (pattern.maybeContainsSiblingCombinators)
        evaluationTargets = null;

      let generator = pattern.evaluate(this.document, evaluationTargets);
      for (let selector of generator) {
        if (selector != null) {
          for (let element of this.document.querySelectorAll(selector)) {
            if (!this.hiddenElements.has(element)) {
              elementsToHide.push(element);
              elementFilters.push(pattern.text);
            }
            else {
              elementsToUnhide.delete(element);
            }
          }
        }

        if (deadline.timeRemaining() <= 0)
          deadline = await yieldThread();
      }
    }
    this._hideElems(elementsToHide, elementFilters);

    // The search for elements to hide it optimized to find new things
    // to hide quickly, by not checking all patterns and not checking
    // the full DOM. That's why we need to do a more thorough check
    // for each remaining element that might need to be unhidden,
    // checking all patterns.
    for (let elem of elementsToUnhide) {
      if (!elem.isConnected) {
        // elements that are no longer in the DOM should be unhidden
        // in case they're ever readded, and then forgotten about so
        // we don't cause a memory leak.
        continue;
      }
      let matchesAny = this.patterns.some(pattern => pattern.matches(
        elem, this.document
      ));
      if (matchesAny)
        elementsToUnhide.delete(elem);

      if (deadline.timeRemaining() <= 0)
        deadline = await yieldThread();
    }
    this._unhideElems(Array.from(elementsToUnhide));
  }

  _hideElems(elementsToHide, elementFilters) {
    if (elementsToHide.length > 0) {
      this.hideElemsFunc(elementsToHide, elementFilters);
      for (let elem of elementsToHide)
        this.hiddenElements.add(elem);
    }
  }

  _unhideElems(elementsToUnhide) {
    if (elementsToUnhide.length > 0) {
      this.unhideElemsFunc(elementsToUnhide);
      for (let elem of elementsToUnhide)
        this.hiddenElements.delete(elem);
    }
  }

  /**
   * Performed any scheduled processing.
   *
   * This function is asyncronous, and should not be run multiple
   * times in parallel. The flag `_filteringInProgress` is set and
   * unset so you can check if it's already running.
   * @return {Promise}
   *  A promise that is fulfilled once all filtering is completed
   */
  async _processFiltering() {
    if (this._filteringInProgress) {
      console.warn("ElemHideEmulation scheduling error: " +
                   "Tried to process filtering in parallel.");
      if (testInfo) {
        testInfo.failedAssertions.push(
          "Tried to process filtering in parallel"
        );
      }
      return;
    }
    let params = this._scheduledProcessing || {};
    this._scheduledProcessing = null;
    this._filteringInProgress = true;
    this._nextFilteringScheduled = false;
    await this._addSelectors(
      params.stylesheets,
      params.mutations
    );
    this._lastInvocation = performance.now();
    this._filteringInProgress = false;
    if (this._scheduledProcessing)
      this._scheduleNextFiltering();
  }

  /**
   * Appends new changes to the list of filters for the next time
   * filtering is run.
   * @param {CSSStyleSheet[]} [stylesheets]
   *    new stylesheets to be processed. This parameter should be omitted
   *    for full reprocessing.
   * @param {MutationRecord[]} [mutations]
   *    new DOM mutations to be processed. This parameter should be omitted
   *    for full reprocessing.
   */
  _appendScheduledProcessing(stylesheets, mutations) {
    if (!this._scheduledProcessing) {
      // There isn't anything scheduled yet. Make the schedule.
      this._scheduledProcessing = {stylesheets, mutations};
    }
    else if (!stylesheets && !mutations) {
      // The new request was to reprocess everything, and so any
      // previous filters are irrelevant.
      this._scheduledProcessing = {};
    }
    else if (this._scheduledProcessing.stylesheets ||
             this._scheduledProcessing.mutations) {
      // The previous filters are not to filter everything, so the new
      // parameters matter. Push them onto the appropriate lists.
      if (stylesheets) {
        if (!this._scheduledProcessing.stylesheets)
          this._scheduledProcessing.stylesheets = [];
        this._scheduledProcessing.stylesheets.push(...stylesheets);
      }
      if (mutations) {
        if (!this._scheduledProcessing.mutations)
          this._scheduledProcessing.mutations = [];
        this._scheduledProcessing.mutations.push(...mutations);
      }
    }
    else {
      // this._scheduledProcessing is already going to recheck
      // everything, so no need to do anything here.
    }
  }

  /**
   * Schedule filtering to be processed in the future, or start
   * processing immediately.
   *
   * If processing is already scheduled, this does nothing.
   */
  _scheduleNextFiltering() {
    if (this._nextFilteringScheduled || this._filteringInProgress) {
      // The next one has already been scheduled. Our new events are
      // on the queue, so nothing more to do.
      return;
    }

    if (this.document.readyState === "loading") {
      // Document isn't fully loaded yet, so schedule our first
      // filtering as soon as that's done.
      this.document.addEventListener(
        "DOMContentLoaded",
        () => this._processFiltering(),
        {once: true}
      );
      this._nextFilteringScheduled = true;
    }
    else if (performance.now() - this._lastInvocation <
             minInvocationInterval) {
      // It hasn't been long enough since our last filter. Set the
      // timeout for when it's time for that.
      setTimeout(
        () => this._processFiltering(),
        minInvocationInterval - (performance.now() - this._lastInvocation)
      );
      this._nextFilteringScheduled = true;
    }
    else {
      // We can actually just start filtering immediately!
      this._processFiltering();
    }
  }

  /**
   * Re-run filtering either immediately or queued.
   * @param {CSSStyleSheet[]} [stylesheets]
   *    new stylesheets to be processed. This parameter should be omitted
   *    for full reprocessing.
   * @param {MutationRecord[]} [mutations]
   *    new DOM mutations to be processed. This parameter should be omitted
   *    for full reprocessing.
   */
  queueFiltering(stylesheets, mutations) {
    this._appendScheduledProcessing(stylesheets, mutations);
    this._scheduleNextFiltering();
  }

  _refreshPatternStyles(stylesheet) {
    let allCssRules = this._readCssRules(this.document.styleSheets);
    for (let pattern of this.patterns)
      pattern.setStyles(allCssRules);
  }

  onLoad(event) {
    let stylesheet = event.target.sheet;
    if (stylesheet)
      this.queueFiltering([stylesheet]);
  }

  observe(mutations) {
    if (testInfo) {
      // In test mode, filter out any mutations likely done by us
      // (i.e. style="display: none !important"). This makes it easier to
      // observe how the code responds to DOM mutations.
      mutations = mutations.filter(
        ({type, attributeName, target: {style: newValue}, oldValue}) =>
          !(type == "attributes" && attributeName == "style" &&
            newValue.display == "none" &&
            toCSSStyleDeclaration(oldValue).display != "none")
      );

      if (mutations.length == 0)
        return;
    }

    this.queueFiltering(null, mutations);
  }

  apply(patterns) {
    this.patterns = [];
    for (let pattern of patterns) {
      let selectors = this.parseSelector(pattern.selector);
      if (selectors != null && selectors.length > 0)
        this.patterns.push(new Pattern(selectors, pattern.text));
    }

    if (this.patterns.length > 0) {
      this.queueFiltering();

      let attributes = shouldObserveAttributes(this.patterns);
      this.observer.observe(
        this.document,
        {
          childList: true,
          attributes,
          attributeOldValue: attributes && !!testInfo,
          characterData: shouldObserveCharacterData(this.patterns),
          subtree: true
        }
      );
      if (shouldObserveStyles(this.patterns)) {
        let onLoad = this.onLoad.bind(this);
        if (this.document.readyState === "loading")
          this.document.addEventListener("DOMContentLoaded", onLoad, true);
        this.document.addEventListener("load", onLoad, true);
      }
    }
  }
};
