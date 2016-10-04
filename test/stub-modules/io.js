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
  append: function(path)
  {
    this.path += path;
  },
  clone: function()
  {
    return new FakeFile(this.path);
  },
  get parent()
  {
    return {create: function() {}};
  },
  normalize: function() {}
};


exports.IO = {
  resolveFilePath: function(path)
  {
    return new FakeFile(path);
  },
  statFile: function(path)
  {
    return true;
  }
};
