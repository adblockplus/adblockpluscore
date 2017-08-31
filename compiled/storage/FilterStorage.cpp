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

#include <vector>

#include "FilterStorage.h"
#include "../filter/Filter.h"
#include "../subscription/UserDefinedSubscription.h"
#include "../FilterNotifier.h"

FilterStorage* FilterStorage::mInstance = new FilterStorage();

FilterStorage::Subscriptions::size_type FilterStorage::GetSubscriptionCount() const
{
  return mSubscriptions.size();
}

Subscription* FilterStorage::SubscriptionAt(FilterStorage::Subscriptions::size_type index) const
{
  if (index >= mSubscriptions.size())
    return nullptr;

  SubscriptionPtr result(mSubscriptions[index]);
  return result.release();
}

int FilterStorage::IndexOfSubscription(const Subscription* subscription) const
{
  for (Subscriptions::size_type i = 0; i < mSubscriptions.size(); i++)
    if (mSubscriptions[i] == subscription)
      return i;
  return -1;
}

Subscription* FilterStorage::GetSubscriptionForFilter(const Filter* filter) const
{
  SubscriptionPtr fallback;

  for (Subscriptions::size_type i = 0; i < mSubscriptions.size(); i++)
  {
    SubscriptionPtr subscription(mSubscriptions[i]);
    UserDefinedSubscription* userDefinedSubscription =
        subscription->As<UserDefinedSubscription>();
    if (userDefinedSubscription && !userDefinedSubscription->GetDisabled() &&
        userDefinedSubscription->IsDefaultFor(filter))
    {
      SubscriptionPtr result(subscription);
      return result.release();
    }
    else if (!fallback && userDefinedSubscription &&
             userDefinedSubscription->IsGeneric())
    {
      fallback = subscription;
    }
  }

  return fallback.release();
}

bool FilterStorage::AddSubscription(Subscription* subscription)
{
  assert(subscription, u"Attempt to add a null subscription"_str);

  if (!subscription || subscription->GetListed())
    return false;

  mSubscriptions.emplace_back(subscription);
  subscription->SetListed(true);

  FilterNotifier::SubscriptionChange(
    FilterNotifier::Topic::SUBSCRIPTION_ADDED,
    subscription
  );
  return true;
}

bool FilterStorage::RemoveSubscription(Subscription* subscription)
{
  assert(subscription, u"Attempt to remove a null subscription"_str);

  if (!subscription || !subscription->GetListed())
    return false;

  for (auto it = mSubscriptions.begin(); it != mSubscriptions.end(); ++it)
  {
    if (*it == subscription)
    {
      mSubscriptions.erase(it);
      break;
    }
  }
  subscription->SetListed(false);

  FilterNotifier::SubscriptionChange(
    FilterNotifier::Topic::SUBSCRIPTION_REMOVED,
    subscription
  );
  return true;
}

bool FilterStorage::MoveSubscription(Subscription* subscription,
                                     const Subscription* insertBefore)
{
  assert(subscription, u"Attempt to move a null subscription"_str);

  int oldPos = IndexOfSubscription(subscription);
  assert(oldPos >= 0, u"Attempt to move a subscription that is not in the list"_str);
  if (oldPos == -1)
    return false;

  int newPos = -1;
  if (insertBefore)
    newPos = IndexOfSubscription(insertBefore);
  if (newPos == -1)
    newPos = mSubscriptions.size();

  if (newPos > oldPos)
    newPos--;

  if (newPos == oldPos)
    return false;

  mSubscriptions.erase(mSubscriptions.begin() + oldPos);
  mSubscriptions.emplace(mSubscriptions.begin() + newPos, subscription);

  FilterNotifier::SubscriptionChange(
    FilterNotifier::Topic::SUBSCRIPTION_MOVED,
    subscription
  );
  return true;
}
