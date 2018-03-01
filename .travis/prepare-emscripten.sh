#!/usr/bin/env bash

set -x
set -e

wget -qO- https://s3.amazonaws.com/mozilla-games/emscripten/releases/emsdk-portable.tar.gz | tar xz -C third_party/
pushd third_party/emsdk-portable

./emsdk update
./emsdk install sdk-1.37.3-64bit > /dev/null 2>&1
./emsdk activate sdk-1.37.3-64bit

popd
