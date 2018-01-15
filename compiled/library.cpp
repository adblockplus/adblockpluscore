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

#include <cwctype>
#include <mutex>
#include <regex>

#include "String.h"
#include "Utils.h"
#include "debug.h"
#include "library.h"


char16_t CharToLower(char16_t charCode)
{
  return std::towlower(charCode);
}


void JSNotifyFilterChange(FilterNotifier::Topic topic, Filter& filter,
      Subscription* subscription, unsigned int position)
{
}

void JSNotifySubscriptionChange(FilterNotifier::Topic topic,
      Subscription& subscription)
{
}

namespace {
  std::vector<std::unique_ptr<std::wregex>> regexPool;
  std::mutex regexPoolMutex;
}

int GenerateRegExp(const String& regexp, bool matchCase)
{
  std::lock_guard<std::mutex> guard(regexPoolMutex);
  auto index = regexPool.size();
  auto flags = std::regex_constants::ECMAScript;
  if (!matchCase)
    flags |= std::regex_constants::icase;
  regexPool.emplace_back(new std::wregex(StdWStringFromString(regexp), flags));
  return index;
}

void DeleteRegExp(int id)
{
  std::lock_guard<std::mutex> guard(regexPoolMutex);
  if (id < regexPool.size())
    regexPool[id].reset();
}

bool TestRegExp(int id, const String& str)
{
  std::lock_guard<std::mutex> guard(regexPoolMutex);
  if ((id < regexPool.size()) && regexPool[id])
    return std::regex_match(StdWStringFromString(str), *regexPool[id]);

  assert2(id < regexPool.size() && regexPool[id], "Invalid RegExp index.");
  return false;
}

