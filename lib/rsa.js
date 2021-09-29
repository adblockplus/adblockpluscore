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

/**
 * @fileOverview Provides ASN.1 sitekeys verifications.
 */

/**
 * Checks whether the signature is valid for the given public key and data.
 * The verification is based on ASN.1 over SHA-1. This procedure is known as
 * RSA_PKCS1_SHA1 and it is the default kind of procedure, in OpenSSL, when
 * SEC_OID_ISO_SHA_WITH_RSA_SIGNATURE is used to create the key/signature pair.
 * @param {string} key a base 64 public key used to verify.
 * @param {string} signature a base 64 signature used to verify.
 * @param {string} data a unique identifier of the resource to verify.
 * @returns {boolean}
 */
exports.verifySignature = async(key, signature, data) => {
  let signAlgorithm = {
    name: "RSASSA-PKCS1-v1_5",
    hash: {name: "SHA-1"}
  };
  try {
    return await crypto.subtle.verify(
      signAlgorithm,
      await crypto.subtle.importKey(
        "spki",
        Uint8Array.from(atob(key), asCharCode),
        signAlgorithm,
        true,
        ["verify"]
      ),
      Uint8Array.from(atob(signature), asCharCode),
      new TextEncoder().encode(data)
    );
  }
  catch ({message}) {
    console.warn("Invalid encrypted signature: " + message);
    return false;
  }
};

let asCharCode = chr => chr.charCodeAt(0);
