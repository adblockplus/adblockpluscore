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

#include <cstring>

#include "ElemHideBase.h"
#include "../StringScanner.h"
#include "../Utils.h"

ABP_NS_USING

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
      if (pos < selectorStart && text[pos] == ABP_TEXT(' '))
        delta++;
      else
        text[pos - delta] = text[pos];
    }
    selectorStart -= delta;

    text.reset(text, 0, len - delta);
  }

  static constexpr String::value_type ELEM_HIDE_DELIMITER[] = ABP_TEXT("##");
  static constexpr String::size_type ELEM_HIDE_DELIMITER_LEN = str_length_of(ELEM_HIDE_DELIMITER);

  static constexpr String::value_type ELEM_HIDE_EMULATION_DELIMITER[] = ABP_TEXT("#?#");
  static constexpr String::size_type ELEM_HIDE_EMULATION_DELIMITER_LEN = str_length_of(ELEM_HIDE_EMULATION_DELIMITER);

  static constexpr String::value_type OLD_PROPS_SELECTOR[] = ABP_TEXT("[-abp-properties=");
  static constexpr String::size_type OLD_PROPS_SELECTOR_LEN = str_length_of(OLD_PROPS_SELECTOR);

  static constexpr String::value_type PROPS_SELECTOR[] = ABP_TEXT(":-abp-properties(");
  static constexpr String::size_type PROPS_SELECTOR_LEN = str_length_of(PROPS_SELECTOR);
}

ElemHideBase::ElemHideBase(Type type, const String& text, const ElemHideData& data)
    : ActiveFilter(type, text, false), mData(data)
{
  if (mData.HasDomains())
    ParseDomains(mData.GetDomainsSource(mText), ABP_TEXT(','));
}

Filter::Type ElemHideBase::Parse(DependentString& text, ElemHideData& data, bool& needConversion)
{
  needConversion = false;

  StringScanner scanner(text);

  // Domains part
  bool seenSpaces = false;
  while (!scanner.done())
  {
    String::value_type next = scanner.next();
    if (next == ABP_TEXT('#'))
    {
      data.mDomainsEnd = scanner.position();
      break;
    }

    switch (next)
    {
      case ABP_TEXT('/'):
      case ABP_TEXT('*'):
      case ABP_TEXT('|'):
      case ABP_TEXT('@'):
      case ABP_TEXT('"'):
      case ABP_TEXT('!'):
        return Type::UNKNOWN;
      case ABP_TEXT(' '):
        seenSpaces = true;
        break;
    }
  }

  seenSpaces |= scanner.skip(ABP_TEXT(' '));
  bool emulation = false;
  bool exception = scanner.skipOne(ABP_TEXT('@'));
  if (exception)
    seenSpaces |= scanner.skip(ABP_TEXT(' '));
  else
    emulation = scanner.skipOne(ABP_TEXT('?'));

  String::value_type next = scanner.next();
  if (next != ABP_TEXT('#'))
    return Type::UNKNOWN;

  // Selector part

  // Selector shouldn't be empty
  seenSpaces |= scanner.skip(ABP_TEXT(' '));
  if (scanner.done())
    return Type::UNKNOWN;

  data.mSelectorStart = scanner.position() + 1;

  // We are done validating, now we can normalize whitespace and the domain part
  if (seenSpaces)
    NormalizeWhitespace(text, data.mDomainsEnd, data.mSelectorStart);
  DependentString(text, 0, data.mDomainsEnd).toLower();

  // We still need to check the old syntax. It will be converted when
  // we instantiate the filter.
  if (!emulation &&
      text.find(OLD_PROPS_SELECTOR, data.mSelectorStart, OLD_PROPS_SELECTOR_LEN) != text.npos)
  {
    needConversion = true;
    emulation = !exception;
  }

  if (exception)
    return Type::ELEMHIDEEXCEPTION;

  if (emulation)
    return Type::ELEMHIDEEMULATION;

  return Type::ELEMHIDE;
}

namespace
{
  struct Range
  {
    String::size_type start;
    String::size_type end;
    String::size_type len() const
    {
        return end - start;
    }
    String::size_type byte_len() const
    {
      return len() * sizeof(String::value_type);
    }
  };
}

