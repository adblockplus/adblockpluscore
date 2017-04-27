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

/* globals nodeunit */

(function(nodeunitUrl, ...moduleUrls)
{
  function loadScript(doc, url)
  {
    return new Promise((resolve, reject) =>
    {
      let script = doc.createElement("script");
      script.src = url;
      script.onload = resolve;
      doc.head.appendChild(script);
    });
  }

  function loadModules(urls)
  {
    let modules = {};

    return (function loadNext()
    {
      if (urls.length)
      {
        // Load each module into a new frame so that their scopes don't clash
        let frame = document.createElement("iframe");
        document.body.appendChild(frame);

        let wnd = frame.contentWindow;
        wnd.loadScript = url => loadScript(wnd.document, url);
        wnd.exports = {};
        wnd.module = {exports: wnd.exports};

        let url = urls.shift();
        let name = url.split("/").pop();
        return wnd.loadScript(url).then(() =>
        {
          modules[name] = nodeunit.testCase(wnd.module.exports);
          return loadNext();
        });
      }

      return Promise.resolve(modules);
    })();
  }

  function runTests(modules)
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

    return new Promise((resolve, reject) =>
    {
      nodeunit.runModules(modules, {
        moduleStart(name)
        {
          console.log(bold(name));
        },
        testDone(name, assertions)
        {
          let errors = assertions.filter(assertion => assertion.failed())
                                 .map(assertion => assertion.error);

          if (errors.length == 0)
            console.log("\u2714 " + name);
          else
          {
            console.log(error("\u2716 " + name) + "\n");
            errors.forEach(e =>
            {
              if (e.stack)
                console.log(e.stack);
              else
                console.log(String(e));
              console.log("");
            });
          }
        },
        done(assertions)
        {
          let failures = assertions.filter(assertion => assertion.failed());
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

          resolve();
        }
      });
    });
  }

  return loadScript(document, nodeunitUrl).then(() =>
  {
    return loadModules(moduleUrls);
  }).then(modules =>
  {
    return runTests(modules);
  });
});
