#!/usr/bin/env bash

if [[ -z ${NVM_DIR} ]]; then
NVM_DIR=${HOME}/.nvm
fi

. ${NVM_DIR}/nvm.sh

nvm install 8.9.4
nvm alias default 8.9.4

set -x
set -e

mkdir -p third_party
pip3 install -q --user meson
pip3 install -q --user virtualenv
python3 -m virtualenv -p python2 third_party/python2
bash .travis/prepare-emscripten.sh
bash .travis/prepare-ninja.sh
