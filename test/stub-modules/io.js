"use strict";

let data = new Map();

exports.IO = {
  // Non-public API, for tests only
  _getFileContents(fileName)
  {
    if (data.has(fileName))
      return data.get(fileName).contents;
    return null;
  },
  _setFileContents(fileName, contents)
  {
    data.set(fileName, {
      lastModified: Date.now(),
      contents
    });
  },
  _getModifiedTime(fileName)
  {
    if (data.has(fileName))
      return data.get(fileName).lastModified;
    return 0;
  },
  _setModifiedTime(fileName, lastModified)
  {
    if (data.has(fileName))
      data.get(fileName).lastModified = lastModified;
  },

  // Public API
  writeToFile(fileName, generator)
  {
    return Promise.resolve().then(() =>
    {
      data.set(fileName, {
        lastModified: Date.now(),
        contents: Array.from(generator)
      });
    });
  },
  readFromFile(fileName, listener)
  {
    return Promise.resolve().then(() =>
    {
      if (!data.has(fileName))
        throw new Error("File doesn't exist");

      let lines = data.get(fileName).contents;
      for (let line of lines)
        listener(line);
    });
  },
  copyFile(fromName, toName)
  {
    return Promise.resolve().then(() =>
    {
      if (!data.has(fromName))
        throw new Error("File doesn't exist");
      if (fromName == toName)
        throw new Error("Cannot copy file to itself");

      data.set(toName, data.get(fromName));
    });
  },
  renameFile(fromName, toName)
  {
    return this.copyFile(fromName, toName).then(() => this.removeFile(fromName));
  },
  removeFile(fileName)
  {
    return Promise.resolve().then(() =>
    {
      if (!data.has(fileName))
        throw new Error("File doesn't exist");

      data.delete(fileName);
    });
  },
  statFile(fileName)
  {
    return Promise.resolve().then(() =>
    {
      if (data.has(fileName))
      {
        return {
          exists: true,
          lastModified: data.get(fileName).lastModified
        };
      }
      return {
        exists: false,
        lastModified: 0
      };
    });
  }
};
