Adblock Plus core
=================

This repository contains the generic Adblock Plus code that's shared between
platforms. This repository is not designed to be used directly, but instead to
serve as a dependency for `adblockplus`, `adblockpluschrome` and
`libadblockplus`.

Running the unit tests
----------------------

*Note*: The unit test suite isn't complete yet, it is in the process of being
migrated from the
[adblockplustests repository](https://hg.adblockplus.org/adblockplustests/).

In order to run the unit test suite you need a reasonably recent
[Node.js version](https://nodejs.org/). Once Node.js is installed please run
`npm install` in the repository directory in order to install the required
dependencies. After that you can run `npm test` which will execute all tests
in the `test` directory of the repository.
