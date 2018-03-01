#!/usr/bin/env bash

set -x
set -e

docker --version

mkdir -p third_party/phusion-baseimage-docker
pushd third_party/phusion-baseimage-docker
git init
git fetch https://github.com/phusion/baseimage-docker.git
git checkout -b master 06e2983ba995c2e5684f8414b861425c7f5e6369 
docker build --rm -t my-base-ubuntu-image ./image
popd

docker build --rm --build-arg buildtype=${BUILDTYPE} -f .travis/Dockerfile -t adblockpluscore-test-image .

