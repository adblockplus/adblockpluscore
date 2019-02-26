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

let parseURL = null;
let normalizeHostname = null;
let domainSuffixes = null;
let isThirdParty = null;
let getBaseDomain = null;

exports.setUp = function(callback)
{
  let sandboxedRequire = createSandbox({
    extraExports: {
      domain: ["getBaseDomain"]
    }
  });
  (
    {parseURL, normalizeHostname, domainSuffixes, isThirdParty,
     getBaseDomain} = sandboxedRequire("../lib/url")
  );

  callback();
};

function hostnameToURL(hostname)
{
  return new URL("http://" + hostname);
}

function testURLParsing(test, url)
{
  // Note: The function expects a normalized URL.
  // e.g. "http:example.com:80?foo" should already be normalized to
  // "http://example.com/?foo". If not, the tests will fail.
  let urlInfo = parseURL(url);

  // We need to ensure only that our implementation matches that of the URL
  // object.
  let urlObject = new URL(url);

  test.equal(urlInfo.href, urlObject.href);
  test.equal(urlInfo.protocol, urlObject.protocol);
  test.equal(urlInfo.hostname, urlObject.hostname);

  test.equal(urlInfo.toString(), urlObject.toString());
  test.equal(String(urlInfo), String(urlObject));
  test.equal(urlInfo + "", urlObject + "");
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

exports.testParseURL = function(test)
{
  testURLParsing(test, "https://example.com/");
  testURLParsing(test, "https://example.com/foo");
  testURLParsing(test, "https://example.com/foo/bar");
  testURLParsing(
    test,
    "https://example.com/foo/bar?https://random/foo/bar"
  );

  testURLParsing(test, "https://example.com:8080/");
  testURLParsing(test, "https://example.com:8080/foo");
  testURLParsing(test, "https://example.com:8080/foo/bar");
  testURLParsing(
    test,
    "https://example.com:8080/foo/bar?https://random/foo/bar"
  );

  testURLParsing(test, "http://localhost/");
  testURLParsing(test, "http://localhost/foo");
  testURLParsing(test, "http://localhost/foo/bar");
  testURLParsing(
    test,
    "http://localhost/foo/bar?https://random/foo/bar"
  );

  testURLParsing(test, "https://user@example.com/");
  testURLParsing(test, "https://user@example.com/foo");
  testURLParsing(test, "https://user@example.com/foo/bar");
  testURLParsing(
    test,
    "https://user@example.com/foo/bar?https://random/foo/bar"
  );

  testURLParsing(test, "https://user@example.com:8080/");
  testURLParsing(test, "https://user@example.com:8080/foo");
  testURLParsing(test, "https://user@example.com:8080/foo/bar");
  testURLParsing(
    test,
    "https://user@example.com:8080/foo/bar?https://random/foo/bar"
  );

  testURLParsing(test, "https://user:pass@example.com/");
  testURLParsing(test, "https://user:pass@example.com/foo");
  testURLParsing(test, "https://user:pass@example.com/foo/bar");
  testURLParsing(
    test,
    "https://user:pass@example.com/foo/bar?https://random/foo/bar"
  );

  testURLParsing(test, "https://user:pass@example.com:8080/");
  testURLParsing(test, "https://user:pass@example.com:8080/foo");
  testURLParsing(test, "https://user:pass@example.com:8080/foo/bar");
  testURLParsing(
    test,
    "https://user:pass@example.com:8080/foo/bar?https://random/foo/bar"
  );

  testURLParsing(test, "https://us%40er:pa%40ss@example.com/");
  testURLParsing(test, "https://us%40er:pa%40ss@example.com/foo");
  testURLParsing(test, "https://us%40er:pa%40ss@example.com/foo/bar");
  testURLParsing(
    test,
    "https://us%40er:pa%40ss@example.com/foo/bar?https://random/foo/bar"
  );

  testURLParsing(test, "https://us%40er:pa%40ss@example.com:8080/");
  testURLParsing(test, "https://us%40er:pa%40ss@example.com:8080/foo");
  testURLParsing(test, "https://us%40er:pa%40ss@example.com:8080/foo/bar");
  testURLParsing(
    test,
    "https://us%40er:pa%40ss@example.com:8080/foo/bar?https://random/foo/bar"
  );

  testURLParsing(test, "http://192.168.1.1/");
  testURLParsing(test, "http://192.168.1.1/foo");
  testURLParsing(test, "http://192.168.1.1/foo/bar");
  testURLParsing(
    test,
    "http://192.168.1.1/foo/bar?https://random/foo/bar"
  );
  testURLParsing(
    test,
    "http://192.168.1.1:8080/foo/bar?https://random/foo/bar"
  );
  testURLParsing(
    test,
    "http://user@192.168.1.1:8080/foo/bar?https://random/foo/bar"
  );
  testURLParsing(
    test,
    "http://user:pass@192.168.1.1:8080/foo/bar?https://random/foo/bar"
  );

  testURLParsing(test, "http://[2001:db8:0:42:0:8a2e:370:7334]/");
  testURLParsing(test, "http://[2001:db8:0:42:0:8a2e:370:7334]/foo");
  testURLParsing(
    test,
    "http://[2001:db8:0:42:0:8a2e:370:7334]/foo/bar"
  );
  testURLParsing(
    test,
    "http://[2001:db8:0:42:0:8a2e:370:7334]/foo/bar?https://random/foo/bar"
  );
  testURLParsing(
    test,
    "http://[2001:db8:0:42:0:8a2e:370:7334]:8080/foo/bar?https://random/foo/bar"
  );
  testURLParsing(
    test,
    "http://user@[2001:db8:0:42:0:8a2e:370:7334]:8080/foo/bar?https://random/foo/bar"
  );
  testURLParsing(
    test,
    "http://user:pass@[2001:db8:0:42:0:8a2e:370:7334]:8080/foo/bar?https://random/foo/bar"
  );

  testURLParsing(test, "ftp://user:pass@example.com:8021/");
  testURLParsing(test, "ftp://user:pass@example.com:8021/foo");
  testURLParsing(test, "ftp://user:pass@example.com:8021/foo/bar");

  testURLParsing(test, "about:blank");
  testURLParsing(test, "chrome://extensions");
  testURLParsing(
    test,
    "chrome-extension://bhignfpcigccnlfapldlodmhlidjaion/options.html"
  );
  testURLParsing(test, "mailto:john.doe@mail.example.com");

  testURLParsing(test, "news:newsgroup");
  testURLParsing(test, "news:message-id");
  testURLParsing(test, "nntp://example.com:8119/newsgroup");
  testURLParsing(test, "nntp://example.com:8119/message-id");

  testURLParsing(test, "data:,");
  testURLParsing(
    test,
    "data:text/vnd-example+xyz;foo=bar;base64,R0lGODdh"
  );
  testURLParsing(
    test,
    "data:text/plain;charset=UTF-8;page=21,the%20data:1234,5678"
  );

  testURLParsing(test, "javascript:");
  testURLParsing(test, "javascript:alert();");
  testURLParsing(test, "javascript:foo/bar/");
  testURLParsing(test, "javascript://foo/bar/");

  testURLParsing(test, "file:///dev/random");

  testURLParsing(test, "wss://example.com/");
  testURLParsing(test, "wss://example.com:8080/");
  testURLParsing(test, "wss://user@example.com:8080/");
  testURLParsing(test, "wss://user:pass@example.com:8080/");

  testURLParsing(test, "stuns:stuns.example.com/");
  testURLParsing(test, "stuns:stuns.example.com:8080/");
  testURLParsing(test, "stuns:user@stuns.example.com:8080/");
  testURLParsing(test, "stuns:user:pass@stuns.example.com:8080/");

  // The following tests are based on
  // https://cs.chromium.org/chromium/src/url/gurl_unittest.cc?rcl=9ec7bc85e0f6a0bf28eff6b2eca678067da547e9
  // Note: We do not check for "canonicalization" (normalization). parseURL()
  // should be used with normalized URLs only.

  testURLParsing(test, "something:///example.com/");
  testURLParsing(test, "something://example.com/");

  testURLParsing(test, "file:///C:/foo.txt");
  testURLParsing(test, "file://server/foo.txt");

  testURLParsing(test, "http://user:pass@example.com:99/foo;bar?q=a#ref");

  testURLParsing(test, "http://user:%40!$&'()*+,%3B%3D%3A@example.com:12345/");

  testURLParsing(test, "filesystem:http://example.com/temporary/");
  testURLParsing(
    test,
    "filesystem:http://user:%40!$&'()*+,%3B%3D%3A@example.com:12345/"
  );

  testURLParsing(test, "javascript:window.alert('hello, world');");
  testURLParsing(test, "javascript:#");

  testURLParsing(
    test,
    "blob:https://example.com/7ce70a1e-9681-4148-87a8-43cb9171b994"
  );

  testURLParsing(test, "http://[2001:db8::1]/");
  testURLParsing(test, "http://[2001:db8::1]:8080/");
  testURLParsing(test, "http://[::]:8080/");

  testURLParsing(test, "not-a-standard-scheme:this is arbitrary content");
  testURLParsing(test, "view-source:http://example.com/path");

  testURLParsing(
    test,
    "data:text/html,Question?%3Cdiv%20style=%22color:%20#bad%22%3Eidea%3C/div%3E"
  );

  test.done();
};

exports.testNormalizeHostname = function(test)
{
  test.equal(normalizeHostname("example.com"), "example.com");
  test.equal(normalizeHostname("example.com."), "example.com");
  test.equal(normalizeHostname("example.com.."), "example.com");
  test.equal(normalizeHostname("example.com..."), "example.com");

  test.equal(normalizeHostname("Example.com"), "example.com");
  test.equal(normalizeHostname("ExaMple.Com"), "example.com");
  test.equal(normalizeHostname("ExaMple.Com.."), "example.com");

  test.equal(normalizeHostname("192.168.1.1"), "192.168.1.1");
  test.equal(normalizeHostname("192.168.1.1."), "192.168.1.1");

  test.equal(normalizeHostname("2001:0db8:85a3:0000:0000:8a2e:0370:7334"),
             "2001:0db8:85a3:0000:0000:8a2e:0370:7334");
  test.equal(normalizeHostname("2001:0db8:85a3:0000:0000:8a2e:0370:7334."),
             "2001:0db8:85a3:0000:0000:8a2e:0370:7334");
  test.equal(normalizeHostname("2001:0DB8:85A3:0000:0000:8A2E:0370:7334"),
             "2001:0db8:85a3:0000:0000:8a2e:0370:7334");

  test.done();
};

exports.testDomainSuffixes = function(test)
{
  test.deepEqual([...domainSuffixes("localhost")], ["localhost"]);
  test.deepEqual([...domainSuffixes("example.com")], ["example.com", "com"]);
  test.deepEqual([...domainSuffixes("www.example.com")],
                 ["www.example.com", "example.com", "com"]);
  test.deepEqual([...domainSuffixes("www.example.co.in")],
                 ["www.example.co.in", "example.co.in", "co.in", "in"]);

  // With blank.
  test.deepEqual([...domainSuffixes("localhost", true)], ["localhost", ""]);
  test.deepEqual([...domainSuffixes("example.com", true)],
                 ["example.com", "com", ""]);
  test.deepEqual([...domainSuffixes("www.example.com", true)],
                 ["www.example.com", "example.com", "com", ""]);
  test.deepEqual([...domainSuffixes("www.example.co.in", true)],
                 ["www.example.co.in", "example.co.in", "co.in", "in", ""]);

  // Quirks and edge cases.
  test.deepEqual([...domainSuffixes("")], []);
  test.deepEqual([...domainSuffixes(".")], ["."]);
  test.deepEqual([...domainSuffixes(".localhost")],
                 [".localhost", "localhost"]);
  test.deepEqual([...domainSuffixes(".example.com")],
                 [".example.com", "example.com", "com"]);
  test.deepEqual([...domainSuffixes("localhost.")],
                 ["localhost."]);
  test.deepEqual([...domainSuffixes("example.com.")],
                 ["example.com.", "com."]);
  test.deepEqual([...domainSuffixes("..localhost")],
                 ["..localhost", ".localhost", "localhost"]);
  test.deepEqual(
    [...domainSuffixes("..example..com")],
    ["..example..com", ".example..com", "example..com", ".com", "com"]
  );
  test.deepEqual([...domainSuffixes("localhost..")], ["localhost..", "."]);
  test.deepEqual([...domainSuffixes("example..com..")],
                 ["example..com..", ".com..", "com..", "."]);

  test.done();
};

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

exports.testGetBaseDomain = function(test)
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

      test.equal(getBaseDomain(hostname), expected,
                 `getBaseDomain("${hostname}") == "${expected}"` +
                 ` with {suffix: "${suffix}", offset: ${offset}}`);
    }
  }

  // Unknown suffixes.
  test.equal(typeof publicSuffixes["localhost"], "undefined");
  test.equal(typeof publicSuffixes["localhost.localdomain"], "undefined");

  test.equal(getBaseDomain("localhost"), "localhost");
  test.equal(getBaseDomain("localhost.localdomain"), "localhost.localdomain");
  test.equal(
    getBaseDomain("mail.localhost.localdomain"),
    "localhost.localdomain"
  );
  test.equal(getBaseDomain("www.example.localhost.localdomain"),
             "localhost.localdomain");

  // Unknown suffixes that overlap partly with known suffixes.
  test.equal(typeof publicSuffixes["example.com"], "undefined");
  test.equal(typeof publicSuffixes["africa.com"], "number");
  test.equal(typeof publicSuffixes["compute.amazonaws.com"], "number");

  test.equal(getBaseDomain("example.com"), "example.com");
  test.equal(getBaseDomain("mail.example.com"), "example.com");
  test.equal(getBaseDomain("secure.mail.example.com"), "example.com");

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

  test.equal(
    getBaseDomain("images.example.s3.dualstack.us-east-1.amazonaws.com"),
    "example.s3.dualstack.us-east-1.amazonaws.com"
  );
  test.equal(getBaseDomain("example.s3.dualstack.us-east-1.amazonaws.com"),
            "example.s3.dualstack.us-east-1.amazonaws.com");
  test.equal(getBaseDomain("s3.dualstack.us-east-1.amazonaws.com"),
            "s3.dualstack.us-east-1.amazonaws.com");
  test.equal(getBaseDomain("dualstack.us-east-1.amazonaws.com"),
            "dualstack.us-east-1.amazonaws.com");
  test.equal(getBaseDomain("example.us-east-1.amazonaws.com"),
            "example.us-east-1.amazonaws.com");
  test.equal(
    getBaseDomain("us-east-1.amazonaws.com"),
    "us-east-1.amazonaws.com"
  );
  test.equal(getBaseDomain("example.amazonaws.com"), "amazonaws.com");
  test.equal(getBaseDomain("amazonaws.com"), "amazonaws.com");

  // Edge case.
  test.equal(getBaseDomain(""), "");

  test.done();
};
