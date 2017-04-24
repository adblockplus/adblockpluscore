"use strict";

const crypto = require("crypto");

exports.Utils = {
  generateChecksum(lines)
  {
    let buffer = new Buffer(lines.join("\n"), "utf-8");
    let hash = crypto.createHash("md5");
    hash.update(buffer);
    return hash.digest("base64").replace(/=+$/, "");
  },
  yield() {}
};
