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

#include "../base.h"
#include "../subscription/Subscription.h"
#include "../bindings/runtime.h"

ABP_NS_BEGIN

class FilterStorage
{
public:
  typedef std::vector<SubscriptionPtr> Subscriptions;

private:
  Subscriptions mSubscriptions;
  static FilterStorage* mInstance;

public:
  static FilterStorage* BINDINGS_EXPORTED GetInstance()
  {
    return mInstance;
  }
  Subscriptions::size_type BINDINGS_EXPORTED GetSubscriptionCount() const;
  Subscription* BINDINGS_EXPORTED SubscriptionAt(
      Subscriptions::size_type index) const;
  int BINDINGS_EXPORTED IndexOfSubscription(
      const Subscription& subscription) const;
  Subscription* BINDINGS_EXPORTED GetSubscriptionForFilter(
      const Filter& filter) const;
  bool BINDINGS_EXPORTED AddSubscription(Subscription& subscription);
  bool BINDINGS_EXPORTED RemoveSubscription(Subscription& subscription);
  bool BINDINGS_EXPORTED MoveSubscription(Subscription& subscription,
      const Subscription* insertBefore);
};

ABP_NS_END