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
bash .travis/prepare-emscripten.sh
bash .travis/prepare-ninja.sh
pip3 install -q --user meson
