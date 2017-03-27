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

#include "ElemHideBase.h"
#include "../StringScanner.h"

namespace
{
  void NormalizeWhitespace(DependentString& text, String::size_type& domainsEnd,
      String::size_type& selectorStart)
  {
    // For element hiding filters we only want to remove spaces preceding the
    // selector part. The positions we've determined already have to be adjusted
    // accordingly.

    String::size_type delta = 0;
    String::size_type len = text.length();

    // The first character is guaranteed to be a non-space, the string has been
    // trimmed earlier.
    for (String::size_type pos = 1; pos < len; pos++)
    {
      if (pos == domainsEnd)
        domainsEnd -= delta;

      // Only spaces before selectorStart position should be removed.
      if (pos < selectorStart && text[pos] == ' ')
        delta++;
      else
        text[pos - delta] = text[pos];
    }
    selectorStart -= delta;

    text.reset(text, 0, len - delta);
  }
}

ElemHideBase::ElemHideBase(Type type, const String& text, const ElemHideData& data)
    : ActiveFilter(type, text, false), mData(data)
{
  if (mData.HasDomains())
    ParseDomains(mData.GetDomainsSource(mText), u',');
}

Filter::Type ElemHideBase::Parse(DependentString& text, ElemHideData& data)
{
  StringScanner scanner(text);

  // Domains part
  bool seenSpaces = false;
  while (!scanner.done())
  {
    String::value_type next = scanner.next();
    if (next == u'#')
    {
      data.mDomainsEnd = scanner.position();
      break;
    }

    switch (next)
    {
      case u'/':
      case u'*':
      case u'|':
      case u'@':
      case u'"':
      case u'!':
        return Type::UNKNOWN;
      case u' ':
        seenSpaces = true;
        break;
    }
  }

  seenSpaces |= scanner.skip(u' ');
  bool exception = scanner.skipOne(u'@');
  if (exception)
    seenSpaces |= scanner.skip(u' ');

  String::value_type next = scanner.next();
  if (next != u'#')
    return Type::UNKNOWN;

  // Selector part

  // Selector shouldn't be empty
  seenSpaces |= scanner.skip(u' ');
  if (scanner.done())
    return Type::UNKNOWN;

  data.mSelectorStart = scanner.position() + 1;
  while (!scanner.done())
  {
    switch (scanner.next())
    {
      case u'{':
      case u'}':
        return Type::UNKNOWN;
    }
  }

  // We are done validating, now we can normalize whitespace and the domain part
  if (seenSpaces)
    NormalizeWhitespace(text, data.mDomainsEnd, data.mSelectorStart);
  DependentString(text, 0, data.mDomainsEnd).toLower();

  if (exception)
    return Type::ELEMHIDEEXCEPTION;

  if (text.find(u"[-abp-properties="_str, data.mSelectorStart) != text.npos)
    return Type::ELEMHIDEEMULATION;

  return Type::ELEMHIDE;
}

OwnedString ElemHideBase::GetSelectorDomain() const
{
  /* TODO this is inefficient */
  OwnedString result;
  if (mDomains)
  {
    for (auto it = mDomains->begin(); it != mDomains->end(); ++it)
    {
      if (it->second && !it->first.empty())
      {
        if (!result.empty())
          result.append(u',');
        result.append(it->first);
      }
    }
  }
  return result;
}
