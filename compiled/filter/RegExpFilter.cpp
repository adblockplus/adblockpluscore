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

#include <cctype>
#include <climits>
#include <cstdio>
#include <string>

#include "RegExpFilter.h"
#include "../library.h"
#include "../StringScanner.h"
#include "../StringMap.h"

ABP_NS_USING

namespace
{
  enum
  {
    TYPE_OTHER = 0x1,
    TYPE_SCRIPT = 0x2,
    TYPE_IMAGE = 0x4,
    TYPE_STYLESHEET = 0x8,
    TYPE_OBJECT = 0x10,
    TYPE_SUBDOCUMENT = 0x20,
    TYPE_DOCUMENT = 0x40,
    TYPE_WEBSOCKET = 0x80,
    TYPE_WEBRTC = 0x100,
    TYPE_PING = 0x400,
    TYPE_XMLHTTPREQUEST = 0x800,
    TYPE_OBJECT_SUBREQUEST = 0x1000,
    TYPE_MEDIA = 0x4000,
    TYPE_FONT = 0x8000,
    TYPE_POPUP = 0x8000000,
    TYPE_GENERICBLOCK = 0x10000000,
    TYPE_GENERICHIDE = 0x20000000,
    TYPE_ELEMHIDE = 0x40000000,
  };

  const StringMap<int> typeMap {
    {ABP_TEXT("other"_str), TYPE_OTHER},
    {ABP_TEXT("script"_str), TYPE_SCRIPT},
    {ABP_TEXT("image"_str), TYPE_IMAGE},
    {ABP_TEXT("stylesheet"_str), TYPE_STYLESHEET},
    {ABP_TEXT("object"_str), TYPE_OBJECT},
    {ABP_TEXT("subdocument"_str), TYPE_SUBDOCUMENT},
    {ABP_TEXT("document"_str), TYPE_DOCUMENT},
    {ABP_TEXT("websocket"_str), TYPE_WEBSOCKET},
    {ABP_TEXT("webrtc"_str), TYPE_WEBRTC},
    {ABP_TEXT("xbl"_str), TYPE_OTHER},          // Backwards compat
    {ABP_TEXT("ping"_str), TYPE_PING},
    {ABP_TEXT("xmlhttprequest"_str), TYPE_XMLHTTPREQUEST},
    {ABP_TEXT("object-subrequest"_str), TYPE_OBJECT_SUBREQUEST},
    {ABP_TEXT("dtd"_str), TYPE_OTHER},          // Backwards compat
    {ABP_TEXT("media"_str), TYPE_MEDIA},
    {ABP_TEXT("font"_str), TYPE_FONT},
    {ABP_TEXT("background"_str), TYPE_IMAGE},   // Backwards compat

    {ABP_TEXT("popup"_str), TYPE_POPUP},
    {ABP_TEXT("genericblock"_str), TYPE_GENERICBLOCK},
    {ABP_TEXT("generichide"_str), TYPE_GENERICHIDE},
    {ABP_TEXT("elemhide"_str), TYPE_ELEMHIDE},
  };

  const int defaultTypeMask = INT_MAX & ~(TYPE_DOCUMENT | TYPE_ELEMHIDE |
      TYPE_POPUP | TYPE_GENERICBLOCK | TYPE_GENERICHIDE);

  OwnedString RegExpFromSource(const String& source)
  {
    /* TODO: this is very inefficient */

    // Note: This doesn't remove trailing wildcards, otherwise the result should
    // be identical to Filter.toRegExp().
    OwnedString result;
    String::value_type prevChar = ABP_TEXT('*');
    for (String::size_type i = 0; i < source.length(); ++i)
    {
      String::value_type currChar = source[i];
      switch (currChar)
      {
        case ABP_TEXT('*'):
          if (prevChar != ABP_TEXT('*'))
            result.append(ABP_TEXT(".*"_str));
          break;
        case ABP_TEXT('^'):
          result.append(ABP_TEXT("(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)"_str));
          break;
        case ABP_TEXT('|'):
          if (i == 0)
          {
            // Anchor at expression start, maybe extended anchor?
            if (i + 1 < source.length() && source[i + 1] == ABP_TEXT('|'))
            {
              result.append(ABP_TEXT("^[\\w\\-]+:\\/+(?!\\/)(?:[^\\/]+\\.)?"_str));
              ++i;
            }
            else
              result.append(ABP_TEXT('^'));
          }
          else if (i == source.length() - 1)
          {
            // Anchor at expression end, ignore if following separator placeholder
            if (prevChar != ABP_TEXT('^'))
              result.append(ABP_TEXT('$'));
          }
          else
          {
            // Not actually an anchor, escape it
            result.append(ABP_TEXT("\\|"_str));
          }
          break;
        default:
          if (!(currChar >= ABP_TEXT('a') && currChar <= ABP_TEXT('z')) &&
              !(currChar >= ABP_TEXT('A') && currChar <= ABP_TEXT('Z')) &&
              !(currChar >= ABP_TEXT('0') && currChar <= ABP_TEXT('9')) &&
              currChar < 128)
          {
            result.append(ABP_TEXT('\\'));
          }
          result.append(currChar);
      }
      prevChar = currChar;
    }
    return result;
  }

