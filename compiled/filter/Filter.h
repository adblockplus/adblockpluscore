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

#include "../base.h"
#include "../String.h"
#include "../intrusive_ptr.h"
#include "../debug.h"
#include "../bindings/runtime.h"

ABP_NS_BEGIN

class Filter : public ref_counted
{
protected:
  OwnedString mText;

public:
  enum Type
  {
    UNKNOWN = 0,
    INVALID = 1,
    COMMENT = 2,
    ACTIVE = 4,
    REGEXP = ACTIVE | 8,
    BLOCKING = REGEXP | 16,
    WHITELIST = REGEXP | 32,
    ELEMHIDEBASE = ACTIVE | 64,
    ELEMHIDE = ELEMHIDEBASE | 128,
    ELEMHIDEEXCEPTION = ELEMHIDEBASE | 256,
    ELEMHIDEEMULATION = ELEMHIDEBASE | 512
  };

  explicit Filter(Type type, const String& text);
  ~Filter();

  Type mType;

  const String& BINDINGS_EXPORTED GetText() const
  {
    return mText;
  }

  OwnedString BINDINGS_EXPORTED Serialize() const;

  static Filter* BINDINGS_EXPORTED FromText(DependentString& text);

  template<typename T>
  T* As()
  {
    if ((mType & T::classType) != T::classType)
      return nullptr;

    return static_cast<T*>(this);
  }

  template<typename T>
  const T* As() const
  {
    if ((mType & T::classType) != T::classType)
      return nullptr;

    return static_cast<const T*>(this);
  }
};

typedef intrusive_ptr<Filter> FilterPtr;

ABP_NS_END