Adblock Plus core
=================

This repository contains the generic Adblock Plus code that's shared between
platforms. This repository is __not designed to be used directly__, but instead
to serve as a dependency for `adblockpluschrome` and `libadblockplus`.

Resources
---------

One of the feature of Adblock Plus is to allow redirecting requests to
inactive versions of a resource (script, image, or media).

To that effect we have some resources generated as data built into
Adblock Plus.

As there is no "build" for adblockplsucore, if you want to modify
these resources, you'll need to regenerate the file
`data/resources.json`.

Adding the new resource for `$redirect`:

* Edit `build/assets/index.json`. The fields are defined as follow:
  * `name`: The name of the resource as used for the `$rewrite` filter option.
  * `type`: The MIME type of the content.
  * `text`: If the resource is pure text, you can use this for the text
    content. If the resource is binary data, use `file` instead.
  * `file`: The name of the file in `build/assets/` that will be included
    in the output as base64. If there is a `text` value, don't include this.
  * `comment`: an optional comment. This won't be part of the output.
* Add the binary files referenced in the `file` entry for the new resource in
  `build/assets/`. They should be checked into the repository.
* Run the `resources` package script using npm with the command
  `npm run uppdate-resources`. This will generate the file
  `data/resources.json`. This file is also managed by the version control
  system and should be part of the checkin.


Running the unit tests
----------------------

### Requirements

In order to run the unit test suite you need
[Node.js 12.17.0 or higher](https://nodejs.org/). Once Node.js is installed
please run `npm install` in the repository directory in order to install the
required dependencies.

### Running all tests

`npm test` will run all tests in the `test` directory of the repository.

### Running specific tests

You can specify specific test files or directories on the
command line, e.g.:
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

Browser tests run headless by default (except on Windows). If you want
to disable headless mode on the WebDriver controlled tests, set the
BROWSER_TEST_HEADLESS environment to 0.

Linting
-------

You can lint the code using [ESLint](http://eslint.org) by running
`npm run lint`.

Benchmarking
------------

We do care about performance, and we want to keep an eye on changes that might
degrade the previous state.

Our package has a few helpers, `npm run ...` commands, to do so, based on most
popular filters lists used out there, focused on both bootstrap and heap
consumption.

### Bootstrapping benchmarks

Each machine is different, so we decided to not pollute the repository with
files that could be meaningless across different hardware.

This means that the very first time benchmarking is needed, we should save the
current results, so that we can incrementally monitor changes in the branch.

To store, at any time, benchmarks references, we need to run the following:

```sh
npm run benchmark-save
```

This snapshot will contain the latest performance improvements we'd like to
match against, while changing code in our own branch.

#### Benchmark cleanup

If benchmark results are polluted with too many data, you can run

```sh
npm run benchmark-all-cleanup
```

This command performs benchmark (without saving it) and cleans benchmark
results file - saving only efficient runs (for each filters set and for each
parameter).

#### Benchmark reset

If the best results are not satisfying, or impossible to reach, due new
requirements - remove benchmarkresults.json manually. Next run with
"*-save*" flag will create new files.

#### Benchmark cache

By default, if filters files are not found, these are downloaded in the
`./benchmark` folder to avoid downloading different files to compare per each
consecutive run.

However, from time to time, or after a cleanup, it is recommended to remove
these files manually, and download latest.


### Benchmarking

The `npm run benchmark` command will visually show, in console, what is the
current *heap* memory state, and *bootstrap* time.

This operations does *not* store results in the benchmark history, so it can
be executed incrementally, while we code.

### Benchmark results

If we'd like to compare current changes with *heap* and *bootstrap* we had
before, `npm run benchmark-compare` would take care of that, producing a
table with differences between the previous, stored, state, and the current
one.

Please note that the comparison is always against most efficient results
generated via all previous saved benchmarks.

**Please note**, as benchmarks results might be compromised by various factors,
such as your computer dedicating CPU for other tasks while running, there is a
threshold margin to consider, where only multiple, repeated, better scores can
be considered an effective improvement, as running the same benchmark twice,
might produce diversions between scores itself, without changing code at all.

Help center documentation generation
------------------------------------

You can automatically generate the snippets documentation available at
[help.eyeo.com](https://help.eyeo.com/en/adblockplus/) by running
`npm run helpcenter`. This will generate a file `snippet-filters-tutorial.md`
that contains the markdown text as suited for our CMS. The content is the same
as the tutorial included as part of the JSDoc.

Node.js module
-----------------------------

There is now __experimental__ support for this repository to be used directly
as a Node.js module.

```
npm install git+https://gitlab.com/eyeo/adblockplus/adblockpluscore
```

```javascript
let {contentTypes, filterEngine} = require("adblockpluscore");

async function main()
{
  await filterEngine.initialize(
    [
      "/annoying-ad.$image",
      "||example.com/social-widget.html^"
    ]
  );

  let resource = {
    url: "https://ad-server.example.net/annoying-ad.png",
    documentURL: "https://news.example.com/world.html"
  };

  let filter = filterEngine.match(resource.url, contentTypes.IMAGE,
                                  new URL(resource.documentURL).hostname);
  console.log(filter); // prints "/annoying-ad.$image"
}

if (require.main == module)
  main();
```
