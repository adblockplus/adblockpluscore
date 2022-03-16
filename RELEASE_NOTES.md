0.7.0
=====

## Changes

- Blocking
  - Return an allowing filter, even if it isn't overriding a blocking
    filter. Issue #392
- Allow adding metadata to custom filters. Issue #407

- Tooling for Manifest V3
  - Download filter list from subscriptions for DNR conversion. #412
  - Provide a tooling to merge subscriptions files. #394
  - Fetch full filter lists. #383
  - Filter list text to DNR conversion. #379

## Bug fixes

## Updating your code

- `FilterStorage.addFilter()` now returns the Subscription object the
  filter was added to in case of success.
- Metadata for custom filter. Issue #407
  - The new API `FilterStrage.addFiltersWithMetadata()` allow adding a
    bunch of custom filter with metadata. It will return the created
    `SpecialScubscription` in case of success. Issue #407
  - Added `FilterStorage.getMetadataForFilter()` and
    `FilterStorage.setMetadataForFilter()` to access metadata.
- Added `FilterStorage.getSubscription()` to get a subscription by URL.
- Changed FilterStorage.hasSubscription() to accept a URL in addition
  to the subscription itself.

0.6.0 - 2022/02/16
==================

## Changes

- Internal code changes
  - Revert `knownFilters` as non self-cleaning Map. Issue #371
  - Use native crypto API for sitekeys. Issue #208
  - Change linter rule to force space before curly braces. Issue #393

- API changes
  - Allow filters to be enabled / disabled per subscription. Issue #115

- Documentaion improvements
  - Document some of the preference keys. Issue #365
  - Add missing download status documentation (inline).
  - Minor documentation formatting improvements.

- Testing improvements
  - Add unit tests for `iniParser`. Issue #152
  - Fix some benchmark scripts that have been broken in a previous change.
  - Fix benchmarking code not running in some situations. MR !603
  - Fix downloading filter lists in benchmarks. Issue #376
  - Added time based benchmarking for filter matching. Issue #392
  - Require Node 16 for the test. Issue #374
  - Remove profiler option that doesn't exist anymore in Node 16. Issue #374
  - Update mocha to ^9.x and eslint to 3.72.
  - Ensure Regular Expression flags are preserved in `parseScript`.
  - Test against testpages in CI. Issue #398
  - Improve automated tests around `filterListener` with large tests sample.
    Issue #372
  - Improve reliability of `ElemHideEmulation`. Issue #384

- Filtering
  - Implement `:not` selector for `ElemHideEmulation` filters. Issue #369.

- Updated public suffix list. Issue #406

## Bug fixes

- Identify more types of ElemenHiding filters which could be triggered by
  attribute changes. Issue #377
- Treat header and CSP separately from resource types. Issue #326

## Updating your code

- Sitekey now use the webcrypto API. It's available in all support
  browsers, and in NodeJS 16. However if you use a different platform,
  you might need it add some polyfills.
- When calling `Matcher.match` or `Matcher.search` to check if any
  filters match a request in the context of header filtering or CSP
  filtering, the content type must now be the "context" type
  (`contentTypes.HEADER` or `contentTypes.CSP`) combined with the request
  resource type using the bitwise or operator.

0.5.1 - 2022/01/06
==================

## Bug fixes

- Fix a regression on loading stylesheet in the ElementHidingEmulation
  code. Issue #390

0.5.0 - 2021/10/07
==================

## Changes

- Internal code changes
  - All the scripts for building are in `scripts` and the content of
    `build/assets` has been moved to `data/resources`.
    `FILTERS_SPEC.md` is moved to `docs`.
    The destination of the documentation is now in `build/docs`.
    Issue #357
  - Update code style and linting: curly braces are now at the end
    of the line instead of on the next. Issue #311
    `eslint` is now called with `ecmaVersion` set to 2018
  - Simplify the subclassing of `ContentFilter`.
  - Move all pattern matching logic to the `patterns` module. This
    wasn't a public API. Issue #79

- API changes
  - You can now use `Prefs` to set the parameters for the timing of
    the `Synchronizer`. Issue #138
  - Allow bypassing filter normalization. Issue #313
  - `InvalidFilter` now has the `option` property set for errors like
    `"filter_unknown_option"`. Issue #305

