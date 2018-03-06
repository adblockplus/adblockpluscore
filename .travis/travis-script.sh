#!/usr/bin/env bash

. .travis/activate-nodejs.sh

set -x
set -e

PATH=${PATH}:${TRAVIS_BUILD_DIR}/third_party/ninja:$(python3 -c "import sysconfig;print(sysconfig.get_paths('posix_user')['scripts'])")

meson --buildtype ${BUILDTYPE} build/js
ninja -C build/js
npm test

USE_ASAN=true
if [[ "${BUILDTYPE}" == "release" ]]; then
USE_ASAN=false
fi 
meson -Dnative=true -Dasan=${USE_ASAN} --buildtype ${BUILDTYPE} build/native
ninja -C build/native
./build/native/abptest
