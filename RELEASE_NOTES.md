0.11.0 - 2022/12/14
===================

## Changes

- Allow configuration of notification fetch intervals. #474
- Support saving local notifications between service worker
  restarts. #475
- Add a `context` argument to `modifyRule` callback. #477

## Bug fixes

- Remove questionable checks that saved filter storage must not be
  empty. #478

## Tests

- Update a deprecated webpack option.
- Update integration test branches.

## Updating your code

- DNR conversion, changes backwards compatible. #477
  - `parseFilterList()` now take an optional boolean to preserve empty
    lines. A `false` or missing argument value is equivalent to the
    previous behaviour where the empty lines are ignored.
  - The `modifyRule` callback for `createConverter` accepts a context
    object as a second parameter.
  - `convert()` and `asDNR()` take an extra line number parameter.
- Saving local notifications. #475
  - Call `notification.setLocalNotificationStorage()` to set a storage
    backend to persist the local notification. By default they are
    stored in memory.
- Configuring notification fetch intervals. #474
  - `docs/prefs.md` list 3 new preference values that are used to configure
    a different behaviour: `notifications_check_interval`,
    `notifications_expiration_interval` and `notifications_initial_delay`.

0.10.1 - 2022/11/02
===================

## Bug fixes

- Restore Easylist China on the default subscriptions. #472

0.10.0 - 2022/10/13
===================

## Changes

- `Subscription.setFilterText` now allows to set the params from the
  filter list. #459
- Default subscriptions are now MV3 compatible. #460
- Synchronizer will now pass the manifest version to the HTTP queries. #465
- Synchronizer will now increment downloadCount for a subscription
  when running in DNR mode and doing a HEAD request. #469

## Bug fixes

- `Subscription.setFilterText` now normalize filters. #462
- Misc documentation warnings addressed.
- Fix passing the disabled status for MV3 subscriptions by the synchronizer.
  #458
- Fix error when importing `jsbn.js` in strict mode (ESM). #467

## Updating your code

- The default subscription list (recommendations) is now MV3
  compatible. This might change some of the assumptions made about the
  defaults.

0.9.1 - 2022/09/02
==================

## Bug fix

- The subscription updated event no longer throw if there is no
  differences. This could happen when counting subscriptions. #456

0.9.0 - 2022/09/01
==================

## Changes

- The following scripts have been removed: `scripts/fetchSubscriptions.js`,
  `scripts/mergeSubscriptions.js`. #488
- Add a DNR mode tailored for use with Manifest v3 DeclarativeNetRequest.
  #452
  - Developers can provide recommendations at runtime to replace those
    shipped.
  - Subscription associated to DNR ruleset are counted. #454

### Testing

- Extension integration test will use a released version of the
  extension.

## Updating your code