- Documentaion improvements:
  - Various README update. Issue #337
  - Various jsdoc update to fix documentation not being generated.
  - Update jsdoc to 3.6.7.
  - Added documentation for the `ElemHideEmulation` class.
  - Added documentation to explain soft and hard expiration times in the
    `Synchronizer` class. Issue #58
  - Expand filter type documentation.

- Testing improvements:
  - Upgrade to geckodriver 2.0.4 for the test harness.
  - Expand test cases for the filter list header parsing.
  - Add more tests for lib/filterState.js. Issue #257
  - Benchmarking - add matching measurements. Issue #322. Issue #301
  - Describe our benchmarking options in package.json

- Snippet support:
  - Remove the machine learning code that was only use by the snippets
    library. Issue #321

- Changes for the webext-sdk
  - Changes notifications as suite for the webext-sdk. Issue #353
    TBD document this better.
  - Add `notifications.considerBlocked` as an alias to
    `Prefs["show_statsinpopup"]`. Issue #334

- Filtering
  - `:xpath` is now allowed as extended syntax in the
    ElementHidingEmulation filters. Issue #308
  - `:has()` and `:has-text()` are aliases of `:-abp-has()` and
    `:-abp-contains()` respectively, for better compatibility with other
    ad blockers. Issue #229, #355
  - Escape multiple `{` and `}` in CSS rules for element hiding. Issue #331
  - Reject filters that are considered as too broad. Issue #264, #312, #370

- Misc performance changes
  - Avoid redundant option transformation
  - Simplify matching Regular Expression. Issue #319
  - Lower heap memory usage. Issue #310
  - Allow bypassing filter normalization. Issue #313
  - Discard `InvalidFilter` instances. Issue #338
  - Avoid duplicated static JSON data. Issue #318

- Build
  - Provide a minified core. Issue #306, #352

## Bug fixes

  - Avoid uppercasing sitekeys. Issue #303
  - Fix various problems with elements that are hidden when they should
    no longer be. Issues #202, #339, #348.
  - Fix a problem where an invalid CSS rule would disable all the element
    hiding. Issue #104
  - Fix some timing issues with the engine initialization. Issue #344

## Updating your code

`Filter.normalize()` now has an optional parameter to skip the heavy
normailization. If you are adding already normalized filters, you can
pass `true` to `Fileter.normalize()` to avoid doing most of the
work. It's a bug to add a non normalized filter. See issue #313

`Filter.fromText()` return sometime an `InvalidFilter` when there is
an error. Now if `Filter.reason` is `"filter_unknown_option"` may
contain in `Filter.option` the name of the option that was not
recognized. You can safely ignore it. See issue #305.

Also, `Filter.fromText()` is now more strict by rejecting filters that
would be deemed too broad. In these cases it returns `InvalidFilter`
with a `Filter.reason` set to `"filter_url_not_specific_enough"` if
the pattern is 3 characters or less, or
`"filter_elemhide_not_specific_enough"` for a generic element hiding
filter whose body (CSS selector) is 2 characters or less. See issue
#264. However a wildcard `*` in a URL filter allow short filters to
still be valid. See issue #370.

When instanciating `ElemHideEmulation`, you can now pass as the second
parameter of the constructor, a callback to unhide, function that
would be called to unhide elements previously hidden (doing the
opposite of the hide callback). See issue #202.

If you were adding `lib/ml.js` to your code you shall change the path
to grab the file from the snippet library.

To use the new parameters for the `Synchronizer`, set the following
values in your `Prefs` object:
- `subscriptions_check_interval` how long the recheck for a list in
  case of error, in milliseconds.
- `subscriptions_initial_delay` the initial delay in milliseconds before
  starting the synchronization.
- `subscriptions_head_expiration_interval`: how long before a disable
  list expires, by default, in milliseconds.
- `subscriptions_default_expiration_interval`: how long before the
  list expires, by default, in milliseconds.

0.4.0 - 2021/09/10
==================

## Changes

The snippet library format has changed and is incompatible with the
one usable in the previous release.

## Bug fixes

- Fixed #302 - remove snippets
- Fixed #362 - inject snippets as bundles
