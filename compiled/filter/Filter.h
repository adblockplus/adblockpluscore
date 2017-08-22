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

#include "../String.h"
#include "../intrusive_ptr.h"
#include "../debug.h"
#include "../bindings/runtime.h"

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
    BLOCKING = 3,
    WHITELIST = 4,
    ELEMHIDE = 5,
    ELEMHIDEEXCEPTION = 6,
    ELEMHIDEEMULATION = 7,
    VALUE_COUNT = 8
  };

  explicit Filter(Type type, const String& text);
  ~Filter();

  Type mType;

  BINDINGS_EXPORTED const String& GetText() const
  {
    return mText;
  }

  BINDINGS_EXPORTED OwnedString Serialize() const;

  static BINDINGS_EXPORTED Filter* FromText(DependentString& text);
};

typedef intrusive_ptr<Filter> FilterPtr;
