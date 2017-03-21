#include "Filter.h"
#include "CommentFilter.h"
#include "InvalidFilter.h"
#include "RegExpFilter.h"
#include "BlockingFilter.h"
#include "WhitelistFilter.h"
#include "ElemHideBase.h"
#include "ElemHideFilter.h"
#include "ElemHideException.h"
#include "CSSPropertyFilter.h"
#include "StringMap.h"

namespace
{
  StringMap<Filter*> knownFilters(8192);

  void NormalizeWhitespace(DependentString& text)
  {
    String::size_type start = 0;
    String::size_type end = text.length();

    // Remove leading spaces and special characters like line breaks
    for (; start < end; start++)
      if (text[start] > ' ')
        break;

    // Now look for invalid characters inside the string
    String::size_type pos;
    for (pos = start; pos < end; pos++)
      if (text[pos] < ' ')
        break;

    if (pos < end)
    {
      // Found invalid characters, copy all the valid characters while skipping
      // the invalid ones.
      String::size_type delta = 1;
      for (pos = pos + 1; pos < end; pos++)
      {
        if (text[pos] < ' ')
          delta++;
        else
          text[pos - delta] = text[pos];
      }
      end -= delta;
    }

    // Remove trailing spaces
    for (; end > 0; end--)
      if (text[end - 1] != ' ')
        break;

    // Set new string boundaries
    text.reset(text, start, end - start);
  }
}

Filter::Filter(Type type, const String& text)
    : mType(type), mText(text)
{
  annotate_address(this, "Filter");
}

Filter::~Filter()
{
  knownFilters.erase(mText);
}

OwnedString Filter::Serialize() const
{
  OwnedString result(u"[Filter]\ntext="_str);
  result.append(mText);
  result.append(u'\n');
  return result;
}

Filter* Filter::FromText(DependentString& text)
{
  NormalizeWhitespace(text);
  if (text.empty())
    return nullptr;

  // Parsing also normalizes the filter text, so it has to be done before the
  // lookup in knownFilters.
  union
  {
    RegExpFilterData regexp;
    ElemHideData elemhide;
  } data;
  DependentString error;

  Filter::Type type = CommentFilter::Parse(text);
  if (type == Filter::Type::UNKNOWN)
    type = ElemHideBase::Parse(text, data.elemhide);
  if (type == Filter::Type::UNKNOWN)
    type = RegExpFilter::Parse(text, error, data.regexp);

  auto knownFilter = knownFilters.find(text);
  if (knownFilter)
  {
    knownFilter->second->AddRef();
    return knownFilter->second;
  }

  FilterPtr filter;
  switch (type)
  {
    case Filter::Type::COMMENT:
      filter = new CommentFilter(text);
      break;
    case Filter::Type::INVALID:
      filter = new InvalidFilter(text, error);
      break;
    case Filter::Type::BLOCKING:
      filter = new BlockingFilter(text, data.regexp);
      break;
    case Filter::Type::WHITELIST:
      filter = new WhitelistFilter(text, data.regexp);
      break;
    case Filter::Type::ELEMHIDE:
      filter = new ElemHideFilter(text, data.elemhide);
      break;
    case Filter::Type::ELEMHIDEEXCEPTION:
      filter = new ElemHideException(text, data.elemhide);
      break;
    case Filter::Type::CSSPROPERTY:
      filter = new CSSPropertyFilter(text, data.elemhide);
      if (static_cast<CSSPropertyFilter*>(filter.get())->IsGeneric())
        filter = new InvalidFilter(text, u"filter_cssproperty_nodomain"_str);
      break;
    default:
      // This should never happen but just in case
      return nullptr;
  }

  // This is a hack: we looked up the entry using text but create it using
  // filter->mText. This works because both are equal at this point. However,
  // text refers to a temporary buffer which will go away.
  enter_context("Adding to known filters");
  knownFilter.assign(filter->mText, filter.get());
  exit_context();

  return filter.release();
}
