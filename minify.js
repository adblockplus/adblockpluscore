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

/* eslint-env node */
/* eslint no-console: "off" */

"use strict";

const {mkdir, readdir, readFile, writeFile} = require("fs").promises;
const {extname, join} = require("path");

const {minify} = require("terser");

const LICENSE = `/*
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
`;

const terserOptions = {
  module: true,
  toplevel: false
};

const parse = async(source, dest) =>
{
  for (const file of await readdir(source))
  {
    const ext = extname(file);
    const target = join(source, file);
    if (ext === ".js")
    {
      console.log("\x1b[1mminifying\x1b[0m ." + target.replace(__dirname, ""));
      const js = await readFile(target);
      const {code} = await minify(js.toString(), terserOptions);
      writeFile(join(dest, file), LICENSE.concat(code));
    }
    else if (!ext)
    {
      await mkdir(join(dest, file), {recursive: true});
      parse(target, join(dest, file));
    }
  }
};

parse(join(__dirname, "lib"), join(__dirname, "dist"));
