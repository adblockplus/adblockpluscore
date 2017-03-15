Adblock Plus core
=================

This repository contains the generic Adblock Plus code that's shared between
platforms. This repository is not designed to be used directly, but instead to
serve as a dependency for `adblockplus`, `adblockpluschrome` and
`libadblockplus`.

Running the unit tests
----------------------

### Requirements

In order to run the unit test suite you need
[Node.js 6 or higher](https://nodejs.org/). Once Node.js is installed please run
`npm install` in the repository directory in order to install the required
dependencies.

### Running all tests

`npm test` will run all tests in the `test` directory of the repository.

### Running specific tests

You can specify specific test files or directories on the command line, e.g.:
`npm test test/synchronizer.js test/browser/elemHideEmulation.html`.

### Running the browser tests in a real browser

The tests under `test/browser` require a browser environment. `npm test` will
run these in a headless browser, with each module being loaded in a new frame.
*Note*: Currently this environment is limited to ECMAScript 5, this limitation
should hopefully be resolved soon.

Linting
-------

You can lint the code using [ESLint](http://eslint.org).

    eslint *.js chrome lib test

You will need to set up ESLint and our configuration first, see
[eslint-config-eyeo](https://hg.adblockplus.org/codingtools/file/tip/eslint-config-eyeo)
for more information.
