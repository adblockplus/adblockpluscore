adblockpluscore coding style
============================

# Introduction

Adblock Plus Core follows certain rules for its coding style. This
document will provide guidance on how to follow them. Because this is code
that is almost 15 years old, things have evolved.

# Linter

By default most of the style is enforced by the linter, eslint. We use
the style provided by the `eslint-config-eyeo` package, with some
overrides, notably the position of the open curly brace. (see below)

Run `npm run lint` to run the linter on the code base.

# Formatting

Most of the formatting is handled by the linter.

## Indentation

Indentation is 2 wide and uses spaces.

## Blocks

Opening curly braces `{` are on the same line as the previous
statement, after a single space.

Correct:
```javascript
function aFunction() {

}
```

Incorrect:
```javascript
function aFunction()
{

}
```

This is a difference from `eslint-config-eyeo` where the latter would
be correct.

## Spacing

Function are always separated by a single line.

Logic blocks in a function body can be separated by a single empty
line. There is no padding at the begining or the end.

# Language features

Code is written using JavaScript ES6. Classes use the ES6 syntax,
however, the modules use CommonJS (aka Node) syntax.

## Strict mode

All modules should use strict mode.

```javascript
"use strict";
```

This doesn't apply in ESM as strict mode is on by default.

## String quotes

String literals always use double quotes `"`, unless it is a string
template.

## Const

`const` is used in two situations:

1. For imports.
2. For constant values. In that case the symbol is in uppercase.

```javascript
const fs = require("fs");

const FILE_PATH = "path/to/file";
```

## Destructuring

Object destructuring is the prefered pattern for obtaining properties
in an object.

```javascript
// DON'T

let prop1 = object.prop1;

// DO

let {prop1} = object;
```

## Module import

Currently CommonJS is the de-facto module syntax.

`const` is used for imported symbols (see above), and the use of
destructuring is prefered.

```javascript
// DO

const {writeFileSync} = require("fs");

// DON'T

const writeFileSync = require("fs").writeFileSync;

// also DON'T

const fs = require("fs");
const writeFileSync = fs.writeFileSync;

```

## Using `undefined`

To check for `undefined` value we use the follow pattern:

```javascript
typeof variable == "undefined"
```

To return or assign `undefined` we use the following pattern:

```javascript
void 0
```

The reason is that in non strict mode, `undefined` can be defined on
the global object and therefor this would break the code. Newer
version of ECMAScript remove this possibility.

## For loops

Our internal test showed that `for_each()` was slower than plain `for
()` loops. Therefor the latter is prefered, at least in performance
sensitive sections.

## Variable declaration

`let` must be used instead of `var` due to scope. `let` is scoped in
the block while `var` is scoped to the function.

## async and promises

The use of `async`/`await` is prefered over `Promise`. If your
function returns a promise, just make the function `async`. If you are
waiting on a Promise just use `await` if you can (requires making the
function `async`).

`async` functions are also a good way to formalise returning errors.

For Node running code, the use of the promisified API is prefered over
the older callback API as it also allow transparent use of `async`.

# Naming

Classes are named using the `PascalCase` style. Variables and methods
are named using the `camelCase` styles, constants use the `UPPER_SNAKE_CASE`
style. An exception is made for symbols imported from other modules, in that
case the module provided name style is used verbatim.

## Private properties

Private class properties, like those used to back the storage of a
property with accessor, starts with an underscore `_`.

## Constructor

Class methods used to construct an instance start with `from`.

```javascript
Filter.fromText(text) {
  // ...
}
```

# Documenting

The code is documented with inline JSDoc markup with Markdown
flavour. Private symbols should be labelled as such with `@private`.

It is important to document both the internals and the public API of
package.

You can generate the documentation with `npm run docs`. It is done
automatically prior to running the tests.

# Tests

Whenever possible tests should be written for new code. A guiding
principle is that a new API should be tested and corner cases or bugs
undetected by tests should also come with the test.

We don't have a philosophy on whether to test all the low-level functions
or just the API, and the idea is to test what needs to be tested. Code
coverage is performed by the test harness and it should be used as
guidance to check you are testing thoroughly.

There are also external test suites like *testpages*, but they are
outside of the scope of this document.

## Writing a test

The current style for writing tests, including phrasing, isn't completely
consistant. It uses Mocha BDD style with `describe()` and
`it()`.

## Assertions

Use the `assert` module and the assertion equalities. `assert.equal`,
`assert.strictEqual` and `assert.deepEqual` for simple equality,
strict equality and deep (object field by field) equality.