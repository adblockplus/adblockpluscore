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

#pragma once

#include "base.h"
#include "String.h"

ABP_NS_BEGIN

class StringScanner
{
private:
  const DependentString mStr;
  String::size_type mPos;
  String::size_type mEnd;
  String::value_type mTerminator;
public:
  explicit StringScanner(const String& str, String::size_type pos = 0,
        String::value_type terminator = ABP_TEXT('\0'))
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

ABP_NS_END