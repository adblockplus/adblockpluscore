#!/usr/bin/env python
# coding: utf-8

# This file is part of Adblock Plus <https://adblockplus.org/>,
# Copyright (C) 2006-2016 Eyeo GmbH
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

import io
import json
import os
import posixpath
import subprocess
import sys
import urlparse

import flask

app = flask.Flask(__name__)

def get_scripts(dir, reldir=""):
  for filename in os.listdir(dir):
    path = os.path.join(dir, filename)
    # "Relative path" will be the parameter passed in to require(), meaning
    # that it always has to use forward slashes.
    relpath = posixpath.join(reldir, filename)
    if os.path.isdir(path):
      for path, relpath in get_scripts(path, relpath):
        yield path, relpath
    elif os.path.splitext(path)[1] == ".js":
      yield path, relpath

def js_encode(str):
  return json.dumps(str)

def script_as_string(path, sourceURL, backcompat):
  if backcompat:
    from jshydra.abp_rewrite import doRewrite
    data = doRewrite([os.path.abspath(path)], []).decode("utf-8")
  else:
    with io.open(path, "r", encoding="utf-8") as handle:
      data = handle.read()
  data += "\n//# sourceURL=%s" % sourceURL
  return js_encode(data)

@app.route("/<path:path>", methods = ["GET"])
@app.route("/", methods = ["GET"])
def multiplex(path=""):
  base_url = flask.request.url
  request_url = urlparse.urlparse(base_url)
  request_path = request_url.path
  islib = request_path.startswith("/lib/")
  backcompat = request_url.query == "backcompat"

  rootdir = os.path.dirname(__file__)
  if request_path == "/lib.js":
    def generate_libs():
      for path, relpath in get_scripts(os.path.join(rootdir, "lib")):
        url = urlparse.urljoin(base_url, "/lib/" + relpath)
        yield "require.sources[%s] = %s;\n" % (
            js_encode(posixpath.splitext(relpath)[0]),
            script_as_string(path, url, backcompat)
        )
    return flask.Response(generate_libs(), mimetype="application/javascript")
  elif request_path == "/tests.js":
    def generate_tests():
      yield "var tests = ["
      for path, relpath in get_scripts(os.path.join(rootdir, "test", "tests")):
        url = urlparse.urljoin(base_url, "/tests/" + relpath)
        yield "  %s,\n" % script_as_string(path, url, backcompat)
      yield "];"
    return flask.Response(generate_tests(), mimetype="application/javascript")
  else:
    if request_path.startswith("/lib/"):
      rootdir = os.path.join(rootdir, "lib")
    else:
      rootdir = os.path.join(rootdir, "test")
    if request_path.endswith("/"):
      request_path += "index.html"
    return flask.send_from_directory(rootdir, request_path.lstrip("/"))

if __name__ == "__main__":
  DEPENDENCY_SCRIPT = os.path.join(os.path.dirname(__file__), "ensure_dependencies.py")

  try:
    subprocess.check_call([sys.executable, DEPENDENCY_SCRIPT])
  except subprocess.CalledProcessError as e:
    print >>sys.stderr, e
    print >>sys.stderr, "Failed to ensure dependencies being up-to-date!"

  # FIXME - See https://github.com/mitsuhiko/werkzeug/pull/770
  from werkzeug.serving import ThreadedWSGIServer
  ThreadedWSGIServer.daemon_threads = True

  app.run(debug=True, threaded=True)