// Convert filter from the old syntax to the new.
DependentString ElemHideBase::ConvertFilter(String& text, String::size_type& at)
{
  Range prefix = {at, text.find(OLD_PROPS_SELECTOR, at, OLD_PROPS_SELECTOR_LEN)};
  if (prefix.end == text.npos)
    return DependentString(text);

  auto length = text.length();
  Range suffix = {at, length};
  Range properties = { prefix.end + OLD_PROPS_SELECTOR_LEN, 0 };
  String::value_type quote = 0;
  for (auto index = properties.start;
       index < length && (suffix.start == at); index++)
  {
    auto c = text[index];
    switch (c)
    {
    case ABP_TEXT('"'):
    case ABP_TEXT('\''):
      if (quote == 0)
      {
        // syntax error: we already have a quoted section.
        if (properties.end)
          return DependentString();

        if (properties.start != index)
          return DependentString();

        quote = c;
        properties.start = index + 1;
      }
      else if (quote == c)
      {
        // end of quoted.
        quote = 0;
        properties.end = index;
      }
      break;
    case ABP_TEXT(']'):
      if (quote == 0)
      {
        if (properties.end == 0)
          return DependentString();
        if (properties.end + 1 != index)
          return DependentString();
        suffix.start = index + 1;
      }
      break;
    default:
      break;
    }
  }

  if (suffix.start == at)
    return DependentString();

  String::size_type delimiter = text.find(ELEM_HIDE_DELIMITER, 0,
                                          ELEM_HIDE_DELIMITER_LEN);
  // +1 for the replacement of "##" by "#?#"
  if (delimiter != text.npos)
    at++;
  auto new_len = at + prefix.len() + PROPS_SELECTOR_LEN + properties.len() + 1 /* ) */ + suffix.len();

  assert2(length == new_len + (delimiter == text.npos ? 2 : 1), ABP_TEXT("Inconsistent length in filter conversion."_str));

  DependentString converted(text, 0, new_len);

  if (suffix.len())
  {
    new_len -= suffix.len();
    std::memmove(converted.data() + new_len,
                 text.data() + suffix.start,
                 suffix.byte_len());
  }
  new_len--;
  // here we need to move the properties before inserting the ')'
  auto parens = new_len;
  if (properties.len())
  {
    new_len -= properties.len();
    std::memmove(converted.data() + new_len,
                 text.data() + properties.start, properties.byte_len());
  }
  converted[parens] = ABP_TEXT(')');

  new_len -= PROPS_SELECTOR_LEN;
  std::memcpy(converted.data() + new_len,
              PROPS_SELECTOR,
              PROPS_SELECTOR_LEN * sizeof(String::value_type));
  if (prefix.len())
  {
    new_len -= prefix.len();
    std::memmove(converted.data() + new_len,
                 text.data() + prefix.start, prefix.byte_len());
  }

  if (delimiter != String::npos)
  {
    std::memcpy(converted.data() + delimiter, ELEM_HIDE_EMULATION_DELIMITER,
                ELEM_HIDE_EMULATION_DELIMITER_LEN * sizeof(String::value_type));
  }

  return converted;
}

namespace
{
  static constexpr String::value_type OPENING_CURLY_REPLACEMENT[] = ABP_TEXT("\\7B ");
  static constexpr String::value_type CLOSING_CURLY_REPLACEMENT[] = ABP_TEXT("\\7D ");
  static constexpr String::size_type CURLY_REPLACEMENT_SIZE = str_length_of(OPENING_CURLY_REPLACEMENT);

  OwnedString EscapeCurlies(String::size_type replacementCount,
                            const DependentString& str)
  {
    OwnedString result(str.length() + replacementCount * (CURLY_REPLACEMENT_SIZE - 1));

    String::value_type* current = result.data();
    for (String::size_type i = 0; i < str.length(); i++)
    {
      switch(str[i])
      {
      case ABP_TEXT('}'):
        std::memcpy(current, CLOSING_CURLY_REPLACEMENT,
                    sizeof(String::value_type) * CURLY_REPLACEMENT_SIZE);
        current += CURLY_REPLACEMENT_SIZE;
        break;
      case ABP_TEXT('{'):
        std::memcpy(current, OPENING_CURLY_REPLACEMENT,
                    sizeof(String::value_type) * CURLY_REPLACEMENT_SIZE);
        current += CURLY_REPLACEMENT_SIZE;
        break;
      default:
        *current = str[i];
        current++;
        break;
      }
    }

    return result;
  }
}

OwnedString ElemHideBase::GetSelector() const
{
  const DependentString selector = mData.GetSelector(mText);
  String::size_type replacementCount = 0;
  for (String::size_type i = 0; i < selector.length(); i++)
    if (selector[i] == ABP_TEXT('}') || selector[i] == ABP_TEXT('{'))
      replacementCount++;
  if (replacementCount)
    return EscapeCurlies(replacementCount, selector);

  return OwnedString(selector);
}

OwnedString ElemHideBase::GetSelectorDomain() const
{
  /* TODO this is inefficient */
  OwnedString result;
  if (mDomains)
  {
    for (const auto& item : *mDomains)
    {
      if (item.second && !item.first.empty())
      {
        if (!result.empty())
          result.append(ABP_TEXT(','));
        result.append(item.first);
      }
    }
  }
  return result;
}
