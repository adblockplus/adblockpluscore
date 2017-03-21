#pragma once

#include "String.h"

class StringScanner
{
private:
  const DependentString mStr;
  String::size_type mPos;
  String::size_type mEnd;
  String::value_type mTerminator;
public:
  explicit StringScanner(const String& str, String::size_type pos = 0,
        String::value_type terminator = u'\0')
      : mStr(str), mPos(pos), mEnd(str.length()), mTerminator(terminator) {}

  bool done() const
  {
    return mPos >= mEnd;
  }

  String::size_type position() const
  {
    return mPos - 1;
  }

  String::value_type next()
  {
    String::value_type result = done() ? mTerminator : mStr[mPos];
    mPos++;
    return result;
  }

  bool skipOne(String::value_type ch)
  {
    if (!done() && mStr[mPos] == ch)
    {
      mPos++;
      return true;
    }

    return false;
  }

  bool skip(String::value_type ch)
  {
    bool skipped = false;
    while ((skipped = skipOne(ch)));
    return skipped;
  }
};
