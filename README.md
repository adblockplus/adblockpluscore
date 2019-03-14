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
[Node.js 7 or higher](https://nodejs.org/). Once Node.js is installed please run
`npm install` in the repository directory in order to install the required
dependencies.

### Running all tests

`npm test` will run all tests in the `test` directory of the repository.

### Running specific tests

You can specify specific test files or directories on the command line, e.g.:
`npm test test/synchronizer.js test/browser/elemHideEmulation.js`.

### Running the browser tests in a real browser

The tests under `test/browser` require a browser environment. `npm test` will
run these in a headless browser, with each module being loaded in a new frame.

The default is to run in both Chromium (using the remote interface)
and Firefox. You can select which runners to use by setting the
BROWSER_TEST_RUNNERS environment, the default is
"chromium_remote,firefox". Possible values (separated by a ',') are:

- "chromium_remote": Chromium 60 (using the remote interface)
- "chromium": Chrome 63 (using WebDriver)
- "firefox": Firefox 57 (using WebDriver)

You can not set a specific version of the browser at runtime.

### Browser caching

By default, the browsers used for testing are cached for later use in
`<root>/{chromium|firefox}-snapshots`. You can specify the caching folder with
the environment variable `BROWSER_SNAPSHOT_DIR`:

  $ export BROWSER_SNAPSHOT_DIR="~/snapshots"

Please note, that said folder needs to exist beforehand.

Linting
-------

You can lint the code using [ESLint](http://eslint.org).

    eslint *.js chrome lib test

You will need to set up ESLint and our configuration first, see
[eslint-config-eyeo](https://hg.adblockplus.org/codingtools/file/tip/eslint-config-eyeo)
for more information.
