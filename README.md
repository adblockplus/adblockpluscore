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

* [Emscripten 1.35.0](https://github.com/kripken/emscripten)
* [Python 2.7](https://www.python.org)
* [Node.js 6 or higher](https://nodejs.org/en/)

### Running Emscripten

*Note*: The `compile` script will likely be replaced by a more elaborate
solution later.

Before you start make sure to edit the `compile` script and make sure that
`EMSCRIPTEN_PATH` constant at the top of it points to your Emscripten install.
After that run the following command:

    python compile

This will produce a `lib/compiled.js` exporting the classes defined in C++ code.

### Technical details

Compilation is currently a two-step process. In the first step,
`compiled/bindings.cpp` (definitions of classes to be exported) is compiled into
`compiled/bindings.cpp.js` with `PRINT_BINDINGS` symbol defined. This
application is then executed via Node.js and will print JavaScript wrappers for
the C++ classes to `compiled/bindings.js`.

In the next step all the C++ files in `compiled` directory are compiled,
including `compiled/bindings.cpp` - without `PRINT_BINDINGS` symbol the
`EMSCRIPTEN_BINDINGS` macro in this file will ignore its contents but rather
emit some functions necessary for the JavaScript bindings to work. The
`compiled/bindings.js` file is added to the end of Emscripten output.

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

You first need to run `npm install` in the repository directory in order to
install the required dependencies. After that you can run `npm test` which will
execute all tests in the `test` directory of the repository. You can also
specify specific test files on the command line, e.g.
`npm test test/synchronizer.js`.
