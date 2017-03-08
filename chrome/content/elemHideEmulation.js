// We are currently limited to ECMAScript 5 in this file, because it is being
// used in the browser tests. See https://issues.adblockplus.org/ticket/4796

var propertySelectorRegExp = /\[\-abp\-properties=(["'])([^"']+)\1\]/;

function splitSelector(selector)
{
  if (selector.indexOf(",") == -1)
    return [selector];

  var selectors = [];
  var start = 0;
  var level = 0;
  var sep = "";

  for (var i = 0; i < selector.length; i++)
  {
    var chr = selector[i];

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
  stringifyStyle: function(style)
  {
    var styles = [];
    for (var i = 0; i < style.length; i++)
    {
      var property = style.item(i);
      var value    = style.getPropertyValue(property);
      var priority = style.getPropertyPriority(property);
      styles.push(property + ": " + value + (priority ? " !" + priority : "") + ";");
    }
    styles.sort();
    return styles.join(" ");
  },

  isSameOrigin: function(stylesheet)
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

  findSelectors: function(stylesheet, selectors, filters)
  {
    // Explicitly ignore third-party stylesheets to ensure consistent behavior
    // between Firefox and Chrome.
    if (!this.isSameOrigin(stylesheet))
      return;

    var rules = stylesheet.cssRules;
    if (!rules)
      return;

    for (var i = 0; i < rules.length; i++)
    {
      var rule = rules[i];
      if (rule.type != rule.STYLE_RULE)
        continue;

      var style = this.stringifyStyle(rule.style);
      for (var j = 0; j < this.patterns.length; j++)
      {
        var pattern = this.patterns[j];
        if (pattern.regexp.test(style))
        {
          var subSelectors = splitSelector(rule.selectorText);
          for (var k = 0; k < subSelectors.length; k++)
          {
            var subSelector = subSelectors[k];
            selectors.push(pattern.prefix + subSelector + pattern.suffix);
            filters.push(pattern.text);
          }
        }
      }
    }
  },

  addSelectors: function(stylesheets)
  {
    var selectors = [];
    var filters = [];
    for (var i = 0; i < stylesheets.length; i++)
      this.findSelectors(stylesheets[i], selectors, filters);
    this.addSelectorsFunc(selectors, filters);
  },

  onLoad: function(event)
  {
    var stylesheet = event.target.sheet;
    if (stylesheet)
      this.addSelectors([stylesheet]);
  },

  apply: function()
  {
    this.getFiltersFunc(function(patterns)
    {
      this.patterns = [];
      for (var i = 0; i < patterns.length; i++)
      {
        var pattern = patterns[i];
        var match = propertySelectorRegExp.exec(pattern.selector);
        if (!match)
          continue;

        var propertyExpression = match[2];
        var regexpString;
        if (propertyExpression.length >= 2 && propertyExpression[0] == "/" &&
            propertyExpression[propertyExpression.length - 1] == "/")
          regexpString = propertyExpression.slice(1, -1)
              .replace("\\x7B ", "{").replace("\\x7D ", "}");
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
        var document = this.window.document;
        this.addSelectors(document.styleSheets);
        document.addEventListener("load", this.onLoad.bind(this), true);
      }
    }.bind(this));
  }
};
