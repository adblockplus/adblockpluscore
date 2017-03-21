/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-2017 eyeo GmbH
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

let {createSandbox} = require("./_common");

let Filter = null;

exports.setUp = function(callback)
{
  let sandboxedRequire = createSandbox();
  ({Filter} = sandboxedRequire("../lib/filterClassesNew"));
  callback();
};

function testActive(test,  text, domain, expectedActive, expectedOnlyDomain)
{
  let filter = Filter.fromText(text);
  test.equal(filter.isActiveOnDomain(domain), expectedActive, text + " active on " + domain);
  test.equal(filter.isActiveOnlyOnDomain(domain), expectedOnlyDomain, text + " only active on " + domain);
  filter.delete();
}

exports.testUnrestrictedBlocking = function(test)
{
  testActive(test,  "foo", null, true, false);
  testActive(test,  "foo", "com", true, false);
  testActive(test,  "foo", "example.com", true, false);
  testActive(test,  "foo", "example.com.", true, false);
  testActive(test,  "foo", "foo.example.com", true, false);
  testActive(test,  "foo", "mple.com", true, false);

  test.done();
};

exports.unrestrictedHiding = function(test)
{
  testActive(test,  "##foo", null, true, false);
  testActive(test,  "##foo", "com", true, false);
  testActive(test,  "##foo", "example.com", true, false);
  testActive(test,  "##foo", "example.com.", true, false);
  testActive(test,  "##foo", "foo.example.com", true, false);
  testActive(test,  "##foo", "mple.com", true, false);

  test.done();
};

exports.testDomainRestrictedBlocking = function(test)
{
  testActive(test,  "foo$domain=example.com", null, false, false);
  testActive(test,  "foo$domain=example.com", "com", false, true);
  testActive(test,  "foo$domain=example.com", "example.com", true, true);
  testActive(test,  "foo$domain=example.com", "example.com.", true, true);
  testActive(test,  "foo$domain=example.com.", "example.com", true, true);
  testActive(test,  "foo$domain=example.com.", "example.com.", true, true);
  testActive(test,  "foo$domain=example.com", "foo.example.com", true, false);
  testActive(test,  "foo$domain=example.com", "mple.com", false, false);

  test.done();
};

exports.testDomainRestrictedHiding = function(test)
{
  testActive(test,  "example.com##foo", null, false, false);
  testActive(test,  "example.com##foo", "com", false, true);
  testActive(test,  "example.com##foo", "example.com", true, true);
  testActive(test,  "example.com##foo", "example.com.", false, false);
  testActive(test,  "example.com.##foo", "example.com", false, false);
  testActive(test,  "example.com.##foo", "example.com.", true, true);
  testActive(test,  "example.com##foo", "foo.example.com", true, false);
  testActive(test,  "example.com##foo", "mple.com", false, false);

  test.done();
};

exports.testDomainSubdomainBlocking = function(test)
{
  testActive(test,  "foo$domain=example.com|foo.example.com", null, false, false);
  testActive(test,  "foo$domain=example.com|foo.example.com", "com", false, true);
  testActive(test,  "foo$domain=example.com|foo.example.com", "example.com", true, true);
  testActive(test,  "foo$domain=example.com|foo.example.com", "example.com.", true, true);
  testActive(test,  "foo$domain=example.com|foo.example.com", "foo.example.com", true, false);
  testActive(test,  "foo$domain=example.com|foo.example.com", "mple.com", false, false);

  test.done();
};

exports.testDomainSubdomainHiding = function(test)
{
  testActive(test,  "example.com,foo.example.com##foo", null, false, false);
  testActive(test,  "example.com,foo.example.com##foo", "com", false, true);
  testActive(test,  "example.com,foo.example.com##foo", "example.com", true, true);
  testActive(test,  "example.com,foo.example.com##foo", "example.com.", false, false);
  testActive(test,  "example.com,foo.example.com##foo", "foo.example.com", true, false);
  testActive(test,  "example.com,foo.example.com##foo", "mple.com", false, false);

  test.done();
};

exports.testSubdomainExceptionBlocking = function(test)
{
  testActive(test,  "foo$domain=~foo.example.com", null, true, false);
  testActive(test,  "foo$domain=~foo.example.com", "com", true, false);
  testActive(test,  "foo$domain=~foo.example.com", "example.com", true, false);
  testActive(test,  "foo$domain=~foo.example.com", "example.com.", true, false);
  testActive(test,  "foo$domain=~foo.example.com", "foo.example.com", false, false);
  testActive(test,  "foo$domain=~foo.example.com", "mple.com", true, false);

  test.done();
};

