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

#include "String.h"

ABP_NS_BEGIN

DependentString TrimSpaces(const String& value)
{
  String::size_type start = 0;
  auto end = value.length();
  for (; start < end; ++start)
  {
    if (value[start] > u' ')
      break;
  }
  for (; end > start; --end)
  {
    if (value[end - 1] > u' ')
      break;
  }
  return DependentString(value, start, end - start);
}

std::pair<DependentString, DependentString> SplitString(const String& value, String::size_type separatorPos)
{
  const auto secondBeginPos = separatorPos < String::npos ? separatorPos + 1 : String::npos;
  return {
    DependentString{value, 0, separatorPos},
    DependentString{value, secondBeginPos, value.length() - secondBeginPos}
  };
}

ABP_NS_END
