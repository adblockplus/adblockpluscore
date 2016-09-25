"use strict";

GLOBAL.atob = data => new Buffer(data, "base64").toString("binary");
GLOBAL.btoa = data => new Buffer(data, "binary").toString("base64");
GLOBAL.navigator = {};

require("node-babel")();

require("./node_modules/.bin/nodeunit");
