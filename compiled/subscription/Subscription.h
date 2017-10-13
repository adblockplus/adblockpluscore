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
                *this);\
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
public:
  typedef std::vector<FilterPtr> Filters;

protected:
  OwnedString mID;
  Filters mFilters;

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

  const BINDINGS_EXPORTED String& GetID() const
  {
    return mID;
  }

  SUBSCRIPTION_STRING_PROPERTY(mTitle, SUBSCRIPTION_TITLE, GetTitle, SetTitle);
  SUBSCRIPTION_PROPERTY(bool, mDisabled, SUBSCRIPTION_DISABLED,
        GetDisabled, SetDisabled);
  SUBSCRIPTION_PROPERTY(bool, mListed, NONE, GetListed, SetListed);

  Filters::size_type BINDINGS_EXPORTED GetFilterCount() const
  {
    return mFilters.size();
  }

  Filter* BINDINGS_EXPORTED FilterAt(Filters::size_type index);
  int BINDINGS_EXPORTED IndexOfFilter(const Filter& filter);
  OwnedString BINDINGS_EXPORTED Serialize() const;
  OwnedString BINDINGS_EXPORTED SerializeFilters() const;

  static Subscription* BINDINGS_EXPORTED FromID(const String& id);

  template<typename T>
  T* As()
  {
    if (mType != T::classType)
      return nullptr;

    return static_cast<T*>(this);
  }

  template<typename T>
  const T* As() const
  {
    if (mType != T::classType)
      return nullptr;

    return static_cast<const T*>(this);
  }
};

typedef intrusive_ptr<Subscription> SubscriptionPtr;