exports.testSubdomainExceptionHiding = function(test)
{
  testActive(test,  "~foo.example.com##foo", null, true, false);
  testActive(test,  "~foo.example.com##foo", "com", true, false);
  testActive(test,  "~foo.example.com##foo", "example.com", true, false);
  testActive(test,  "~foo.example.com##foo", "example.com.", true, false);
  testActive(test,  "~foo.example.com##foo", "foo.example.com", false, false);
  testActive(test,  "~foo.example.com##foo", "mple.com", true, false);

  test.done();
};

exports.testDomainSubdomainExceptionBlocking = function(test)
{
  testActive(test,  "foo$domain=example.com|~foo.example.com", null, false, false);
  testActive(test,  "foo$domain=example.com|~foo.example.com", "com", false, true);
  testActive(test,  "foo$domain=example.com|~foo.example.com", "example.com", true, true);
  testActive(test,  "foo$domain=example.com|~foo.example.com", "example.com.", true, true);
  testActive(test,  "foo$domain=example.com|~foo.example.com", "foo.example.com", false, false);
  testActive(test,  "foo$domain=example.com|~foo.example.com", "mple.com", false, false);

  test.done();
};

exports.testDomainSubdomainExceptionHiding = function(test)
{
  testActive(test,  "example.com,~foo.example.com##foo", null, false, false);
  testActive(test,  "example.com,~foo.example.com##foo", "com", false, true);
  testActive(test,  "example.com,~foo.example.com##foo", "example.com", true, true);
  testActive(test,  "example.com,~foo.example.com##foo", "example.com.", false, false);
  testActive(test,  "example.com,~foo.example.com##foo", "foo.example.com", false, false);
  testActive(test,  "example.com,~foo.example.com##foo", "mple.com", false, false);

  test.done();
};

exports.testDomainTLDExceptionBlocking = function(test)
{
  testActive(test,  "foo$domain=example.com|~com", null, false, false);
  testActive(test,  "foo$domain=example.com|~com", "com", false, true);
  testActive(test,  "foo$domain=example.com|~com", "example.com", true, true);
  testActive(test,  "foo$domain=example.com|~com", "example.com.", true, true);
  testActive(test,  "foo$domain=example.com|~com", "foo.example.com", true, false);
  testActive(test,  "foo$domain=example.com|~com", "mple.com", false, false);

  test.done();
};

exports.testDomainTLDExceptionHiding = function(test)
{
  testActive(test,  "example.com,~com##foo", null, false, false);
  testActive(test,  "example.com,~com##foo", "com", false, true);
  testActive(test,  "example.com,~com##foo", "example.com", true, true);
  testActive(test,  "example.com,~com##foo", "example.com.", false, false);
  testActive(test,  "example.com,~com##foo", "foo.example.com", true, false);
  testActive(test,  "example.com,~com##foo", "mple.com", false, false);

  test.done();
};

exports.testUnrelatedDomainBlocking = function(test)
{
  testActive(test,  "foo$domain=nnnnnnn.nnn", null, false, false);
  testActive(test,  "foo$domain=nnnnnnn.nnn", "com", false, false);
  testActive(test,  "foo$domain=nnnnnnn.nnn", "example.com", false, false);
  testActive(test,  "foo$domain=nnnnnnn.nnn", "example.com.", false, false);
  testActive(test,  "foo$domain=nnnnnnn.nnn", "foo.example.com", false, false);
  testActive(test,  "foo$domain=nnnnnnn.nnn", "mple.com", false, false);

  test.done();
};

exports.testUnrelatedDomainHiding = function(test)
{
  testActive(test,  "nnnnnnn.nnn##foo", null, false, false);
  testActive(test,  "nnnnnnn.nnn##foo", "com", false, false);
  testActive(test,  "nnnnnnn.nnn##foo", "example.com", false, false);
  testActive(test,  "nnnnnnn.nnn##foo", "example.com.", false, false);
  testActive(test,  "nnnnnnn.nnn##foo", "foo.example.com", false, false);
  testActive(test,  "nnnnnnn.nnn##foo", "mple.com", false, false);

  test.done();
};
