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

const {createSandbox} = require("./_common");

let isThirdParty = null;

exports.setUp = function(callback)
{
  let sandboxedRequire = createSandbox();
  (
    {isThirdParty} = sandboxedRequire("../lib/domain")
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
