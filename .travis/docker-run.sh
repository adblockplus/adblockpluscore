#!/usr/bin/env bash

set -x
set -e

pushd ${TRAVIS_BUILD_DIR}

bash .travis/travis-install.sh
bash .travis/travis-before_script.sh
bash .travis/travis-script.sh

popd

