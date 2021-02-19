Spec for the filters syntax
===========================

Specification of the Adblock Plus filter syntax.

NOTE: this document is almost empty at the moment.

Filter options
--------------

# $header

$header=KEY[=VALUE]

The `$header` option is meant to specify a key/value pair to match a HTTP
header of the response from downloading the resource whose URL matched
the filter. If the key and value match, then the resource should be
blocked.

KEY follow the HTTP header name syntax and is therefor compared case
insensitively.

VALUE (optional) is compared as is and matched as a substring of the
value. If there is no value, then match is done the header simply
being present.

Regular expressions are not supported, therefor the syntax `/re/` is
not supported. If VALUE is surrounded by `/`, the filter should be
rejected. This is reserved for future enhancement.

Non allowed characters in VALUE are `,`. To match a `,`, use the
sequence `\x2c` that will be replaced by the parser with a `,`. To
match the verbatim `\x2c`, escape it by prefixing it with a `\`.
