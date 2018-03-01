#!/usr/bin/env bash

if [[ -z ${NVM_DIR} ]]; then
NVM_DIR=${HOME}/.nvm
fi

. ${NVM_DIR}/nvm.sh
nvm use default


