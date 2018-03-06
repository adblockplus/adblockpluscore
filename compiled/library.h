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

#include <cstdint>

#include "base.h"

ABP_NS_BEGIN

class String;
class Filter;
class Subscription;
typedef uint32_t RegExpID;

namespace FilterNotifier
{
  enum class Topic;
}

ABP_NS_END

extern "C"
{
  void LogString(const ABP_NS::String& str);
  void LogInteger(int i);
  void LogPointer(const void* ptr);
  void LogError(const ABP_NS::String& str);
  char16_t CharToLower(char16_t charCode);
  void JSNotifyFilterChange(ABP_NS::FilterNotifier::Topic topic, ABP_NS::Filter& filter,
      ABP_NS::Subscription* subscription, unsigned int position);
  void JSNotifySubscriptionChange(ABP_NS::FilterNotifier::Topic topic,
      ABP_NS::Subscription& subscription);
  RegExpID GenerateRegExp(const ABP_NS::String& regexp, bool matchCase);
  void DeleteRegExp(RegExpID id);
  bool TestRegExp(RegExpID id, const ABP_NS::String& str);
}
