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

#include <cctype>
#include <climits>
#include <cstdio>
#include <string>

#include <emscripten.h>

#include "RegExpFilter.h"
#include "../StringScanner.h"
#include "../StringMap.h"

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
    {u"other"_str, TYPE_OTHER},
    {u"script"_str, TYPE_SCRIPT},
    {u"image"_str, TYPE_IMAGE},
    {u"stylesheet"_str, TYPE_STYLESHEET},
    {u"object"_str, TYPE_OBJECT},
    {u"subdocument"_str, TYPE_SUBDOCUMENT},
    {u"document"_str, TYPE_DOCUMENT},
    {u"websocket"_str, TYPE_WEBSOCKET},
    {u"webrtc"_str, TYPE_WEBRTC},
    {u"xbl"_str, TYPE_OTHER},          // Backwards compat
    {u"ping"_str, TYPE_PING},
    {u"xmlhttprequest"_str, TYPE_XMLHTTPREQUEST},
    {u"object-subrequest"_str, TYPE_OBJECT_SUBREQUEST},
    {u"dtd"_str, TYPE_OTHER},          // Backwards compat
    {u"media"_str, TYPE_MEDIA},
    {u"font"_str, TYPE_FONT},
    {u"background"_str, TYPE_IMAGE},   // Backwards compat

    {u"popup"_str, TYPE_POPUP},
    {u"genericblock"_str, TYPE_GENERICBLOCK},
    {u"generichide"_str, TYPE_GENERICHIDE},
    {u"elemhide"_str, TYPE_ELEMHIDE},
  };

  const int defaultTypeMask = INT_MAX & ~(TYPE_DOCUMENT | TYPE_ELEMHIDE |
      TYPE_POPUP | TYPE_GENERICBLOCK | TYPE_GENERICHIDE);

  OwnedString RegExpFromSource(const String& source)
  {
    /* TODO: this is very inefficient */

    // Note: This doesn't remove trailing wildcards, otherwise the result should
    // be identical to Filter.toRegExp().
    OwnedString result;
    String::value_type prevChar = u'*';
    for (String::size_type i = 0; i < source.length(); ++i)
    {
      String::value_type currChar = source[i];
      switch (currChar)
      {
        case u'*':
          if (prevChar != u'*')
            result.append(u".*"_str);
          break;
        case u'^':
          result.append(u"(?:[\\x00-\\x24\\x26-\\x2C\\x2F\\x3A-\\x40\\x5B-\\x5E\\x60\\x7B-\\x7F]|$)"_str);
          break;
        case u'|':
          if (i == 0)
          {
            // Anchor at expression start, maybe extended anchor?
            if (i + 1 < source.length() && source[i + 1] == u'|')
            {
              result.append(u"^[\\w\\-]+:\\/+(?!\\/)(?:[^\\/]+\\.)?"_str);
              ++i;
            }
            else
              result.append(u'^');
          }
          else if (i == source.length() - 1)
          {
            // Anchor at expression end, ignore if following separator placeholder
            if (prevChar != u'^')
              result.append(u'$');
          }
          else
          {
            // Not actually an anchor, escape it
            result.append(u"\\|"_str);
          }
          break;
        default:
          if (!(currChar >= u'a' && currChar <= u'z') &&
              !(currChar >= u'A' && currChar <= u'Z') &&
              !(currChar >= u'0' && currChar <= u'9') &&
              currChar < 128)
          {
            result.append(u'\\');
          }
          result.append(currChar);
      }
      prevChar = currChar;
    }
    return result;
  }

  int GenerateRegExp(const String& regexp, bool matchCase)
  {
    return EM_ASM_INT(return regexps.create($0, $1), &regexp, matchCase);
  }

  void NormalizeWhitespace(DependentString& text)
  {
    // We want to remove all spaces but bail out early in the common scenario
    // that the string contains no spaces.

    // Look for the first space
    String::size_type len = text.length();
    String::size_type pos;
    for (pos = 0; pos < len; pos++)
      if (text[pos] == ' ')
        break;

    if (pos >= len)
      return;

    // Found spaces, move characters to remove them
    String::size_type delta = 1;
    for (pos = pos + 1; pos < len; pos++)
    {
      if (text[pos] == ' ')
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
    if (text[optionStart] == u'~')
    {
      reverse = true;
      optionStart++;
    }

    DependentString name(text, optionStart, optionEnd - optionStart);
    for (size_t i = 0; i < name.length(); ++i)
    {
      char16_t currChar = name[i];
      if (currChar >= u'A' && currChar <= u'Z')
        name[i] = currChar + u'a' - u'A';
      else if (currChar == u'_')
        name[i] = u'-';
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
    else if (name.equals(u"domain"_str))
    {
      if (valueStart >= 0 && valueEnd > valueStart)
      {
        data.mDomainsStart = valueStart;
        data.mDomainsEnd = valueEnd;
        DependentString(text, valueStart, valueEnd - valueStart).toLower();
      }
    }
    else if (name.equals(u"sitekey"_str))
    {
      if (valueStart >= 0 && valueEnd > valueStart)
      {
        data.mSitekeysStart = valueStart;
        data.mSitekeysEnd = valueEnd;
      }
    }
    else if (name.equals(u"match-case"_str))
      data.mMatchCase = !reverse;
    else if (name.equals(u"third-party"_str))
      data.mThirdParty = reverse ? TrippleState::NO : TrippleState::YES;
    else if (name.equals(u"collapse"_str))
      data.mCollapse = reverse ? TrippleState::NO : TrippleState::YES;
    else
      error.reset(u"filter_unknown_option"_str);
  }

  void ParseOptions(String& text, DependentString& error, RegExpFilterData& data,
      String::size_type optionsStart)
  {
    data.mMatchCase = false;
    data.mThirdParty = TrippleState::ANY;
    data.mCollapse = TrippleState::ANY;
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

    StringScanner scanner(text, optionStart, u',');
    bool done = false;
    while (!done)
    {
      done = scanner.done();
      switch (scanner.next())
      {
        case u'=':
          if (optionEnd < 0)
          {
            optionEnd = scanner.position();
            valueStart = optionEnd + 1;
          }
          break;
        case u',':
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
    EM_ASM_ARGS(regexps.delete($0), mData.mRegexpId);
}

Filter::Type RegExpFilter::Parse(DependentString& text, DependentString& error,
    RegExpFilterData& data)
{
  NormalizeWhitespace(text);

  Filter::Type type = Type::BLOCKING;

  data.mPatternStart = 0;
  if (text.length() >= 2 && text[0] == u'@' && text[1] == u'@')
  {
    type = Type::WHITELIST;
    data.mPatternStart = 2;
  }

  data.mPatternEnd = text.find(u'$', data.mPatternStart);
  if (data.mPatternEnd == text.npos)
    data.mPatternEnd = text.length();

  ParseOptions(text, error, data, data.mPatternEnd + 1);
  if (!error.empty())
    return Type::INVALID;

  if (data.mPatternEnd - data.mPatternStart >= 2 &&
      text[data.mPatternStart] == u'/' &&
      text[data.mPatternEnd - 1] == u'/')
  {
    data.SetRegExp(GenerateRegExp(DependentString(text, data.mPatternStart + 1,
        data.mPatternEnd - data.mPatternStart - 2), data.mMatchCase));
    if (data.mRegexpId == -1)
    {
      error.reset(u"filter_invalid_regexp"_str);
      return Type::INVALID;
    }
  }

  return type;
}

void RegExpFilter::ParseSitekeys(const String& sitekeys) const
{
  StringScanner scanner(sitekeys, 0, u'|');
  size_t start = 0;
  bool done = false;
  while (!done)
  {
    done = scanner.done();
    if (scanner.next() == u'|')
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
    for (int i = 0; i < item.first.length(); i++)
      type[i] = (item.first[i] == '-' ? '_' : toupper(item.first[i]));
    printf("  %s: %i,\n", type.c_str(), item.second);
  }
  printf("};\n");
}

RegExpFilter::DomainMap* RegExpFilter::GetDomains() const
{
  if (!mData.DomainsParsingDone())
  {
    ParseDomains(mData.GetDomainsSource(mText), u'|');
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
  return EM_ASM_INT(return regexps.test($0, $1), mData.mRegexpId, &location);
}