  void NormalizeWhitespace(DependentString& text)
  {
    // We want to remove all spaces but bail out early in the common scenario
    // that the string contains no spaces.

    // Look for the first space
    String::size_type len = text.length();
    String::size_type pos;
    for (pos = 0; pos < len; pos++)
      if (text[pos] == ABP_TEXT(' '))
        break;

    if (pos >= len)
      return;

    // Found spaces, move characters to remove them
    String::size_type delta = 1;
    for (pos = pos + 1; pos < len; pos++)
    {
      if (text[pos] == ABP_TEXT(' '))
        delta++;
      else
        text[pos - delta] = text[pos];
    }
    text.reset(text, 0, len - delta);
  }

  void ParseOption(String& text, DependentString& error, RegExpFilterData& data,
      int optionStart, int optionEnd, int valueStart, int valueEnd)
  {
    if (optionEnd <= optionStart)
      return;

    bool reverse = false;
    if (text[optionStart] == ABP_TEXT('~'))
    {
      reverse = true;
      optionStart++;
    }

    DependentString name(text, optionStart, optionEnd - optionStart);
    for (size_t i = 0; i < name.length(); ++i)
    {
      char16_t currChar = name[i];
      if (currChar >= ABP_TEXT('A') && currChar <= ABP_TEXT('Z'))
        name[i] = currChar + ABP_TEXT('a') - ABP_TEXT('A');
      else if (currChar == ABP_TEXT('_'))
        name[i] = ABP_TEXT('-');
    }

    auto it = typeMap.find(name);
    if (it)
    {
      if (data.mContentType < 0)
        data.mContentType = reverse ? defaultTypeMask : 0;
      if (reverse)
        data.mContentType &= ~it->second;
      else
        data.mContentType |= it->second;
    }
    else if (name.equals(ABP_TEXT("domain"_str)))
    {
      if (valueStart >= 0 && valueEnd > valueStart)
      {
        data.mDomainsStart = valueStart;
        data.mDomainsEnd = valueEnd;
        DependentString(text, valueStart, valueEnd - valueStart).toLower();
      }
    }
    else if (name.equals(ABP_TEXT("sitekey"_str)))
    {
      if (valueStart >= 0 && valueEnd > valueStart)
      {
        data.mSitekeysStart = valueStart;
        data.mSitekeysEnd = valueEnd;
      }
    }
    else if (name.equals(ABP_TEXT("match-case"_str)))
      data.mMatchCase = !reverse;
    else if (name.equals(ABP_TEXT("third-party"_str)))
      data.mThirdParty = reverse ? TrippleState::NO : TrippleState::YES;
    else if (name.equals(ABP_TEXT("collapse"_str)))
      data.mCollapse = !reverse;
    else
      error.reset(ABP_TEXT("filter_unknown_option"_str));
  }

  void ParseOptions(String& text, DependentString& error, RegExpFilterData& data,
      String::size_type optionsStart)
  {
    data.mMatchCase = false;
    data.mThirdParty = TrippleState::ANY;
    data.mCollapse = true;
    data.mDomainsStart = String::npos;
    data.mSitekeysStart = String::npos;
    if (optionsStart >= text.length())
    {
      data.mContentType = defaultTypeMask;
      return;
    }

    data.mContentType = -1;

    int optionStart = data.mPatternEnd + 1;
    int optionEnd = -1;
    int valueStart = -1;

    StringScanner scanner(text, optionStart, ABP_TEXT(','));
    bool done = false;
    while (!done)
    {
      done = scanner.done();
      switch (scanner.next())
      {
        case ABP_TEXT('='):
          if (optionEnd < 0)
          {
            optionEnd = scanner.position();
            valueStart = optionEnd + 1;
          }
          break;
        case ABP_TEXT(','):
          if (optionEnd < 0)
            optionEnd = scanner.position();
          ParseOption(text, error, data, optionStart, optionEnd, valueStart,
              scanner.position());
          if (!error.empty())
            return;

          optionStart = scanner.position() + 1;
          optionEnd = -1;
          valueStart = -1;
          break;
      }
    }

    if (data.mContentType < 0)
      data.mContentType = defaultTypeMask;
  }
}

