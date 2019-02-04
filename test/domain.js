/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

// Only starting NodeJS 10 that URL is in the global space.
const {URL} = require("url");
const {createSandbox} = require("./_common");

const publicSuffixes = require("../data/publicSuffixList.json");

let isThirdParty = null;
let getDomain = null;

exports.setUp = function(callback)
{
  let sandboxedRequire = createSandbox({
    extraExports: {
      domain: ["getDomain"]
    }
  });
  (
    {isThirdParty, getDomain} = sandboxedRequire("../lib/domain")
  );

  callback();
};

function hostnameToURL(hostname)
{
  return new URL("http://" + hostname);
}

function testThirdParty(test, requestHostname, documentHostname, expected,
                        message)
{
  test.equal(
    isThirdParty(
      hostnameToURL(requestHostname),

      // Chrome's URL object normalizes IP addresses. So some test
      // will fail if we don't normalize the document host as well.
      hostnameToURL(documentHostname).hostname
    ),
    expected,
    message
  );
}

exports.testIsThirdParty = function(test)
{
  testThirdParty(test, "foo", "foo", false, "same domain isn't third-party");
  testThirdParty(test, "foo", "bar", true, "different domain is third-party");
  testThirdParty(test, "foo.com", "foo.com", false,
                 "same domain with TLD (.com) isn't third-party");
  testThirdParty(test, "foo.com", "bar.com", true,
                 "same TLD (.com) but different domain is third-party");
  testThirdParty(test, "foo.com", "www.foo.com", false,
                 "same domain but differend subdomain isn't third-party");
  testThirdParty(test, "foo.example.com", "bar.example.com", false,
                 "same basedomain (example.com) isn't third-party");
  testThirdParty(test, "foo.uk", "bar.uk", true,
                 "same TLD (.uk) but different domain is third-party");
  testThirdParty(test, "foo.co.uk", "bar.co.uk", true,
                 "same TLD (.co.uk) but different domain is third-party");
  testThirdParty(test, "foo.example.co.uk", "bar.example.co.uk", false,
                 "same basedomain (example.co.uk) isn't third-party");
  testThirdParty(test, "1.2.3.4", "1.2.3.4", false,
                 "same IPv4 address isn't third-party");
  testThirdParty(test, "1.1.1.1", "2.1.1.1", true,
                 "different IPv4 address is third-party");
  testThirdParty(test, "0x01ff0101", "0x01ff0101", false,
                 "same IPv4 hexadecimal address isn't third-party");
  testThirdParty(test, "0x01ff0101", "0x01ff0102", true,
                 "different IPv4 hexadecimal address is third-party");
  testThirdParty(
    test,
    "1.0xff.3.4", "1.0xff.3.4", false,
    "same IPv4 address with hexadecimal octet isn't third-party"
  );
  testThirdParty(
    test,
    "1.0xff.1.1", "2.0xff.1.1", true,
    "different IPv4 address with hexadecimal octet is third-party"
  );
  testThirdParty(
    test,
    "0xff.example.com", "example.com", false,
    "domain starts like a hexadecimal IPv4 address but isn't one"
  );
  testThirdParty(
    test,
    "[2001:db8:85a3::8a2e:370:7334]", "[2001:db8:85a3::8a2e:370:7334]", false,
    "same IPv6 address isn't third-party"
  );
  testThirdParty(
    test,
    "[2001:db8:85a3::8a2e:370:7334]", "[5001:db8:85a3::8a2e:370:7334]", true,
    "different IPv6 address is third-party"
  );
  testThirdParty(
    test,
    "[::ffff:192.0.2.128]", "[::ffff:192.0.2.128]", false,
    "same IPv4-mapped IPv6 address isn't third-party"
  );
  testThirdParty(
    test,
    "[::ffff:192.0.2.128]", "[::ffff:192.1.2.128]", true,
    "different IPv4-mapped IPv6 address is third-party"
  );
  testThirdParty(test, "xn--f-1gaa.com", "f\u00f6\u00f6.com", false,
                 "same IDN isn't third-party");
  testThirdParty(test, "example.com..", "example.com....", false,
                 "traling dots are ignored");

  test.done();
};

