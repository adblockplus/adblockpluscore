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

FROM node:12-buster-slim

RUN apt-get update
RUN apt-get install -y wget git unzip

# Non-headless Chromium requires xvfb-run
RUN apt-get install -y libgtk-3-0 libxt6 xvfb libnss3 libxss1 libgconf-2-4 libasound2 libgbm1

# CMS and Jinja2 require Python 2.7
RUN apt-get install -y python
RUN wget https://bootstrap.pypa.io/pip/2.7/get-pip.py
RUN python get-pip.py
RUN pip install Jinja2

# Sitescripts require spawn-fcgi, python-flup and python-m2crypto
RUN apt-get install -y spawn-fcgi python-flup python-m2crypto nginx

# Clone testpages
RUN git clone https://gitlab.com/eyeo/adblockplus/abc/testpages.adblockplus.org.git
RUN cd testpages.adblockplus.org && npm install

# nginx config
ENV DOMAIN=local.testpages.adblockplus.org
RUN cp -r testpages.adblockplus.org/test/etc/* /etc
RUN rm /etc/nginx/sites-enabled/default
RUN rm /etc/nginx/sites-available/default
RUN cd /etc/nginx && openssl req -x509 -newkey rsa:4096 \
  -keyout ${DOMAIN}_key.pem \
  -out ${DOMAIN}_cert.pem \
  -days 365 -nodes -subj '/CN=$DOMAIN'
  
# spawn-fcgi config
RUN touch /var/run/500-multiplexer_spawn-fcgi.pid

# Build sitescripts
RUN git clone https://gitlab.com/eyeo/devops/legacy/sitescripts.git
RUN cd sitescripts && git checkout 98b8bc35

# Build CMS
RUN git clone https://github.com/adblockplus/cms.git
RUN pip install -r cms/requirements.txt

# Build tests
RUN cd testpages.adblockplus.org && npm install

# Generate test pages files
ENV SITE_URL=https://$DOMAIN:5000
RUN mkdir -p /var/www/$DOMAIN
RUN PYTHONPATH=cms python -m cms.bin.generate_static_pages testpages.adblockplus.org /var/www/$DOMAIN

# Build extension with current branch
# Clone abpui repo
RUN git clone -b 3.12 --recurse-submodules https://gitlab.com/eyeo/adblockplus/abpui/adblockplusui.git
# Checkout on recent release commit to have stable ABPUI version
RUN cd adblockplusui && npm install
RUN cd adblockplusui/adblockpluschrome && npm install

# Copy Core files:
RUN cd adblockplusui/adblockpluschrome/ && rm -rf adblockpluscore
RUN mkdir adblockplusui/adblockpluschrome/adblockpluscore
COPY . $HOME/adblockplusui/adblockpluschrome/adblockpluscore
RUN cd adblockplusui/adblockpluschrome/adblockpluscore && npm install
RUN cd adblockplusui/adblockpluschrome && npm install \
 && npx gulp build -t chrome -c development

# Unpack custom extension
RUN  unzip -q adblockplusui/adblockpluschrome/adblockpluschrome*.zip -d testpages.adblockplus.org/testext;
ENV BROWSER="Firefox \(latest\)"
ENV TESTS_SUBSET=""
ENV SKIP_EXTENSION_DOWNLOAD="true"
ENTRYPOINT /testpages.adblockplus.org/test/entrypoint.sh
