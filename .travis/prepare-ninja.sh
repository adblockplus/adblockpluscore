#!/usr/bin/env bash

set -x
set -e

if [[ "$TRAVIS_OS_NAME" = "osx" ]]; then
brew update; brew install ninja;
else
wget https://github.com/ninja-build/ninja/releases/download/v1.8.2/ninja-linux.zip -O third_party/ninja-build.zip
mkdir third_party/ninja
unzip third_party/ninja-build.zip -d third_party/ninja
fi
