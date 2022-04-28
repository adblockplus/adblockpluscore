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

RUN apt-get update

RUN apt-get install jq -y
COPY . adblockpluscore

# Checkout master from main core repo to have reference data
RUN mkdir master
RUN cd master && \
git clone https://gitlab.com/eyeo/adblockplus/abc/adblockpluscore.git

ENV EXTENDHISTORICAL=false
ENTRYPOINT adblockpluscore/benchmark/benchmarkEntrypoint.sh

