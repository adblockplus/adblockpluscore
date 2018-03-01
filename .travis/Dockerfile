FROM my-base-ubuntu-image:latest
MAINTAINER Sergei Zabolotskikh <sergei@adblockplus.org>

ARG buildtype
ENV BUILDTYPE $buildtype

# https://wiki.debian.org/Multistrap/Environment#debconf
ENV DEBIAN_FRONTEND=noninteractive DEBCONF_NONINTERACTIVE_SEEN=true

RUN apt-get update -qqy

RUN apt-get install -yqq \
  build-essential \
  git-core \
  python \
  python3-pip \
  wget \
  unzip

# Chormium deps
# https://github.com/GoogleChrome/puppeteer/blob/master/docs/troubleshooting.md
RUN apt-get install -qyy \
  gconf-service \
  libasound2 \
  libatk1.0-0 \
  libc6 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgcc1 \
  libgconf-2-4 \
  libgdk-pixbuf2.0-0 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libstdc++6 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  ca-certificates \
  fonts-liberation \
  libappindicator1 \
  libnss3 \
  lsb-release \
  xdg-utils \
  wget

# Add normal user
ENV NORMAL_USER application
ENV NORMAL_GROUP ${NORMAL_USER}
ENV NORMAL_USER_UID 998
ENV NORMAL_USER_GID 997
RUN groupadd -g ${NORMAL_USER_GID} ${NORMAL_GROUP} \
  && useradd ${NORMAL_USER} --uid ${NORMAL_USER_UID} \
         --shell /bin/bash  --gid ${NORMAL_USER_GID} \
         --create-home

ENV NORMAL_USER_HOME /home/${NORMAL_USER}
ENV TRAVIS_BUILD_DIR /home/${NORMAL_USER}/project

RUN mkdir ${NORMAL_USER_HOME}/.ssh \
  && ssh-keyscan github.com >> ${NORMAL_USER_HOME}/.ssh/known_hosts

RUN chown -R ${NORMAL_USER}:${NORMAL_GROUP} ${NORMAL_USER_HOME}/.ssh \
  && chmod -R 400 ${NORMAL_USER_HOME}/.ssh \
  && chmod 500 ${NORMAL_USER_HOME}/.ssh \
  && chmod 600 ${NORMAL_USER_HOME}/.ssh/known_hosts

RUN mkdir ${TRAVIS_BUILD_DIR}
COPY . ${TRAVIS_BUILD_DIR}
RUN chown -R ${NORMAL_USER}:${NORMAL_GROUP} ${TRAVIS_BUILD_DIR}

USER ${NORMAL_USER}
WORKDIR ${NORMAL_USER_HOME}

RUN curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.8/install.sh | bash

RUN bash ${TRAVIS_BUILD_DIR}/.travis/docker-run.sh