RegExpFilter::RegExpFilter(Type type, const String& text, const RegExpFilterData& data)
    : ActiveFilter(type, text, true), mData(data)
{
}

RegExpFilter::~RegExpFilter()
{
  if (mData.HasRegExp())
    DeleteRegExp(mData.mRegexpId);
}

Filter::Type RegExpFilter::Parse(DependentString& text, DependentString& error,
    RegExpFilterData& data)
{
  NormalizeWhitespace(text);

  Filter::Type type = Type::BLOCKING;

  data.mPatternStart = 0;
  if (text.length() >= 2 && text[0] == ABP_TEXT('@') && text[1] == ABP_TEXT('@'))
  {
    type = Type::WHITELIST;
    data.mPatternStart = 2;
  }

  data.mPatternEnd = text.find(ABP_TEXT('$'), data.mPatternStart);
  if (data.mPatternEnd == text.npos)
    data.mPatternEnd = text.length();

  ParseOptions(text, error, data, data.mPatternEnd + 1);
  if (!error.empty())
    return Type::INVALID;

  if (data.mPatternEnd - data.mPatternStart >= 2 &&
      text[data.mPatternStart] == ABP_TEXT('/') &&
      text[data.mPatternEnd - 1] == ABP_TEXT('/'))
  {
    data.SetRegExp(GenerateRegExp(DependentString(text, data.mPatternStart + 1,
        data.mPatternEnd - data.mPatternStart - 2), data.mMatchCase));
    if (data.mRegexpId == -1)
    {
      error.reset(ABP_TEXT("filter_invalid_regexp"_str));
      return Type::INVALID;
    }
  }

  return type;
}

void RegExpFilter::ParseSitekeys(const String& sitekeys) const
{
  StringScanner scanner(sitekeys, 0, ABP_TEXT('|'));
  size_t start = 0;
  bool done = false;
  while (!done)
  {
    done = scanner.done();
    if (scanner.next() == ABP_TEXT('|'))
    {
      if (scanner.position() > start)
        AddSitekey(DependentString(sitekeys, start, scanner.position() - start));
      start = scanner.position() + 1;
    }
  }
}

void RegExpFilter::GenerateCustomBindings()
{
  printf("exports.RegExpFilter.typeMap = {\n");

  for (const auto& item : typeMap)
  {
    std::string type(item.first.length(), '\0');
    for (String::size_type i = 0; i < item.first.length(); i++)
      type[i] = item.first[i] == ABP_TEXT('-') ? '_' : toupper(item.first[i]);
    printf("  %s: %i,\n", type.c_str(), item.second);
  }
  printf("};\n");
}

RegExpFilter::DomainMap* RegExpFilter::GetDomains() const
{
  if (!mData.DomainsParsingDone())
  {
    ParseDomains(mData.GetDomainsSource(mText), ABP_TEXT('|'));
    mData.SetDomainsParsingDone();
  }
  return ActiveFilter::GetDomains();
}

RegExpFilter::SitekeySet* RegExpFilter::GetSitekeys() const
{
  if (!mData.SitekeyParsingDone())
  {
    ParseSitekeys(mData.GetSitekeysSource(mText));
    mData.SetSitekeysParsingDone();
  }
  return ActiveFilter::GetSitekeys();
}

bool RegExpFilter::Matches(const String& location, int typeMask,
    DependentString& docDomain, bool thirdParty, const String& sitekey) const
{
  if (!(mData.mContentType & typeMask) ||
      (mData.mThirdParty == TrippleState::YES && !thirdParty) ||
      (mData.mThirdParty == TrippleState::NO && thirdParty) ||
      !IsActiveOnDomain(docDomain, sitekey))
  {
    return false;
  }

  if (!mData.RegExpParsingDone())
  {
    const OwnedString pattern(mData.GetRegExpSource(mText));
    mData.SetRegExp(GenerateRegExp(RegExpFromSource(pattern), mData.mMatchCase));
  }
  return TestRegExp(mData.mRegexpId, location);
}
