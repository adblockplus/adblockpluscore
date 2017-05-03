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

#include <cstddef>

#include "ActiveFilter.h"
#include "../bindings/runtime.h"

struct ElemHideData
{
  String::size_type mDomainsEnd;
  String::size_type mSelectorStart;

  bool HasDomains() const
  {
    return mDomainsEnd != 0;
  }

  DependentString GetDomainsSource(String& text) const
  {
    return DependentString(text, 0, mDomainsEnd);
  }

  const DependentString GetDomainsSource(const String& text) const
  {
    return DependentString(text, 0, mDomainsEnd);
  }

  DependentString GetSelector(String& text) const
  {
    return DependentString(text, mSelectorStart);
  }

  const DependentString GetSelector(const String& text) const
  {
    return DependentString(text, mSelectorStart);
  }
};

class ElemHideBase : public ActiveFilter
{
protected:
  ElemHideData mData;
public:
  explicit ElemHideBase(Type type, const String& text, const ElemHideData& data);
  static Type Parse(DependentString& text, ElemHideData& data);

  BINDINGS_EXPORTED const DependentString GetSelector() const
  {
    return mData.GetSelector(mText);
  }

  BINDINGS_EXPORTED OwnedString GetSelectorDomain() const;
};
