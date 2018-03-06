#!/usr/bin/env bash

set -e

. .travis/activate-nodejs.sh
. third_party/python2/bin/activate

./ensure_dependencies.py

deactivate

npm install
