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

const assert = require("assert");
const {Buffer} = require("buffer");
const crypto = require("crypto");
const {LIB_FOLDER, createSandbox} = require("./_common");

const globals = {
  crypto: crypto.webcrypto,

  // fallback for TextEncoder not exported as global
  TextEncoder: global.TextEncoder || class {
    encode(data) {
      return Buffer.from(data);
    }
  }
};

let verifySignature = null;

describe("verifySignature()", function() {
  beforeEach(function() {
    let sandboxedRequire = createSandbox({globals});
    (
      {verifySignature} = sandboxedRequire(LIB_FOLDER + "/rsa")
    );
  });

  context("Using 512-bit signing key", function() {
    /*
    -----BEGIN RSA PRIVATE KEY-----
    MIIBOQIBAAJBALZc50pEXnz9TSRozwM04rryuaXl/wgUFqV9FHq8HDlkdKvRU0hX
    hb/AKrSpCJ0NCxHtal1l/kHYlHG9e7Ev6+MCAwEAAQJBALRxYs5irhgAz2b6afOj
    TcFr0PRtipckwW/IPw5euZKyvswEJt/tWDv4OdmDnRe8FSy6FG2Got3zxvaxYdc3
    AXkCIQDfFGcytIVq3sbdF3lmhzcXf29R4Hrxg/eoByAKabxknwIhANFGSNMOGPt6
    JRajfB9XmsltQJzbkr2sfHgjMN2FLM49AiAH6tt2yz1o+5snQawHXYkxBk7XIxZ5
    9+sURZx3giUzlQIfXF+pxX9zh41i0ZtYLn181WxkGNjS7OY2CtF9wEoIfQIgcHuf
    shh1qrvuKiXnD9b72PF676laKdzxzX5rX6cZZLA=
    -----END RSA PRIVATE KEY-----
    */

    let data = "test";
    let publicKey = "MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBALZc50pEXnz9TSRozwM04rryuaXl/wgUFqV9FHq8HDlkdKvRU0hXhb/AKrSpCJ0NCxHtal1l/kHYlHG9e7Ev6+MCAwEAAQ==";
    let signature = "LzKJE1BOsZDfwD/hncHq+MN5ZygIemb1Pyzx40rm3CoTL4CVPAicS1mOiTv6s9Li9Vw1ds9HwFWVMFVEwHwfIw==";

    it("should return true for correct public key, signature, and data", async function() {
      assert.strictEqual(await verifySignature(publicKey, signature, data), true);
    });

    it("should return false for data with extra characters", async function() {
      assert.strictEqual(await verifySignature(publicKey, signature, data + "1"), false);
    });

    it("should return false for truncated data", async function() {
      assert.strictEqual(await verifySignature(publicKey, signature, data.substring(0, 3)), false);
    });

    it("should return false for incorrect signature", async function() {
      assert.strictEqual(await verifySignature(publicKey, signature.substring(0, 5) + "0" + signature.substring(6), data), false);
    });

    it("should return false for incorrect public key (1)", async function() {
      assert.strictEqual(await verifySignature(publicKey.substring(0, 5) + "R" + publicKey.substring(6), signature, data), false);
    });

    it("should return false for incorrect public key (2)", async function() {
      assert.strictEqual(await verifySignature(publicKey.substring(0, 70) + "8" + publicKey.substring(71), signature, data), false);
    });
  });

  context("Using 2048-bit signing key", function() {
    /*
    -----BEGIN RSA PRIVATE KEY-----
    MIIEowIBAAKCAQEAy45IKQw0R5YBiIFyfKftx3F/6WsvtdNMnCKodkDemXuJOcFu
    Of/KeIjED/wW2DFG8qq72FAByUUFoTLcmawQZPd2htmHIk8ZkBRsaQ8HzNoK+vg4
    wnI6yN/2lhSP27D4XpedG3mtbG8aYtMuqyQaxWHInSqiM4tqW/8coAPXrRTKYmsF
    fAwPB1LCg5QI3vCy7Vdbbp907xOXON1+2seF9j8m9rh0sufXgGNWcvTNUvlf/Tid
    SVjqxe6O3hG9jTOswC8/hez7rbiLroVNnCtIDrdX6OSM/je/XSMMnS5xpZBuqZGZ
    tZm1Mr42omgst+KE+5dE6kyx76ra8LwsCEShawIDAQABAoIBAQCqJ3qcjW4aNQN9
    FzAbkciLAo55ETdll4afsbz+dMVeqUyRcebxJqgaT8EM155FBBQZf6zcaizEESVe
    lYSgFJvzuoRivu1eOZ7VuKzSuVS84btyBRJ1QEVxav3WgMOsUmebssMKl5DnZow4
    9e059ElIm6+16VCDI9Q5qKxF+lBMhemFdddmmI8c4byrLOqUQ+iQJAbgnBTsyxFO
    sDgkknAuiqAkzltqeQZ0fE1iZ4cY1wJNneltlGKLRhdq2hqgzu/6h9Y92sdcqARK
    i7zu2IChTJLxnx+XcJZ2Tq5rAh52klayEPYIyEcLw6DbD8dXGNLYfKjZ0+TYIyPB
    x3g+J7TRAoGBAO8hmfJuS3G9lf0JhjCIsKr9pjm0MAjZ6uUyQnh9vWbKwqHQzmuB
    XdS3YdAzO55dxoSt/lO9X7tLC5R4EehWKi4hkmdzmNJ23vgeLHkmNBzcrJ75jDKU
    vapbD15EvRGFBcWSkpjfM+a+isAt08Yr90DwUKz7SzW+fwik3iNbKfojAoGBANnq
    O+ZC2gg49ksRgxYwCqI1vLdLHs0o5wCNPulstJC1nH+xVcB1lvXF8Q2BTe50dR5w
    SbxoCMrrRghjvWd4bGnNzlT8jXSWYfGSgXpbuYQOzoAjezU8XiSL2FcR07FeTPsG
    JZ2bn8aObpd8SFAtdWUOpbSvJ8W8Pm84XHmweTwZAoGAJS9VcBRkmPBBNZLYkg1/
    Y2eEBK8XVRkF5NQW8AOlgyl+cIk2wBLi02QcyrJcz/iHGTSxOrZU/5vg1hqBtl5H
    utqvmHSqS/f+HhkbE0+0hNRv51yox2jHwYjdb+xCdkn4JsvvDeSPfo8cplu59bP6
    g9eaw/tjq5zOxjpU7KyNb38CgYA4oDtsfFa36EVoAGb17wn0WM5vOuAII+bTJ+D/
    OzY4nFjMfcJwvp25w/P9tGoR2sVMYZVnlgki4bxTFcf0CUDyxX4ma3I+p41P/ugS
    aZ9th4N1nMK5dLRp/sT66zD9WCnc2R4RNI1yRTTLvIn1+7oTxpicuR82rNH0iMrO
    /GKkkQKBgF1Vh1ydmW6v5bd5Oyt8uYy/dI3ajZ+j0hcNuMO6qUdAXHfB1ZWLTnNL
    yTHyMCVckB22+GdZKhrvLDy3XTTWx+JF5fVVIpiewuNRfLhEjh0uvbKzERQ7xPDB
    T/YKqjp7uRICikPwvySruukdXDrxZpykOsusG0QbP2qemjfmM025
    -----END RSA PRIVATE KEY-----
    */

    let data = "test";
    let publicKey = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAy45IKQw0R5YBiIFyfKftx3F/6WsvtdNMnCKodkDemXuJOcFuOf/KeIjED/wW2DFG8qq72FAByUUFoTLcmawQZPd2htmHIk8ZkBRsaQ8HzNoK+vg4wnI6yN/2lhSP27D4XpedG3mtbG8aYtMuqyQaxWHInSqiM4tqW/8coAPXrRTKYmsFfAwPB1LCg5QI3vCy7Vdbbp907xOXON1+2seF9j8m9rh0sufXgGNWcvTNUvlf/TidSVjqxe6O3hG9jTOswC8/hez7rbiLroVNnCtIDrdX6OSM/je/XSMMnS5xpZBuqZGZtZm1Mr42omgst+KE+5dE6kyx76ra8LwsCEShawIDAQAB";
    let signature = "UYTQmygOICKi4ozlMbLSYFZ1olovZZFYT0nZygPrGoA+6+ta+wzKnPnghK4j35QSucrf3yN8DSXa/kXBX0LcTmEaSwoNRuM7QPjT6v9hNsVjwNexOUk6pR3DotYuD1yV36sITNjx59McG8/q6qLyj2A8KVlUbtnz/IiLzzw+wgy6WRjU1meYP8oiQGVIkB21ICqqaJ5kCvM0YrAqzQKAya513O51ADA6aC/EMz6B62XGgZ+AywUMcH2Wvx7cyCvPVLfAbXcgex1JtpPS6vGcdpigaVQkoyl4cIQmX1ppasgJj2MiYl2htXvFXjYoWniEmspteNu3UybB0nMHnYjKdQ==";

    it("should return true for correct public key, signature, and data", async function() {
      assert.strictEqual(await verifySignature(publicKey, signature, data), true);
    });

    it("should return false for data with extra characters", async function() {
      assert.strictEqual(await verifySignature(publicKey, signature, data + "1"), false);
    });

    it("should return false for truncated data", async function() {
      assert.strictEqual(await verifySignature(publicKey, signature, data.substring(0, 3)), false);
    });

    it("should return false for incorrect signature", async function() {
      assert.strictEqual(await verifySignature(publicKey, signature.substring(0, 5) + "0" + signature.substring(6), data), false);
    });

    it("should return false for incorrect public key (1)", async function() {
      assert.strictEqual(await verifySignature(publicKey.substring(0, 5) + "R" + publicKey.substring(6), signature, data), false);
    });

    it("should return false for incorrect public key (2)", async function() {
      assert.strictEqual(await verifySignature(publicKey.substring(0, 70) + "8" + publicKey.substring(71), signature, data), false);
    });
  });

  context("Using very long data", function() {
    /*
    -----BEGIN RSA PRIVATE KEY-----
    MIIBOQIBAAJBALZc50pEXnz9TSRozwM04rryuaXl/wgUFqV9FHq8HDlkdKvRU0hX
    hb/AKrSpCJ0NCxHtal1l/kHYlHG9e7Ev6+MCAwEAAQJBALRxYs5irhgAz2b6afOj
    TcFr0PRtipckwW/IPw5euZKyvswEJt/tWDv4OdmDnRe8FSy6FG2Got3zxvaxYdc3
    AXkCIQDfFGcytIVq3sbdF3lmhzcXf29R4Hrxg/eoByAKabxknwIhANFGSNMOGPt6
    JRajfB9XmsltQJzbkr2sfHgjMN2FLM49AiAH6tt2yz1o+5snQawHXYkxBk7XIxZ5
    9+sURZx3giUzlQIfXF+pxX9zh41i0ZtYLn181WxkGNjS7OY2CtF9wEoIfQIgcHuf
    shh1qrvuKiXnD9b72PF676laKdzxzX5rX6cZZLA=
    -----END RSA PRIVATE KEY-----
    */

    let data = "foobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobarfoobar";
    let publicKey = "MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBALZc50pEXnz9TSRozwM04rryuaXl/wgUFqV9FHq8HDlkdKvRU0hXhb/AKrSpCJ0NCxHtal1l/kHYlHG9e7Ev6+MCAwEAAQ==";
    let signature = "L1LtPxp9VwL/ij8tuIxJqtx6mD3qoFhcEmPl8A1RlNeOP34A25nzyzRWuP2wEbHcKKXnAQESdIXaTaEuymXviQ==";

    it("should return true for correct public key, signature, and data", async function() {
      assert.strictEqual(await verifySignature(publicKey, signature, data), true);
    });

    it("should return false for data with extra characters", async function() {
      assert.strictEqual(await verifySignature(publicKey, signature, data + "1"), false);
    });

    it("should return false for truncated data", async function() {
      assert.strictEqual(await verifySignature(publicKey, signature, data.substring(0, 3)), false);
    });

    it("should return false for incorrect signature", async function() {
      assert.strictEqual(await verifySignature(publicKey, signature.substring(0, 5) + "0" + signature.substring(6), data), false);
    });

    it("should return false for incorrect public key (1)", async function() {
      assert.strictEqual(await verifySignature(publicKey.substring(0, 5) + "R" + publicKey.substring(6), signature, data), false);
    });

    it("should return false for incorrect public key (2)", async function() {
      assert.strictEqual(await verifySignature(publicKey.substring(0, 70) + "8" + publicKey.substring(71), signature, data), false);
    });
  });

  context("Using real-life signature", function() {
    let data = [
      "/info/Liquidit%C3%A4t.html?ses=Y3JlPTEzNTUyNDE2OTImdGNpZD13d3cuYWZmaWxpbmV0LXZlcnplaWNobmlzLmRlNTBjNjAwNzIyNTlkNjQuNDA2MjE2MTImZmtpPTcyOTU2NiZ0YXNrPXNlYXJjaCZkb21haW49YWZmaWxpbmV0LXZlcnplaWNobmlzLmRlJnM9ZGZmM2U5MTEzZGNhMWYyMWEwNDcmbGFuZ3VhZ2U9ZGUmYV9pZD0yJmtleXdvcmQ9TGlxdWlkaXQlQzMlQTR0JnBvcz0yJmt3cz03Jmt3c2k9OA==&token=AG06ipCV1LptGtY_9gFnr0vBTPy4O0YTvwoTCObJ3N3ckrQCFYIA3wod2TwAjxgAIABQv5WiAlCH8qgOUJGr9g9QmuuEG1CDnK0pUPbRrk5QhqDgkQNxP4Qqhz9xZe4",
      "www.affilinet-verzeichnis.de",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.21 (KHTML, like Gecko) Chrome/25.0.1349.2 Safari/537.21"
    ];
    let publicKey = "MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBANnylWw2vLY4hUn9w06zQKbhKBfvjFUCsdFlb6TdQhxb9RXWXuI4t31c+o8fYOv/s8q1LGPga3DE1L/tHU4LENMCAwEAAQ==";
    let signature = "nLH8Vbc1rzmy0Q+Xg+bvm43IEO42h8rq5D9C0WCn/Y3ykgAoV4npzm7eMlqBSwZBLA/0DuuVsfTJT9MOVaurcA==";

    it("should return true for correct public key, signature, and data", async function() {
      assert.strictEqual(await verifySignature(publicKey, signature, data.join("\0")), true);
    });
  });
});
