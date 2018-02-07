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

#include "base.h"
#include "bindings/runtime.h"
#include "intrusive_ptr.h"
#include "filter/ElemHideBase.h"

ABP_NS_BEGIN

class ElemHide;

class ElemHideEmulation_FilterList : public ref_counted
{
  std::vector<ElemHideBasePtr> mFilters;
public:
  size_t BINDINGS_EXPORTED GetFilterCount() const
  {
    return mFilters.size();
  }

  ElemHideBase* BINDINGS_EXPORTED FilterAt(size_t index)
  {
    if (index >= mFilters.size())
      return nullptr;

    ElemHideBasePtr result(mFilters[index]);
    return result.release();
  }

  void push_back(const ElemHideBasePtr& filter)
  {
    mFilters.push_back(filter);
  }

};

class ElemHideEmulation : public ref_counted
{
  StringMap<ElemHideBasePtr> mFilters;

public:
  static ElemHideEmulation* BINDINGS_EXPORTED Create()
  {
    return new ElemHideEmulation();
  }

  void BINDINGS_EXPORTED Add(ElemHideBase&);
  void BINDINGS_EXPORTED Remove(ElemHideBase&);
  void BINDINGS_EXPORTED Clear();
  ElemHideEmulation_FilterList* BINDINGS_EXPORTED GetRulesForDomain(const ElemHide&, DependentString&);
};
ABP_NS_END
