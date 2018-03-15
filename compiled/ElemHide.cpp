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

ABP_NS_USING

OwnedString ElemHide_SelectorList::SelectorAt(size_t idx) const
{
  return mSelectors[idx]->GetSelector();
}

const String& ElemHide_SelectorList::FilterKeyAt(size_t idx) const
{
  return mSelectors[idx]->GetText();
}

void ElemHide::Clear()
{
  mFilters.clear();
  mExceptions.clear();
  mFiltersByDomain.clear();
  mKnownExceptions.clear();
}

namespace
{
  const ActiveFilter::DomainMap defaultDomains =
  {
    { ActiveFilter::DEFAULT_DOMAIN, true }
  };
}

void ElemHide::AddToFiltersByDomain(const ElemHideBasePtr& filter)
{
  const auto* domains = filter->GetDomains();
  if (!domains)
    domains = &defaultDomains;

  DependentString text(filter->GetText());
  for (const auto& domain : *domains)
  {
    auto& filters = mFiltersByDomain[domain.first];
    if (domain.second)
      filters[text] = filter;
    else
      filters[text] = ElemHideBasePtr();
  }
}

void ElemHide::Add(ElemHideBase& filter)
{
  // we must ensure we have the right class.
  // This is an error, but we might get Invalid filters.
  if (!filter.As<ElemHideBase>())
    return;

  DependentString text(filter.GetText());
  if (filter.mType == Filter::Type::ELEMHIDEEXCEPTION)
  {
    if (mKnownExceptions.find(text))
      return;

    auto selector = filter.GetSelector();
    mExceptions[selector].emplace_back(filter.As<ElemHideException>());

    // Selector is no longer unconditional
    auto entry = mUnconditionalSelectors.find(selector);
    if (entry && entry->second)
    {
      AddToFiltersByDomain(entry->second);
      mUnconditionalSelectors.erase(selector);
      mUnconditionalSelectorsCache.reset();
    }
    mKnownExceptions.insert(text);
  }
  else
  {
    if (mFilters.find(text))
      return;

    auto selector = filter.GetSelector();
    mFilters[text] = &filter;
    if (!((filter.GetDomains() && filter.GetDomains()->size()) ||
          mExceptions.find(selector)))
    {
      // The new filter's selector is unconditionally applied to all domains
      mUnconditionalSelectors[selector] = ElemHideBasePtr(&filter);
      mUnconditionalSelectorsCache.reset();
    }
    else
      AddToFiltersByDomain(ElemHideBasePtr(&filter));
  }
}

void ElemHide::Remove(ElemHideBase& filter)
{
  DependentString text(filter.GetText());

  auto selector = filter.GetSelector();
  auto exceptionFilter = filter.As<ElemHideException>();
  if (exceptionFilter)
  {
    // never seen the exception.
    if (!mKnownExceptions.find(text))
      return;

    auto& list = mExceptions[selector];
    auto iter = std::find(list.begin(), list.end(),
                          ElemHideExceptionPtr(exceptionFilter));
    if (iter != list.end())
      list.erase(iter);
    mKnownExceptions.erase(text);
  }
  else
  {
    if (!mFilters.find(text))
      return;

    if (mUnconditionalSelectors.find(selector))
    {
      mUnconditionalSelectors.erase(selector);
      mUnconditionalSelectorsCache.reset();
    }
    else
    {
      const auto* domains = filter.GetDomains();
      if (!domains)
        domains = &defaultDomains;

      for (const auto& domain : *domains)
      {
        auto& list = mFiltersByDomain[domain.first];
        list.erase(text);
      }
    }

    mFilters.erase(text);
  }
}

ElemHideException* ElemHide::GetException(const ElemHideBase& filter,
                                          DependentString& docDomain) const
{
  auto exception = mExceptions.find(filter.GetSelector());
  if (!exception)
    return nullptr;

  auto& list = exception->second;
  for (auto iter = list.rbegin(); iter != list.rend(); iter++)
  {
    DependentString domain(docDomain);
    if (*iter && (*iter)->IsActiveOnDomain(domain))
    {
      ElemHideExceptionPtr filter(*iter);
      return filter.release();
    }
  }

  return nullptr;
}

ElemHide_SelectorList* ElemHide::GetUnconditionalSelectors() const
{
  if (!mUnconditionalSelectorsCache)
  {
    mUnconditionalSelectorsCache =
      intrusive_ptr<ElemHide_SelectorList>(new ElemHide_SelectorList(), false);
    annotate_address(mUnconditionalSelectorsCache.get(), "ElemHide_SelectorList");
    for (const auto& unconditional : mUnconditionalSelectors)
    {
      auto entry = mFilters.find(unconditional.second->GetText());
      if (entry)
        mUnconditionalSelectorsCache->push_back(entry->second);
    }
  }
  return intrusive_ptr<ElemHide_SelectorList>(mUnconditionalSelectorsCache).release();
}

ElemHide_SelectorList* ElemHide::GetSelectorsForDomain(const String& domain,
  Criteria criteria) const
{
  intrusive_ptr<ElemHide_SelectorList> selectors(new ElemHide_SelectorList(), false);
  annotate_address(selectors.get(), "ElemHide_SelectorList");

  if (criteria < NO_UNCONDITIONAL)
  {
    intrusive_ptr<ElemHide_SelectorList> selector(GetUnconditionalSelectors(), false);
    selectors->append(*selector);
  }

  bool specificOnly = criteria >= SPECIFIC_ONLY;
  StringSet seenFilters;
  DependentString docDomain(domain);

  DependentString currentDomain(domain);
  while (true)
  {
    if (specificOnly && currentDomain.empty())
      break;

    auto filters = mFiltersByDomain.find(currentDomain);
    if (filters)
    {
      for (const auto& entry : filters->second)
      {
        if (seenFilters.find(entry.first))
          continue;
        seenFilters.insert(entry.first);

        auto filter = entry.second;
        if (filter && !GetException(*filter, docDomain))
          selectors->push_back(filter);
      }
    }

    if (currentDomain.empty())
      break;

    auto nextDot = currentDomain.find(ABP_TEXT('.'));
    currentDomain = nextDot == String::npos ?
      ABP_TEXT(""_str) : DependentString(currentDomain, nextDot + 1);
  }

  return selectors.release();
}
