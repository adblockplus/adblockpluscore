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
#include "Subscription.h"
#include "../filter/Filter.h"
#include "../bindings/runtime.h"

ABP_NS_BEGIN

class UserDefinedSubscription : public Subscription
{
private:
  int mDefaults;

public:
  static constexpr Type classType = Type::USERDEFINED;
  explicit UserDefinedSubscription(const String& id);
  bool BINDINGS_EXPORTED IsDefaultFor(const Filter& filter) const;
  void BINDINGS_EXPORTED MakeDefaultFor(const Filter& filter);
  bool BINDINGS_EXPORTED IsGeneric() const
  {
    return mDefaults == 0;
  }
  void BINDINGS_EXPORTED InsertFilterAt(Filter& filter, unsigned pos);
  bool BINDINGS_EXPORTED RemoveFilterAt(unsigned pos);
  OwnedString BINDINGS_EXPORTED Serialize() const;
};

typedef intrusive_ptr<UserDefinedSubscription> UserDefinedSubscriptionPtr;

ABP_NS_END