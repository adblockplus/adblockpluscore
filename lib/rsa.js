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

/* global crypto, TextEncoder */

/** @module */

"use strict";

const Rusha = require("./rusha.js");
const {BigInteger} = require("./jsbn.js");

/**
 * @file Provides ASN.1 sitekeys verifications.
 */

let base64ToArrayBuffer =
/**
 * Converts a base64 string to an array buffer byte array.
 * @param {string} base64 Base64 encoded string.
 * @return {Uint8Array} The same data, encoded as an array buffer.
 */
exports.base64ToArrayBuffer = function base64ToArrayBuffer(base64) {
  let binaryString = atob(base64);
  return Uint8Array.from(binaryString, c => c.charCodeAt(0));
};

/**
 * Converts an array buffer byte array into a base64 string.
 * @param {Uint8Array} buffer Byte array of any data.
 * @return {string} The same data, encoded as a base64 string.
 */
exports.arrayBufferToBase64 = function arrayBufferToBase64(buffer) {
  let binary = "";
  let bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++)
    binary += String.fromCharCode(bytes[i]);

  return btoa(binary);
};

/**
 * Checks whether the signature is valid for the given public key and data.
 * The verification is based on ASN.1 over SHA-1. This procedure is known as
 * RSA_PKCS1_SHA1 and it is the default kind of procedure, in OpenSSL, when
 * SEC_OID_ISO_SHA_WITH_RSA_SIGNATURE is used to create the key/signature pair.
 * @param {string} key a base 64 public key used to verify.
 * @param {string} signature a base 64 signature used to verify.
 * @param {string} data a unique identifier of the resource to verify.
 * @returns {Promise<boolean>} resolves with true if the signature is valid
 */
exports.verifySignature = async function verifySignature(key, signature, data) {
  let signAlgorithm = {
    name: "RSASSA-PKCS1-v1_5",
    hash: {name: "SHA-1"}
  };
  try {
    return await crypto.subtle.verify(
      signAlgorithm,
      await crypto.subtle.importKey(
        "spki",
        base64ToArrayBuffer(key),
        signAlgorithm,
        true,
        ["verify"]
      ),
      base64ToArrayBuffer(signature),
      new TextEncoder().encode(data)
    );
  }
  catch ({message}) {
    console.warn("Invalid encrypted signature: " + message);
    return false;
  }
};

// Define ASN.1 templates for the data structures used
function seq(...args) {
  return {type: 0x30, children: args};
}
function obj(id) {
  return {type: 0x06, content: id};
}
function bitStr(contents) {
  return {type: 0x03, encapsulates: contents};
}
function intResult(id) {
  return {type: 0x02, out: id};
}
function octetResult(id) {
  return {type: 0x04, out: id};
}

// See http://www.cryptopp.com/wiki/Keys_and_Formats#RSA_PublicKey
// 2A 86 48 86 F7 0D 01 01 01 means 1.2.840.113549.1.1.1
let publicKeyTemplate = seq(
  seq(obj("\x2A\x86\x48\x86\xF7\x0D\x01\x01\x01"), {}),
  bitStr(seq(intResult("n"), intResult("e")))
);

// See http://tools.ietf.org/html/rfc3447#section-9.2 step 2
// 2B 0E 03 02 1A means 1.3.14.3.2.26
let signatureTemplate = seq(
  seq(obj("\x2B\x0E\x03\x02\x1A"), {}),
  octetResult("sha1")
);

/**
 * Reads ASN.1 data matching the template passed in. This will throw an
 * exception if the data format doesn't match the template. On success an
 * object containing result properties is returned.
 * @see http://luca.ntop.org/Teaching/Appunti/asn1.html for info on the format.
 * @param {string} data
 * @param {Object} templ
 * @returns {Object}
 */
