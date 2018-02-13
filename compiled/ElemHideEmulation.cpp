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

#include "ElemHide.h"
#include "ElemHideEmulation.h"

ABP_NS_USING

void ElemHideEmulation::Add(ElemHideBase& filter)
{
  mFilters[filter.GetText()] = ElemHideBasePtr(&filter);
}

void ElemHideEmulation::Remove(ElemHideBase& filter)
{
  mFilters.erase(filter.GetText());
}

void ElemHideEmulation::Clear()
{
  mFilters.clear();
}

ElemHideEmulation_FilterList* ElemHideEmulation::GetRulesForDomain(const ElemHide& elemHide, DependentString& domain)
{
  intrusive_ptr<ElemHideEmulation_FilterList> result(new ElemHideEmulation_FilterList());
  for (const auto& entry: mFilters)
  {
    DependentString docDomain(domain);
    if (entry.second->IsActiveOnDomain(docDomain) &&
        !elemHide.GetException(*entry.second, domain))
      result->push_back(entry.second);
  }

  return result.release();
}
