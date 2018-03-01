#!/usr/bin/env bash

. .travis/activate-nodejs.sh

set -x
set -e

PATH=${PATH}:${TRAVIS_BUILD_DIR}/third_party/ninja:$(python3 -c "import sysconfig;print(sysconfig.get_paths('posix_user')['scripts'])")

meson --buildtype ${BUILDTYPE} build
ninja -C build
npm test
