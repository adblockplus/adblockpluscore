# Prefs

The module `prefs` is provided by *core* consumers, and it should return at least a `Prefs` object literal, with the following properties:

  * `acceptable_ads_enabled`, *boolean* value, indicating [AAX](https://www.aax.media/) is preferred: `true` by default.
  * `allowed_connection_type`, *string* representing which connection type is allowed. All, if empty string, which is the default.
  * `analytics`, an optional *object* with properties used mostly during subscriptions synchronization.
  * `currentVersion`, an optional *string* pointing at the preferences version. Not relevant in core.
  * `documentation_link`, a *string* representing the URL with documentation. Currently pointing at [ABP](https://adblockplus.org/) documentation.
  * `enabled`, a *boolean* value, indicating that preferences are to be considered: `true` by default.
  * `first_run`, a *boolean* value, `true` by default, indicating the env never run before.
  * `first_run_subscription_auto_select`, a *boolean* value, `true` by default, indicating most common subscriptions should be downloaded, when it's a first run.
  * `notificationdata`, a generic *object* literal, with custom data used during synchronization and notifications.
  * `notifications_ignoredcategories`, the list of categories, as *array* of *strings*, that should not receive notifications.
  * `patternsbackups`, a *number* that specifies how many different backups  of the `patterns.ini` file should be created.
  * `patternsbackupinterval` a *number* that defines how long it should take between different `saveToDisk` operations, before new backups are created. It represents *hours* and it defaults to `24`.
  * `privateBrowsing`, a *boolean* describing if the core should work when on *private* mode. It's `false` by default.
  * `savestats`, a *boolean* indicating if filters hit should be counted. It's `true` on Desktop extension, usually `false` on Mobile.
  * `subscriptions_autoupdate`, a *boolean* indicating if subscriptions should update automatically through the synchronizer.
  * `subscriptions_check_interval`, a *number*, in milliseconds, representing how long core should wait between updates. It's `3600000`, 1 hour, by default.
  * `subscriptions_default_expiration_interval`, a *number*, in milliseconds, representing how long core should wait before expiration. It's `432000000`, 5 days, by default.
  * `subscriptions_exceptionsurl`, a *string* representing a URL where exceptions should be found.
  * `subscriptions_fallbackerrors`, a *number* representing the amount of possible re-try attempts, before falling back to the fallbackurl.
  * `subscriptions_fallbackurl`, a *string* URL, representing the end point to hit when a subscription download attempt has failed many times.
  * `subscriptions_head_expiration_interval`, a *number*, in milliseconds, representing how long core should wait before head expiration. It's `86400000`, 1 day, by default.
  * `subscriptions_initial_delay`, a *number*, in milliseconds, representing how long core should wait before initial synchronization. It's `60000`, 1 minute, by default.
  * `synchronization_enabled`, a *boolean* indicating if the synchronizer should handle updates or not.
