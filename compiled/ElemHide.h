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

/**
 * @fileOverview Element hiding implementation.
 */

#pragma once

#include <vector>

#include "base.h"
#include "bindings/runtime.h"
#include "intrusive_ptr.h"
#include "StringMap.h"
#include "filter/Filter.h"
#include "filter/ElemHideBase.h"
#include "filter/ElemHideException.h"

ABP_NS_BEGIN

class ElemHide_SelectorList : public ref_counted
{
  std::vector<ElemHideBasePtr> mSelectors;
public:
  size_t BINDINGS_EXPORTED GetSelectorCount() const
  {
    return mSelectors.size();
  }
  OwnedString BINDINGS_EXPORTED SelectorAt(size_t idx) const;
  const String& BINDINGS_EXPORTED FilterKeyAt(size_t idx) const;

  void push_back(const ElemHideBasePtr& filter)
  {
    mSelectors.push_back(filter);
  }

  void append(const ElemHide_SelectorList& list)
  {
    mSelectors.insert(mSelectors.end(),
                      list.mSelectors.cbegin(), list.mSelectors.cend());
  }
};

class ElemHide : public ref_counted
{
  // All filters. Key is filter text. Exception filters excluded.
  StringMap<ElemHideBasePtr> mFilters;
  // Filters by domain. Key is domain.
  // In value key is filter text, value is filter or NULL
  OwnedStringMap<OwnedStringMap<ElemHideBasePtr>> mFiltersByDomain;

  // Exceptions. The key is the selector.
  OwnedStringMap<std::vector<ElemHideExceptionPtr>> mExceptions;
  // Known exceptions. Filter text as keys.
  StringSet mKnownExceptions;

  // Unconditional selectors. Filter selector as key. Filter as value.
  OwnedStringMap<ElemHideBasePtr> mUnconditionalSelectors;

  mutable intrusive_ptr<ElemHide_SelectorList> mUnconditionalSelectorsCache;

public:
  static ElemHide* BINDINGS_EXPORTED Create()
  {
    return new ElemHide();
  }
  // Used by GetSelectorsForDomain to narrow down selectors to return.
  // Keep these value up to date in the ElemHide.js import script.
  enum Criteria
  {
    // Return all selectors applying to a particular hostname.
    ALL_MATCHING = 0,
    // Exclude selectors which apply to all websites without exception.
    NO_UNCONDITIONAL = 1,
    // Return only selectors for filters which specifically match the
    // given host name.
    SPECIFIC_ONLY = 2,
  };

  void BINDINGS_EXPORTED Clear();
  void BINDINGS_EXPORTED Add(ElemHideBase& filter);
  void BINDINGS_EXPORTED Remove(ElemHideBase& filter);

  ElemHide_SelectorList* BINDINGS_EXPORTED GetSelectorsForDomain(const String& domain,
                                                                 Criteria criteria) const;
  ElemHide_SelectorList* BINDINGS_EXPORTED GetUnconditionalSelectors() const;

  ElemHideException* GetException(const ElemHideBase& filter,
                                  DependentString& docDomain) const;

private:
  void AddToFiltersByDomain(const ElemHideBasePtr & filter);
};
ABP_NS_END
