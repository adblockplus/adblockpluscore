"use strict";

let compiled = require("compiled");
for (let cls of ["Filter", "InvalidFilter", "CommentFilter", "ActiveFilter",
    "RegExpFilter", "BlockingFilter", "WhitelistFilter", "ElemHideBase",
    "ElemHideFilter", "ElemHideException", "ElemHideEmulationFilter"])
{
  exports[cls] = compiled[cls];
}
