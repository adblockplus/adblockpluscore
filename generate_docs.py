#!/usr/bin/env python
# coding: utf-8

import os
import subprocess
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEPENDENCY_SCRIPT = os.path.join(BASE_DIR, "ensure_dependencies.py")

if __name__ == "__main__":
  try:
    subprocess.check_call([sys.executable, DEPENDENCY_SCRIPT, BASE_DIR])
  except subprocess.CalledProcessError as e:
    print >>sys.stderr, e
    print >>sys.stderr, "Failed to ensure dependencies being up-to-date!"

  # We're faking an invocation of build.py here, because we would have to
  # duplicate command line parsing otherwise. It would be nicer if buildtools
  # would make it possible to invoke the docs command directly.
  args = sys.argv
  args[1:1] = ["-t", "gecko", "docs"]

  import buildtools.build
  buildtools.build.processArgs(BASE_DIR, args)
