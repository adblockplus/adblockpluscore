Adblock Plus core
=================

This repository contains the generic Adblock Plus code that's shared between
platforms. This repository is not designed to be used directly, but instead to
serve as a dependency for `adblockplus`, `adblockpluschrome` and
`libadblockplus`.

Compiling C++ code
------------------

### Purpose

In order to improve performance and memory usage, some of the code (located
inside the `compiled` directory) is written in C++ and compiled to JavaScript
via Empscripten.

### Requirements

* [Emscripten 1.37.3](https://github.com/kripken/emscripten)
* [Python 2.7](https://www.python.org)

### Running Emscripten

After installing and configuring Emscripten you can run the following command:

    python compile

This will produce a `lib/compiled.js` exporting the classes defined in C++ code.

### Technical details

Compilation is currently a two-step process. In the bindings generation step,
the source files are compiled into `compiled/bindings.cpp.js` with the
`PRINT_BINDINGS` symbol defined. This application is then executed via Node.js
and will print JavaScript wrappers for the C++ classes to
`compiled/bindings.js` according to definitions within the `EMSCRIPTEN_BINDINGS`
macro in `compiled/bindings.cpp`.

In the actual compilation step the source files are compiled into
`lib/compiled.js` without the `PRINT_BINDINGS` symbol, so that the
`EMSCRIPTEN_BINDINGS` macro ignores its contents and merely emits some generic
functions necessary for the JavaScript bindings to work. The previously
generated `compiled/bindings.js` file is added to the end of Emscripten output.

The binding generation approach is heavily inspired by
[embind](http://kripken.github.io/emscripten-site/docs/porting/connecting_cpp_and_javascript/embind.html).
However, embind doesn't use a separate build step to produce the bindings, the
bindings are rather generated dynamically at run time. As a side-effect, it
increases the build size considerably and also imposes a significant performance
penalty. Also, generating JavaScript code dynamically is discouraged for browser
extensions.

*Note*: The tricky part when generating JavaScript bindings is determining the
mangled names of C++ methods. In order to do that, `compiled/bindings.cpp.js`
will call these methods with invalid parameters and make them crash. The
resulting `abort()` call is then caught by JavaScript code that reads out the
method name from the stack. With this approach relying on some Emscripten
internals, we have to require a specific Emscripten version.

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
