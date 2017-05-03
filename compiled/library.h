/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-2017 eyeo GmbH
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

class String;
class Filter;
class Subscription;

namespace FilterNotifier
{
  enum class Topic;
}

extern "C"
{
  void LogString(const String& str);
  void LogInteger(int i);
  void LogPointer(const void* ptr);
  void LogError(const String& str);
  char16_t CharToLower(char16_t charCode);
  void JSNotifyFilterChange(FilterNotifier::Topic topic, Filter* filter);
  void JSNotifySubscriptionChange(FilterNotifier::Topic topic,
      Subscription* subscription);
  int GenerateRegExp(const String& regexp, bool matchCase);
  void DeleteRegExp(int id);
  bool TestRegExp(int id, const String& str);
}
