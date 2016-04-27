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

function CSSPropertyFilters(window, getFiltersFunc, addSelectorsFunc)
{
  this.window = window;
  this.getFiltersFunc = getFiltersFunc;
  this.addSelectorsFunc = addSelectorsFunc;
}

CSSPropertyFilters.prototype = {
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
        var regexp = pattern.regexp;

        if (typeof regexp == "string")
          regexp = pattern.regexp = new RegExp(regexp);

        if (regexp.test(style))
        {
          var subSelectors = splitSelector(rule.selectorText);
          for (var k = 0; k < subSelectors.length; k++)
            selectors.push(pattern.prefix + subSelectors[k] + pattern.suffix);
          filters[pattern.text] = true;
        }
      }
    }
  },

  addSelectors: function(stylesheets)
  {
    var selectors = [];
    var filters = {};
    for (var i = 0; i < stylesheets.length; i++)
      this.findSelectors(stylesheets[i], selectors, filters);
    this.addSelectorsFunc(selectors, Object.keys(filters));
  },

  onLoad: function(event)
  {
    var stylesheet = event.target.sheet;
    if (stylesheet)
      this.addSelectors([stylesheet]);
  },

  load: function(callback)
  {
    this.getFiltersFunc(function(patterns)
    {
      this.patterns = patterns;
      callback();
    }.bind(this));
  },

  apply: function()
  {
    if (this.patterns.length > 0)
    {
      var document = this.window.document;
      this.addSelectors(document.styleSheets);
      document.addEventListener("load", this.onLoad.bind(this), true);
    }
  }
};
