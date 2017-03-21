#pragma once

#include <cstddef>

#include "Filter.h"
#include "ElemHideBase.h"

struct CSSPropertyFilterData
{
  String::size_type mPrefixEnd;
  String::size_type mRegexpStart;
  String::size_type mRegexpEnd;
  String::size_type mSuffixStart;

  const DependentString GetSelectorPrefix(const String& text,
      String::size_type selectorStart) const
  {
    return DependentString(text, selectorStart, mPrefixEnd - selectorStart);
  }

  const DependentString GetRegExpSource(const String& text) const
  {
    return DependentString(text, mRegexpStart, mRegexpEnd - mRegexpStart);
  }

  const DependentString GetSelectorSuffix(const String& text) const
  {
    return DependentString(text, mSuffixStart);
  }
};

struct ElemHideData : ElemHideBaseData, CSSPropertyFilterData
{
};

class CSSPropertyFilter: public ElemHideBase
{
protected:
  CSSPropertyFilterData mPropertyData;
public:
  explicit CSSPropertyFilter(const String& text, const ElemHideData& data);
  EMSCRIPTEN_KEEPALIVE OwnedString GetRegExpString() const;
  EMSCRIPTEN_KEEPALIVE const DependentString GetSelectorPrefix() const
  {
    return mPropertyData.GetSelectorPrefix(mText, mData.mSelectorStart);
  }
  EMSCRIPTEN_KEEPALIVE const DependentString GetSelectorSuffix() const
  {
    return mPropertyData.GetSelectorSuffix(mText);
  }
};
