This discribe the format of the recommendations file.

It's a JSON file containing an Array of objects.

Each object contains the following possibly optional fields:

- `id`: the ID (a UUID as a string). In MV3 this will match the associated DeclarativeNetRequet ruleset ID.
- `type`: a string indicating the type of the subscription, known values are:
  * `ads`: EasyList and other ad blocking lists.
  * `circumvention`: The anti-circumvention list.
  * `cookies`
  * `notification`
  * `privacy`
  * `social`
  * `allowing`: allow-list.
  * other values can exist
- `languages`: an array of two letter language codes that represent the languages the subscription is suited for.
- `title`: the user readable title.
- `homepage`: the URL to the homepage for the list
- `url`: the URL to the subscription in MV3. This is unique.
- `mv2_url`: the URL to the subscription filter list in a MV2 context.
- `requires`: an array of UUID of the subscriptions required for this.
- `includes`: an array of UUID of the subscriptions included with this one.
