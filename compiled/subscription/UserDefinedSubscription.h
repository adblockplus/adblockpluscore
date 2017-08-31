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

#include "Subscription.h"
#include "../filter/Filter.h"
#include "../bindings/runtime.h"

class UserDefinedSubscription : public Subscription
{
private:
  int mDefaults;

public:
  explicit UserDefinedSubscription(const String& id);
  BINDINGS_EXPORTED bool IsDefaultFor(const Filter* filter) const;
  BINDINGS_EXPORTED void MakeDefaultFor(const Filter* filter);
  BINDINGS_EXPORTED bool IsGeneric() const
  {
    return mDefaults == 0;
  }
  BINDINGS_EXPORTED void InsertFilterAt(Filter* filter, unsigned pos);
  BINDINGS_EXPORTED bool RemoveFilterAt(unsigned pos);
  BINDINGS_EXPORTED OwnedString Serialize() const;
};

template<>
inline UserDefinedSubscription* Subscription::As<UserDefinedSubscription>()
{
  if (mType != Type::USERDEFINED)
    return nullptr;

  return static_cast<UserDefinedSubscription*>(this);
}
