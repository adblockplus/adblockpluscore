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

#include <cstdlib>

#include "UserDefinedSubscription.h"
#include "../FilterNotifier.h"

ABP_NS_USING

namespace
{
  enum FilterCategory
  {
    NONE = 0,
    WHITELIST = 1,
    BLOCKING = 2,
    ELEMHIDE = 4,
  };

  FilterCategory filterTypeToCategory(Filter::Type type)
  {
    if (type == Filter::Type::BLOCKING)
      return FilterCategory::BLOCKING;
    if (type == Filter::Type::WHITELIST)
      return FilterCategory::WHITELIST;
    if ((type & Filter::Type::ELEMHIDEBASE) == Filter::Type::ELEMHIDEBASE)
      return FilterCategory::ELEMHIDE;

    return FilterCategory::NONE;
  }
}

UserDefinedSubscription::UserDefinedSubscription(const String& id)
    : Subscription(classType, id), mDefaults(0)
{
}

bool UserDefinedSubscription::IsDefaultFor(const Filter& filter) const
{
  return mDefaults & filterTypeToCategory(filter.mType);
}

void UserDefinedSubscription::MakeDefaultFor(const Filter& filter)
{
  mDefaults |= filterTypeToCategory(filter.mType);
}

void UserDefinedSubscription::InsertFilterAt(Filter& filter, unsigned pos)
{
  if (pos >= mFilters.size())
    pos = mFilters.size();
  mFilters.emplace(mFilters.begin() + pos, &filter);

  if (GetListed())
  {
    FilterNotifier::FilterChange(FilterNotifier::Topic::FILTER_ADDED, filter,
        this, pos);
  }
}

bool UserDefinedSubscription::RemoveFilterAt(unsigned pos)
{
  if (pos >= mFilters.size())
    return false;

  FilterPtr filter(mFilters[pos]);
  mFilters.erase(mFilters.begin() + pos);
  if (GetListed())
  {
    FilterNotifier::FilterChange(FilterNotifier::Topic::FILTER_REMOVED,
        *filter.get(), this, pos);
  }
  return true;
}

OwnedString UserDefinedSubscription::Serialize() const
{
  OwnedString result(Subscription::Serialize());
  if (!IsGeneric())
  {
    result.append(u"defaults="_str);
    if (mDefaults & FilterCategory::BLOCKING)
      result.append(u" blocking"_str);
    if (mDefaults & FilterCategory::WHITELIST)
      result.append(u" whitelist"_str);
    if (mDefaults & FilterCategory::ELEMHIDE)
      result.append(u" elemhide"_str);
    result.append(u'\n');
  }
  return result;
}
