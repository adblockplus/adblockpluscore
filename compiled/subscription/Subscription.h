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

#include <type_traits>
#include <vector>

#include "../filter/Filter.h"
#include "../String.h"
#include "../FilterNotifier.h"
#include "../intrusive_ptr.h"
#include "../debug.h"
#include "../bindings/runtime.h"

#define SUBSCRIPTION_PROPERTY_INTERNAL(field_type, param_type, name, topic, getter, setter) \
    private:\
      field_type name;\
    public:\
      param_type BINDINGS_EXPORTED getter() const\
      {\
        return name;\
      }\
      void BINDINGS_EXPORTED setter(param_type value)\
      {\
        if (name != value)\
        {\
          name = value;\
          if (FilterNotifier::Topic::topic != FilterNotifier::Topic::NONE)\
          {\
            FilterNotifier::SubscriptionChange(FilterNotifier::Topic::topic,\
                this);\
          }\
        }\
      }

#define SUBSCRIPTION_PROPERTY(type, name, topic, getter, setter) \
    static_assert(std::is_arithmetic<type>::value, "SUBSCRIPTION_PROPERTY macro can only be used with arithmetic types");\
    SUBSCRIPTION_PROPERTY_INTERNAL(type, type, name, topic, getter, setter)

#define SUBSCRIPTION_STRING_PROPERTY(name, topic, getter, setter) \
    SUBSCRIPTION_PROPERTY_INTERNAL(OwnedString, const String&, name, topic, getter, setter)

class Subscription : public ref_counted
{
protected:
  OwnedString mID;
  std::vector<FilterPtr> mFilters;

public:
  enum Type
  {
    UNKNOWN = 0,
    DOWNLOADABLE = 1,
    USERDEFINED = 2
  };

  explicit Subscription(Type type, const String& id);
  ~Subscription();

  Type mType;

  BINDINGS_EXPORTED const String& GetID() const
  {
    return mID;
  }

  SUBSCRIPTION_STRING_PROPERTY(mTitle, SUBSCRIPTION_TITLE, GetTitle, SetTitle);
  SUBSCRIPTION_PROPERTY(bool, mDisabled, SUBSCRIPTION_DISABLED,
        GetDisabled, SetDisabled);

  BINDINGS_EXPORTED unsigned GetFilterCount() const
  {
    return mFilters.size();
  }

  BINDINGS_EXPORTED Filter* FilterAt(unsigned index);
  BINDINGS_EXPORTED int IndexOfFilter(Filter* filter);
  BINDINGS_EXPORTED OwnedString Serialize() const;
  BINDINGS_EXPORTED OwnedString SerializeFilters() const;

  static BINDINGS_EXPORTED Subscription* FromID(const String& id);
};

typedef intrusive_ptr<Subscription> SubscriptionPtr;