function readASN1(data, templ) {
  let pos = 0;
  function next() {
    return data.charCodeAt(pos++);
  }

  function readLength() {
    let len = next();
    if (len & 0x80) {
      let cnt = len & 0x7F;
      if (cnt > 2 || cnt == 0)
        throw "Unsupported length";

      len = 0;
      for (let i = 0; i < cnt; i++)
        len += next() << (cnt - 1 - i) * 8;
      return len;
    }
    return len;
  }

  function readNode(curTempl) {
    let type = next();
    let len = readLength();
    if ("type" in curTempl && curTempl.type != type)
      throw "Unexpected type";
    if ("content" in curTempl &&
        curTempl.content != data.substring(pos, pos + len))
      throw "Unexpected content";
    if ("out" in curTempl)
      out[curTempl.out] = new BigInteger(data.substring(pos, pos + len), 256);
    if ("children" in curTempl) {
      let i;
      let end;
      for (i = 0, end = pos + len; pos < end; i++) {
        if (i >= curTempl.children.length)
          throw "Too many children";
        readNode(curTempl.children[i]);
      }
      if (i < curTempl.children.length)
        throw "Too few children";
      if (pos > end)
        throw "Children too large";
    }
    else if ("encapsulates" in curTempl) {
      if (next() != 0)
        throw "Encapsulation expected";
      readNode(curTempl.encapsulates);
    }
    else {
      pos += len;
    }
  }

  let out = {};
  readNode(templ);
  if (pos != data.length)
    throw "Too much data";
  return out;
}

/**
 * Reads a BER-encoded RSA public key. On success returns an object with the
 * properties n and e (the components of the key), otherwise null.
 * @param {string} key
 * @return {?Object}
 */
function readPublicKey(key) {
  try {
    return readASN1(atob(key), publicKeyTemplate);
  }
  catch (e) {
    console.warn("Invalid RSA public key: " + e);
    return null;
  }
}

let rusha;

/**
 * Checks whether the signature is valid for the given public key and data.
 * The verification is based on ASN.1 over SHA-1. This procedure is known as
 * RSA_PKCS1_SHA1 and it is the default kind of procedure, in OpenSSL, when
 * SEC_OID_ISO_SHA_WITH_RSA_SIGNATURE is used to create the key/signature pair.
 *
 * This function is synchronous, and so does not return a
 * promise. It's recommended to use the asynchronous version,
 * `{@link module:rsa.verifySignature verifySignature}`, if possible.
 * @param {string} key a base 64 public key used to verify.
 * @param {string} signature a base 64 signature used to verify.
 * @param {string} data a unique identifier of the resource to verify.
 * @returns {boolean} true if the signature is valid.
 */
exports.verifySignatureSync =
function verifySignatureSync(key, signature, data) {
  if (typeof rusha == "undefined")
    rusha = new Rusha();

  let keyData = readPublicKey(key);
  if (!keyData)
    return false;

  // We need the exponent as regular number
  keyData.e = parseInt(keyData.e.toString(16), 16);

  // Decrypt signature data using RSA algorithm
  let sigInt = new BigInteger(atob(signature), 256);
  let digest = sigInt.modPowInt(keyData.e, keyData.n).toString(256);

  try {
    let pos = 0;
    let next = () => digest.charCodeAt(pos++);

    // Skip padding, see http://tools.ietf.org/html/rfc3447#section-9.2 step 5
    if (next() != 1)
      throw "Wrong padding in signature digest";
    while (next() == 255) {}
    if (digest.charCodeAt(pos - 1) != 0)
      throw "Wrong padding in signature digest";

    // Rest is an ASN.1 structure, get the SHA1 hash from it and compare to
    // the real one
    let {sha1} = readASN1(digest.substring(pos), signatureTemplate);
    let expected = new BigInteger(rusha.digest(data), 16);
    return (sha1.compareTo(expected) == 0);
  }
  catch (e) {
    console.warn("Invalid encrypted signature: " + e);
    return false;
  }
};