exports.testGetDomain = function(test)
{
  let parts = ["aaa", "bbb", "ccc", "ddd", "eee"];
  let levels = 3;

  for (let suffix in publicSuffixes)
  {
    let offset = publicSuffixes[suffix];

    // If this fails, add more parts.
    test.ok(offset <= parts.length - levels,
            "Not enough domain parts for testing");

    for (let i = 0; i < offset + levels; i++)
    {
      let hostname = parts.slice(0, i).join(".");
      hostname += (hostname ? "." : "") + suffix;

      let expected = parts.slice(Math.max(0, i - offset), i).join(".");
      expected += (expected ? "." : "") + suffix;

      test.equal(getDomain(hostname), expected,
                 `getDomain("${hostname}") == "${expected}"` +
                 ` with {suffix: "${suffix}", offset: ${offset}}`);
    }
  }

  // Unknown suffixes.
  test.equal(typeof publicSuffixes["localhost"], "undefined");
  test.equal(typeof publicSuffixes["localhost.localdomain"], "undefined");

  test.equal(getDomain("localhost"), "localhost");
  test.equal(getDomain("localhost.localdomain"), "localhost.localdomain");
  test.equal(getDomain("mail.localhost.localdomain"), "localhost.localdomain");
  test.equal(getDomain("www.example.localhost.localdomain"),
             "localhost.localdomain");

  // Unknown suffixes that overlap partly with known suffixes.
  test.equal(typeof publicSuffixes["example.com"], "undefined");
  test.equal(typeof publicSuffixes["africa.com"], "number");
  test.equal(typeof publicSuffixes["compute.amazonaws.com"], "number");

  test.equal(getDomain("example.com"), "example.com");
  test.equal(getDomain("mail.example.com"), "example.com");
  test.equal(getDomain("secure.mail.example.com"), "example.com");

  // Cascading offsets.

  // If these sanity checks fail, look for other examles of cascading offsets
  // from the public suffix list.
  test.equal(
    typeof publicSuffixes[
      "images.example.s3.dualstack.us-east-1.amazonaws.com"
    ],
    "undefined"
  );
  test.equal(
    typeof publicSuffixes["example.s3.dualstack.us-east-1.amazonaws.com"],
    "undefined"
  );
  test.equal(publicSuffixes["s3.dualstack.us-east-1.amazonaws.com"], 1);
  test.equal(typeof publicSuffixes["dualstack.us-east-1.amazonaws.com"],
             "undefined");
  test.equal(typeof publicSuffixes["example.us-east-1.amazonaws.com"],
             "undefined");
  test.equal(publicSuffixes["us-east-1.amazonaws.com"], 1);
  test.equal(typeof publicSuffixes["example.amazonaws.com"], "undefined");
  test.equal(typeof publicSuffixes["amazonaws.com"], "undefined");

  test.equal(getDomain("images.example.s3.dualstack.us-east-1.amazonaws.com"),
            "example.s3.dualstack.us-east-1.amazonaws.com");
  test.equal(getDomain("example.s3.dualstack.us-east-1.amazonaws.com"),
            "example.s3.dualstack.us-east-1.amazonaws.com");
  test.equal(getDomain("s3.dualstack.us-east-1.amazonaws.com"),
            "s3.dualstack.us-east-1.amazonaws.com");
  test.equal(getDomain("dualstack.us-east-1.amazonaws.com"),
            "dualstack.us-east-1.amazonaws.com");
  test.equal(getDomain("example.us-east-1.amazonaws.com"),
            "example.us-east-1.amazonaws.com");
  test.equal(getDomain("us-east-1.amazonaws.com"), "us-east-1.amazonaws.com");
  test.equal(getDomain("example.amazonaws.com"), "amazonaws.com");
  test.equal(getDomain("amazonaws.com"), "amazonaws.com");

  // Edge case.
  test.equal(getDomain(""), "");

  test.done();
};