If you were using the NPM scripts `fetch-subscriptions` and
`merge-subscriptions`, these have been moved to the
[webext-sdk](https://gitlab.com/eyeo/adblockplus/abc/webext-sdk).

With #452 and #454 we introduce some important API changes necessary
for Manifest v3 support:

- The `FilterEngine` constructor take an optional object for parameter.

  - The `features` property take a `Features`. `Features.DNR` enable
    the mode for DeclarativeNetRequest (Manifest v3
    extensions). Without this the filter engine is unchanged.

  - The `recommendations` property is an object that is in the same
    form as the content of `data/subscriptions.json` and allow
    overriding the one shipped with adblockpluscore. This is just one
    of the way you can override these.

- You can also override the "recommendations" by calling
  `setRecommendations()` (imported from `recommendations.js`). This is
  equivalent to the method during initialisation, it just allow a
  different flow in the initialization process. As long as it is done
  before the engine initialization.

- The class `RegularSubscription` is now exposed.

- Added the class `CountableSubscription` to rename
  `DownloadableSusbcription` which maintain the functionality.

- `Subscription.fromURL` has been changed so that:

  - It will know if a URL is from the Manifest v2 version of the
    subscription, based on the "recommendations". In that case it will
    remap the the `url` property of the returned subscription will be
    set properly. The uniqueness is kept.

  - It will return an instance of `RegularSubscription` if the URL is
    a valid URL. In `DNR` mode it will return *most likely* a
    `CountableSubscription`, while in the `DEFAULT` mode (like used so
    far in Manifest V2 extesnions) it will return a
    `DownloadableSubscription`. The difference is that on `DNR` mode
    the subscriptions don't download their content off a server by
    default, but will still be counted issuing a `HEAD` HTTP request
    to the URL.

  - `Subscription` will have a `downloadable` property that will
    return `true` of it is a `DownloadableSubscription`, and a
    `countable` that indicated they are counted. `downloadable`
    implies `countable`, but not the other way around.

  - `Subscription` may have a few extra properties: `id` is the ID of
    the associated DNR Ruleset in DNR mode. Use this to determine the
    associated DNR ruleset in your extension. `languages` list the
    languages supported by the subscription. This doesn't affect any
    of the filtering capabilities of the core.

  - The new method `Subscription.setFilterText()` allow setting the
    subscription filter text (an array) before adding it to the
    storage. The is useful for loading the static filter list that get
    shipped along the DNR ruleset.

0.8.0 - 2022/07/25
==================

## Changes

- Some major API changes have been introduced to remove the use of
  singletons and consolidate the interdependencies of the various
  modules. #430
- `data/resources.json` and `data/publicSuffixList.json` as now pure
  JavaScript. #420
- Added a code style document. #396
- Manifest V3 support:
  - Better test coverage for text2dnr. #441
  - Disable regexp rules by default when converting to DNR. #431
  - API to modify rules during the DNR conversion. #405
  - Make sure rules only have ASCII in the `urlFilter`. #426
  - Get the list of default subscriptions from backend. #425
  - Allow ignoring download errors with `scripts/fetchSubscriptions.js`. #445

## Bug fixes

- `npm audit` in CI will only check for production dependencies.
- `scripts/fetchSubscriptions.js` no longer write an empty file if a
  download fails. #446

## Updating your code

- Here are changes in the API:
  - `filterEngine` must be instantiated: the class is the symbol
    imported (`FilterEngine`), and initialized.
  - `defaultMatcher` is no longer exported from `matcher.js` and should
    be accessed as `filterEngine.defaultMatcher`
  - `elemHideEmulation`, `elemHide` and `snippets` are accessed as a
    property of `filterEngine`
  - `filterStorage` is accessed as a property of `filterEngine`, and
    is instantiated by the engine.
  - `filterState` is accessed as a property of `filterStorage`
  - `synchronizer` is accessed as a property of `filterStorage`

Example:
```JavaScript

let {FilterEngine} = require("adblockpluscore");

let filterEngine = new FilterEngine();

filterEngine.initialize()
        .then(() => {
            let {defaultMatcher, filterStorage} = filterEngine;

            let {synchronizer} = filterEngine;
            synchronizer.start();

            let filter = filterEngine.match(resource.url, contentTypes.IMAGE,
                                new URL(resource.documentURL).hostname);
            if (filter)
                console.log(`matched filter: ${filter.text}`);
        });
```

0.7.2 - 2022/05/18
==================

## Bug fixes

- Introduce `verifySignatureSync` to allow synchronous sitekey signature
  verfication. This a revert of issue #208 from 0.6.0. Issue #432
- Fix CI tests.

## Updating your code

- If you need synchronous `verifiySignature` just use `verifySignatureSync`.
  `verifySignature` is unchanged from 0.6.0.

0.7.1 - 2022/04/22
==================

## Bug fixes

- `filterStorage.addFiltersWithMetadata()` would fail if passing a single
filter instead of an array. #422
- Loading metadata from storage would fail with an exception. #423
- Fix inline documentation for `filtersExist()`.


0.7.0 - 2022/04/04
==================

## Changes

- Blocking
  - Return an allowing filter, even if it isn't overriding a blocking
    filter. Issue #392
- Allow adding metadata to custom filters. Issue #407 and #419.

- Tooling for Manifest V3
  - Download filter list from subscriptions for DNR conversion. #412
  - Provide a tooling to merge subscriptions files. #394
  - Fetch full filter lists. #383
  - Filter list text to DNR conversion. #379

## Bug fixes

## Updating your code

- `FilterStorage.addFilter()` is now async and returns the Subscription
  object the filter was added to in case of success.
- Metadata for custom filter. Issue #407 and #419.
  - The new API `FilterStrage.addFiltersWithMetadata()` allow adding a
    bunch of custom filter with metadata. It is async and will return the
    created `SpecialScubscription` in case of success. Issue #407 and #419.
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
  - `verifySignature` is now an async method. Issue #208

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
  you might need it add some polyfills. The signature verification API
  async.
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

When instantiating `ElemHideEmulation`, you can now pass as the second
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
