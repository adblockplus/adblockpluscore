#pragma once

#include <cstddef>

#include "ActiveFilter.h"

struct ElemHideBaseData
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

struct ElemHideData;

class ElemHideBase : public ActiveFilter
{
protected:
  ElemHideBaseData mData;
public:
  explicit ElemHideBase(Type type, const String& text, const ElemHideBaseData& data);
  static Type Parse(DependentString& text, ElemHideData& data);

  EMSCRIPTEN_KEEPALIVE const DependentString GetSelector() const
  {
    return mData.GetSelector(mText);
  }

  EMSCRIPTEN_KEEPALIVE OwnedString GetSelectorDomain() const;
};
