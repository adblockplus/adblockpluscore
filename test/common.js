/*
 * This file is part of Adblock Plus <http://adblockplus.org/>,
 * Copyright (C) 2006-2014 Eyeo GmbH
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

function addScript(url)
{
  var script = document.createElement("script");
  script.src = url;
  if (js17supported)
    script.type = "text/javascript;version=1.7";
  else
    script.src += "?backcompat";
  script.async = false;
  document.head.appendChild(script);
  return script;
}

function require(module)
{
  return require.scopes[module];
}
require.scopes = {};
