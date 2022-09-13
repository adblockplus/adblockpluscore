# Copyright (c) 2019-present eyeo GmbH
#
# This module is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.

FROM node:16

# Build custom extension
# enable unsafe-perm to avoid problems with running npm as root
# see https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/193
RUN export npm_config_unsafe_perm=true

# Update git version to fix problems with ls-files command
# https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui/-/issues/1040
RUN echo "deb http://deb.debian.org/debian stretch-backports main" > /etc/apt/sources.list.d/stretch-backports.list
RUN apt-get update
RUN apt-get -t stretch-backports install -y git

# Clone ABPUI
# Checkout the latest released tag to have a stable ABPUI version
RUN git clone https://gitlab.com/adblockinc/ext/adblockplus/adblockplusui
RUN cd adblockplusui && git checkout $(git describe --tags `git rev-list --tags --max-count=1`); 
 
# Update dependencies
RUN cd adblockplusui && npm run submodules:update && git submodule status && npm install --legacy-peer-deps

# Copy Core files:
RUN cd adblockplusui/vendor/webext-sdk && npm install
RUN cd adblockplusui/vendor/webext-sdk/node_modules && rm -rf adblockpluscore

RUN mkdir adblockplusui/vendor/webext-sdk/node_modules/adblockpluscore 
COPY . adblockplusui/vendor/webext-sdk/node_modules/adblockpluscore 
RUN cd adblockplusui/vendor/webext-sdk/node_modules/adblockpluscore && npm install
RUN cd adblockplusui/adblockpluschrome \
 && npx gulp build -t chrome -c development

RUN mkdir extension
RUN mv adblockplusui/adblockpluschrome/adblockpluschrome-*.zip extension/extensionmv2.zip
RUN cd adblockplusui/adblockpluschrome && npx gulp build -t chrome -m 3 -c development
RUN mv adblockplusui/adblockpluschrome/adblockpluschrome-*.zip extension/extensionmv3.zip