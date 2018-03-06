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

#include <cstdio>

#include "base.h"
#include "library.h"
#include "String.h"

ABP_NS_BEGIN

class Filter;
class Subscription;

namespace FilterNotifier
{
  enum class Topic : int32_t
  {
    NONE,
    FILTER_ADDED,
    FILTER_REMOVED,
    FILTER_DISABLED,
    FILTER_HITCOUNT,
    FILTER_LASTHIT,
    SUBSCRIPTION_ADDED,
    SUBSCRIPTION_REMOVED,
    SUBSCRIPTION_MOVED,
    SUBSCRIPTION_TITLE,
    SUBSCRIPTION_DISABLED,
    SUBSCRIPTION_FIXEDTITLE,
    SUBSCRIPTION_HOMEPAGE,
    SUBSCRIPTION_LASTCHECK,
    SUBSCRIPTION_LASTDOWNLOAD,
    SUBSCRIPTION_DOWNLOADSTATUS,
    SUBSCRIPTION_ERRORS,
  };

  template<typename T>
  inline T lexical_cast(Topic);

  template<>
  inline int32_t lexical_cast<int32_t>(Topic value)
  {
    return static_cast<int32_t>(value);
  }

  namespace GenerateCustomBindings
  {
    inline void printfTopic(const char* format, Topic topic)
    {
      ::printf(format, lexical_cast<int32_t>(topic));
    }

    inline void Generate()
    {
      printf("var FilterNotifier = require('filterNotifier').FilterNotifier;\n");
      printf("var notifierTopics = new Map([\n");
      printfTopic("  [%i, 'filter.added'],\n", Topic::FILTER_ADDED);
      printfTopic("  [%i, 'filter.removed'],\n", Topic::FILTER_REMOVED);
      printfTopic("  [%i, 'filter.disabled'],\n", Topic::FILTER_DISABLED);
      printfTopic("  [%i, 'filter.hitCount'],\n", Topic::FILTER_HITCOUNT);
      printfTopic("  [%i, 'filter.lastHit'],\n", Topic::FILTER_LASTHIT);
      printfTopic("  [%i, 'subscription.added'],\n", Topic::SUBSCRIPTION_ADDED);
      printfTopic("  [%i, 'subscription.removed'],\n", Topic::SUBSCRIPTION_REMOVED);
      printfTopic("  [%i, 'subscription.moved'],\n", Topic::SUBSCRIPTION_MOVED);
      printfTopic("  [%i, 'subscription.title'],\n", Topic::SUBSCRIPTION_TITLE);
      printfTopic("  [%i, 'subscription.disabled'],\n", Topic::SUBSCRIPTION_DISABLED);
      printfTopic("  [%i, 'subscription.fixedTitle'],\n", Topic::SUBSCRIPTION_FIXEDTITLE);
      printfTopic("  [%i, 'subscription.homepage'],\n", Topic::SUBSCRIPTION_HOMEPAGE);
      printfTopic("  [%i, 'subscription.lastCheck'],\n", Topic::SUBSCRIPTION_LASTCHECK);
      printfTopic("  [%i, 'subscription.lastDownload'],\n", Topic::SUBSCRIPTION_LASTDOWNLOAD);
      printfTopic("  [%i, 'subscription.downloadStatus'],\n", Topic::SUBSCRIPTION_DOWNLOADSTATUS);
      printfTopic("  [%i, 'subscription.errors'],\n", Topic::SUBSCRIPTION_ERRORS);
      printf("]);");
    }
  }

  inline void FilterChange(Topic topic, Filter& filter,
      Subscription* subscription = nullptr, unsigned int position = 0)
  {
    JSNotifyFilterChange(topic, filter, subscription, position);
  }

  inline void SubscriptionChange(Topic topic, Subscription& subscription)
  {
    JSNotifySubscriptionChange(topic, subscription);
  }
}

ABP_NS_END
