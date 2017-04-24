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

"use strict";

(function()
{
  // We are currently limited to ECMAScript 5 in this file, because it is being
  // used in the browser tests. See https://issues.adblockplus.org/ticket/4796
  // Once this is resolved we should use promises here.
  function safeCall(callback)
  {
    return function()
    {
      try
      {
        callback.apply(this, arguments);
      }
      catch (e)
      {
        var message = String(e);
        if (e.stack)
          message += "\n" + e.stack;
        console.log(message);
        phantom.exit(1);
      }
    };
  }

  function loadScript(doc, url, callback)
  {
    var script = doc.createElement("script");
    script.src = url;
    script.async = false;
    doc.head.appendChild(script);
    if (callback)
      window.setTimeout(callback, 0);
  }

  function loadModules(urls, callback)
  {
    var modules = {};

    var loadNext = safeCall(function()
    {
      if (urls.length)
      {
        // Load each module into a new frame so that their scopes don't clash
        var frame = document.createElement("iframe");
        document.body.appendChild(frame);

        var wnd = frame.contentWindow;
        wnd.loadScript = loadScript.bind(null, wnd.document);
        wnd.console = console;
        wnd.require = require;
        wnd.exports = {};
        wnd.module = {exports: wnd.exports};

        var url = urls.shift();
        var name = url.split("/").pop();
        wnd.loadScript(url, safeCall(function()
        {
          modules[name] = nodeunit.testCase(wnd.module.exports);
          loadNext();
        }));
      }
      else
        callback(modules);
    });

    loadNext();
  }

  function runTests(modules, callback)
  {
    function bold(str)
    {
      return "\u001B[1m" + str + "\u001B[22m";
    }

    function ok(str)
    {
      return "\u001B[32m" + str + "\u001B[39m";
    }

    function error(str)
    {
      return "\u001B[31m" + str + "\u001B[39m";
    }

    nodeunit.runModules(modules, {
      moduleStart: function(name)
      {
        console.log(bold(name));
      },
      testDone: function(name, assertions)
      {
        var errors = assertions.filter(function(assertion)
        {
          return assertion.failed();
        }).map(function(assertion)
        {
          return assertion.error;
        });

        if (errors.length == 0)
          console.log("\u2714 " + name);
        else
        {
          console.log(error("\u2716 " + name) + "\n");
          errors.forEach(function(error)
          {
            console.log(String(error));
            if (error.stack)
              console.log(error.stack);
            console.log("");
          });
        }
      },
      done: function(assertions)
      {
        var failures = assertions.filter(function(assertion)
        {
          return assertion.failed();
        });
        if (failures.length)
        {
          console.log(
            "\n" +
            bold(error("FAILURES: ")) +
            failures.length + "/" + assertions.length + " assertions failed"
          );
        }
        else
        {
          console.log(
            "\n" + bold(ok("OK: ")) +
            assertions.length + " assertions"
          );
        }

        callback(!failures.length);
      }
    });
  }

  function run()
  {
    var system = require("system");
    var nodeunitUrl = system.args[1];
    var urls = system.args.slice(2);

    loadScript(document, nodeunitUrl, safeCall(function()
    {
      loadModules(urls, safeCall(function(modules)
      {
        runTests(modules, function(success)
        {
          phantom.exit(success ? 0 : 1);
        });
      }));
    }));
  }

  safeCall(run)();
})();
