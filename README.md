Adblock Plus core
=================

[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](./CODE_OF_CONDUCT.md)

This repository contains the generic Adblock Plus code that's shared between
platforms. This repository is __not designed to be used directly__, but instead
to serve as a dependency for `adblockpluschrome` and `libadblockplus`.

Contributing
------------

Please follow the [code style](docs/CODE_STYLE.md). Most of the rules
are enforced by the linter (see below).

## Code of Conduct

All contributors to this project are required to read, and follow, our
[code of conduct](./CODE_OF_CONDUCT.md).


Resources
---------

One of the feature of Adblock Plus is to allow redirecting requests to
inactive versions of a resource (script, image, or media).

To that effect we have some resources generated as data built into
Adblock Plus.

As there is no "build" for adblockplsucore, if you want to modify
these resources, you'll need to regenerate the file
`data/resources.js`.

Adding the new resource for `$redirect`:

* Edit `data/resources/index.json`. The fields are defined as follow:
  * `name`: The name of the resource as used for the `$rewrite` filter option.
  * `type`: The MIME type of the content.
  * `text`: If the resource is pure text, you can use this for the text
    content. If the resource is binary data, use `file` instead.
  * `file`: The name of the file in `build/assets/` that will be included
    in the output as base64. If there is a `text` value, don't include this.
  * `comment`: an optional comment. This won't be part of the output.
* Add the binary files referenced in the `file` entry for the new resource in
  `data/resources/`. They should be checked into the repository.
* Run the `resources` package script using npm with the command
  `npm run uppdate-resources`. This will generate the file
  `data/resources.js`. This file is also managed by the version control
  system and should be part of the checkin.


Running the unit tests
----------------------

### Requirements

In order to run the unit test suite you need
[Node.js 16.10.0 or higher](https://nodejs.org/). Once Node.js is installed
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
- "chromium": Chromium 77 (using WebDriver)
- "firefox": Firefox 57 (using WebDriver)

You can not set a specific version of the browser at runtime.

Browser tests run headless by default (except on Windows). If you want
to disable headless mode on the WebDriver controlled tests, set the
BROWSER_TEST_HEADLESS environment to 0.

### Integration tests
[testpages](https://gitlab.com/eyeo/adblockplus/abc/testpages.adblockplus.org)
tests check `adblockpluscore` integration with ABP.
To run them locally, you need to install [Docker](https://www.docker.com/).

If there are no breaking changes in adblockpluscore code, you should be able to build
ABPUI extension with current codebase. To build and extract the custom extension
on Docker run the following commands:

```
docker build -t extensionforcore -f test/dockerfiles/extension.Dockerfile .
docker run extensionforcore
docker cp $(docker ps -aqf ancestor=extensionforcore):/extension .
```

The extension code uses the most recently released ABPUI Tag by default. 
```extension``` folder will contain two versions: mv2 & mv3. 

To run testpages integration tests on Docker with the custom extension previously
created, you may clone the [Testpages project](testpages-project) and follow
the instructions on [how to run tests with packed extensions](https://gitlab.com/eyeo/adblockplus/abc/testpages.adblockplus.org#packed-extensions). Example:

```
cd testpages.adblockplus.org
cp <location/to/extension/> .
docker build -t testpages --build-arg EXTENSION_FILE="extension/extensionmv<2|3>.zip" .
docker run --shm-size=512m -e SKIP_EXTENSION_DOWNLOAD="true" -e TESTS_EXCLUDE="Snippets" testpages
```

Note: At the moment the custom extension won't support snippets. That's why it
is recommended to [use the TESTS_EXCLUDE option](https://gitlab.com/eyeo/adblockplus/abc/testpages.adblockplus.org#tests-subset).


Firefox (latest) is the default browser. Other browsers can be run using the
BROWSER argument:

```sh
docker run -e BROWSER="Chromium \(latest\)" -it testpages
```

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
npm run benchmark:save
```

This snapshot will contain the latest performance improvements we'd like to
match against, while changing code in our own branch.

#### Benchmark cleanup

If benchmark results are polluted with too many data, you can run

```sh
npm run benchmark:cleanup
```

This command performs benchmark (without saving it) and cleans benchmark
results file - saving only efficient runs (for each filters set and for each
parameter).

#### Benchmark reset

If the best results are not satisfying, or impossible to reach, due new
requirements - remove benchmarkresults.json manually. Next run with
"*:save*" flag will create new files.

#### Benchmark - filter lists

Both Matching & Filtering measurements requires filters to measure against.
You can manipulate which set of filter lists to use by  setting proper flags:
``` --filter-list=All ``` for filter lists
supported flags:
- All for all filter lists (Easylist, Easylist+AA, Testpages, Easyprivacy)
- EasyList+AA for Easylist +AA
- EasyList for Easylist only

```  --match-list=slowlist ``` for matching filter lists
supported flags:
- slowlist (for list of slow filters)
- unitlist (for list used in unit tests)
- all (for combination of slowfilters & unittests)

#### Benchmark cache

By default, if filters files are not found, these are downloaded in the
`./benchmark` folder to avoid downloading different files to compare per each
consecutive run.

However, from time to time, or after a cleanup, it is recommended to remove
these files manually, and download latest.

*Please note:* downloading doesn't work for Matching filter lists.

### Benchmarking

The `npm run benchmark` command will visually show, in console, what is the
current *heap* memory state, and *bootstrap* time for both filter engine & matching.

This operations does *not* store results in the benchmark history, so it can
be executed incrementally, while we code.

#### Benchmark - matching
Part of benchmark measurement is Matching against various filters.
When benchmark is run with flag: --match then by default it will run
3 rounds of same matching per filters.
Number of rounds can be adjusted by changing ```--rounds``` argument in benchmark run:
`node --expose-gc benchmark.js --matchList=slowlist --match --rounds=23 --dt`

### Benchmark results

If we'd like to compare current changes with *heap* and *bootstrap* we had
before, `npm run benchmark:compare` would take care of that, producing a
table with differences between the previous, stored, state, and the current
one.

Please note that the comparison is always against most efficient results
generated via all previous saved benchmarks.

**Please note**, as benchmarks results might be compromised by various factors,
such as your computer dedicating CPU for other tasks while running, there is a
threshold margin to consider, where only multiple, repeated, better scores can
be considered an effective improvement, as running the same benchmark twice,
might produce diversions between scores itself, without changing code at all.

Documentation
-------------

The module documentation is generated with `jsdoc`. To generate the
documentation use:

```
npm run docs
```

CI will generate the documentation for `master` and `next` branches. It is available at:

- For `next` (the development branch): [https://eyeo.gitlab.io/adblockplus/abc/adblockpluscore/next/docs/]
- For `master` (the release branch): [https://eyeo.gitlab.io/adblockplus/abc/adblockpluscore/master/docs/]

Node.js module
--------------

adblockpluscore is available as an npm module for Node.js. See:
    https://www.npmjs.com/package/adblockpluscore

You can install it with:

```
npm install adblockpluscore
```

Or you can simply add it to your `package.json`.

```javascript
let {contentTypes, FilterEngine} = require("adblockpluscore");

async function main()
{
  let filterEngine = new FilterEngine();

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
