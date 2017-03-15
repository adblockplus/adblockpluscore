"use strict";

let data = {};

//
// Fake nsIFile implementation for our I/O
//
function FakeFile(path)
{
  this.path = path;
}
FakeFile.prototype =
{
  get leafName()
  {
    return this.path;
  },
  set leafName(value)
  {
    this.path = value;
  },
  append(path)
  {
    this.path += path;
  },
  exists()
  {
    return this.path in data;
  },
  get contents()
  {
    return (data[this.path] || {}).contents;
  },
  set contents(value)
  {
    data[this.path] = {lastModified: Date.now()};
    return data[this.path].contents = value;
  },
  get lastModifiedTime()
  {
    return (data[this.path] || {}).lastModified;
  },
  set lastModifiedTime(value)
  {
    return (data[this.path] || {}).lastModified = value;
  },
  clone()
  {
    return new FakeFile(this.path);
  },
  get parent()
  {
    return {create() {}};
  },
  normalize() {}
};

exports.IO = {
  lineBreak: "\n",
  resolveFilePath(path)
  {
    return new FakeFile(path);
  },
  writeToFile(file, generator, callback)
  {
    Promise.resolve().then(() =>
    {
      let lines = [];
      for (let line of generator)
        lines.push(line);
      file.contents = lines.join("\n") + "\n";
    }).then(() => callback(null)).catch(e => callback(e));
  },
  readFromFile(file, listener, callback)
  {
    Promise.resolve().then(() =>
    {
      if (!data.hasOwnProperty(file.path))
        throw new Error("File doesn't exist");

      let lines = file.contents.split("\n");
      if (lines.length && lines[lines.length - 1] == "")
        lines.pop();
      for (let line of lines)
        listener.process(line);
      listener.process(null);
    }).then(() => callback(null)).catch(e => callback(e));
  },
  copyFile(from, to, callback)
  {
    Promise.resolve().then(() =>
    {
      if (!data.hasOwnProperty(from.path))
        throw new Error("File doesn't exist");
      if (from.path == to.path)
        throw new Error("Cannot copy file to itself");

      to.contents = from.contents;
    }).then(() => callback(null)).catch(e => callback(e));
  },
  renameFile(from, newName, callback)
  {
    Promise.resolve().then(() =>
    {
      if (!data.hasOwnProperty(from.path))
        throw new Error("File doesn't exist");
      if (from.path == newName)
        throw new Error("Cannot move file to itself");

      data[newName] = data[from.path];
      delete data[from.path];
    }).then(() => callback(null)).catch(e => callback(e));
  },
  removeFile(file, callback)
  {
    Promise.resolve().then(() =>
    {
      if (!data.hasOwnProperty(file.path))
        throw new Error("File doesn't exist");

      delete data[file.path];
    }).then(() => callback(null)).catch(e => callback(e));
  },
  statFile(file, callback)
  {
    Promise.resolve().then(() =>
    {
      if (file.exists())
      {
        return {
          exists: true,
          isDirectory: false,
          isFile: true,
          lastModified: file.lastModifiedTime
        };
      }
      return {
        exists: false,
        isDirectory: false,
        isFile: false,
        lastModified: 0
      };
    }).then(result => callback(null, result)).catch(e => callback(e));
  }
};
