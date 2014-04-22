#!/usr/bin/env python
# coding: utf-8

# This file is part of Adblock Plus <http://adblockplus.org/>,
# Copyright (C) 2006-2014 Eyeo GmbH
#
# Adblock Plus is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License version 3 as
# published by the Free Software Foundation.
#
# Adblock Plus is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.

import flask
import os
import re
from urlparse import urlparse

app = flask.Flask(__name__)

def js_encode(str):
  return re.sub(r"(['\\])", r"\\\1", str)

@app.route("/<path:path>", methods = ["GET"])
@app.route("/", methods = ["GET"])
def multiplex(path=""):
  request_url = urlparse(flask.request.url)
  request_path = request_url.path
  if request_path.startswith("/lib/"):
    path = flask.safe_join(os.path.dirname(__file__), request_path.lstrip("/"))
    if not os.path.isfile(path):
      return flask.abort(404)

    with open(path, "rb") as file:
      module = os.path.splitext(request_path[len("/lib/"):])[0]
      data = "require.scopes['%s'] = function(){exports={};%s\nreturn exports;}();" % (module, file.read())
      return (data, 200, {"Content-Type": "application/javascript; charset=utf-8"})
  else:
    if request_path.endswith("/"):
      request_path += "index.html"
    return flask.send_from_directory(os.path.join(os.path.dirname(__file__), "test"), request_path.lstrip("/"))

if __name__ == "__main__":
  app.run(debug=True)
