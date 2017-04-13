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
#include "../intrusive_ptr.h"
#include "../debug.h"

#define SUBSCRIPTION_PROPERTY(type, name, getter, setter) \
    static_assert(std::is_arithmetic<type>::value, "SUBSCRIPTION_PROPERTY macro can only be used with arithmetic types");\
    private:\
      type name;\
    public:\
      type EMSCRIPTEN_KEEPALIVE getter() const\
      {\
        return name;\
      }\
      void EMSCRIPTEN_KEEPALIVE setter(type value)\
      {\
        if (name != value)\
        {\
          type oldvalue = name;\
          name = value;\
          DependentString action(u"subscription."_str #name);\
          if (sizeof(type) <= 4)\
          {\
            EM_ASM_ARGS({\
              var subscription = new (exports[Subscription_mapping[$2]])($1);\
              FilterNotifier.triggerListeners(readString($0), subscription, $3, $4);\
            }, &action, this, mType, value, oldvalue);\
          }\
          else\
          {\
            EM_ASM_ARGS({\
              var subscription = new (exports[Subscription_mapping[$2]])($1);\
              FilterNotifier.triggerListeners(readString($0), subscription, $3, $4);\
            }, &action, this, mType, (double)value, (double)oldvalue);\
          }\
        }\
      }

#define SUBSCRIPTION_STRING_PROPERTY(name, getter, setter) \
    private:\
      OwnedString name;\
    public:\
      const String& EMSCRIPTEN_KEEPALIVE getter() const\
      {\
        return name;\
      }\
      void EMSCRIPTEN_KEEPALIVE setter(const String& value)\
      {\
        if (!name.equals(value))\
        {\
          OwnedString oldvalue(name);\
          name = value;\
          DependentString action(u"subscription."_str #name);\
          EM_ASM_ARGS({\
            var subscription = new (exports[Subscription_mapping[$2]])($1);\
            FilterNotifier.triggerListeners(readString($0), subscription, readString($3), readString($4));\
          }, &action, this, mType, &value, &oldvalue);\
        }\
      }

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

  EMSCRIPTEN_KEEPALIVE const String& GetID() const
  {
    return mID;
  }

  SUBSCRIPTION_STRING_PROPERTY(mTitle, GetTitle, SetTitle);
  SUBSCRIPTION_PROPERTY(bool, mDisabled, GetDisabled, SetDisabled);

  EMSCRIPTEN_KEEPALIVE unsigned GetFilterCount() const
  {
    return mFilters.size();
  }

  EMSCRIPTEN_KEEPALIVE Filter* FilterAt(unsigned index);
  EMSCRIPTEN_KEEPALIVE int IndexOfFilter(Filter* filter);
  EMSCRIPTEN_KEEPALIVE OwnedString Serialize() const;
  EMSCRIPTEN_KEEPALIVE OwnedString SerializeFilters() const;

  static EMSCRIPTEN_KEEPALIVE Subscription* FromID(const String& id);
};

typedef intrusive_ptr<Subscription> SubscriptionPtr;
