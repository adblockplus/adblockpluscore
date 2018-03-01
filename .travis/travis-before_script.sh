#!/usr/bin/env bash

. .travis/activate-nodejs.sh

set -x
set -e

./ensure_dependencies.py
npm install
