#include "CSSPropertyFilter.h"
#include "RegExpFilter.h"

CSSPropertyFilter::CSSPropertyFilter(const String& text,
    const ElemHideData& data)
    : ElemHideBase(Type::CSSPROPERTY, text, data), mPropertyData(data)
{
}

OwnedString CSSPropertyFilter::GetRegExpString() const
{
  return RegExpFilter::RegExpFromSource(mPropertyData.GetRegExpSource(mText));
}
