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

#include <string>
#include <gtest/gtest.h>
#include "compiled/String.h"

ABP_NS_USING

TEST(TestString, constructInvalidDependentString)
{
  DependentString s;
  EXPECT_TRUE(s.is_invalid());

  DependentString s2(s);
  EXPECT_TRUE(s2.is_invalid());
}

TEST(TestString, constructInvalidOwnedString)
{
  OwnedString s;
  EXPECT_TRUE(s.is_invalid());

  // Valid string
  OwnedString s2(2);
  EXPECT_FALSE(s2.is_invalid());

  // Ensure we still have an invalid string.
  OwnedString s3(s);
  EXPECT_TRUE(s3.is_invalid());

  // Empty valid string lead to valid string.
  OwnedString s4(u""_str);
  EXPECT_FALSE(s4.is_invalid());
}

TEST(TestStringTrimSpaces, zeroLengthString)
{
  EXPECT_EQ(u""_str, TrimSpaces(DependentString()));
  EXPECT_EQ(u""_str, TrimSpaces(OwnedString()));
  EXPECT_EQ(u""_str, TrimSpaces(u""_str));
}

TEST(TestStringTrimSpaces, spacesAreRemoved)
{
  for (uint16_t leftSpaces = 0; leftSpaces < 5; ++leftSpaces)
  {
    for (uint16_t rightSpaces = 0; rightSpaces < 5; ++rightSpaces)
    {
      for (uint16_t nonSpaces = 0; nonSpaces < 5; ++nonSpaces)
      {
        OwnedString str;
        std::string leftSpacesStdString(leftSpaces, ' ');
        str.append(leftSpacesStdString.c_str(), leftSpacesStdString.length());
        std::string stdString(nonSpaces, 'a');
        OwnedString trimmedString;
        trimmedString.append(stdString.c_str(), stdString.length());
        str.append(trimmedString);
        std::string rightSpacesStdString(rightSpaces, ' ');
        str.append(rightSpacesStdString.c_str(), rightSpacesStdString.length());
        EXPECT_EQ(trimmedString, TrimSpaces(str));
      }
    }
  }
}

TEST(TestStringSplitString, test)
{
  {
    auto str = u"123:abc"_str;
    auto split = SplitString(str, 3);
    EXPECT_EQ(u"123"_str, split.first);
    EXPECT_EQ(u"abc"_str, split.second);
  }
  {
    auto str = u"123:abc"_str;
    auto split = SplitString(str, 0);
    EXPECT_EQ(u""_str, split.first);
    EXPECT_EQ(u"23:abc"_str, split.second);
  }
  {
    auto str = u"123:abc"_str;
    auto split = SplitString(str, 6);
    EXPECT_EQ(u"123:ab"_str, split.first);
    EXPECT_EQ(u""_str, split.second);
  }
  {
    auto str = u"123:abc"_str;
    auto split = SplitString(str, 7);
    EXPECT_EQ(u"123:abc"_str, split.first);
    EXPECT_EQ(u""_str, split.second);
  }
  {
    auto str = u"123:abc"_str;
    auto split = SplitString(str, 10);
    EXPECT_EQ(u"123:abc"_str, split.first);
    EXPECT_EQ(u""_str, split.second);
  }
}

TEST(TestStringLexicalCast, toIntegers)
{
  EXPECT_EQ(0, lexical_cast<int32_t>(u"0"_str));
  EXPECT_EQ(1, lexical_cast<int32_t>(u"1"_str));
  EXPECT_EQ(2, lexical_cast<int32_t>(u"2"_str));
  EXPECT_EQ(10, lexical_cast<int32_t>(u"10"_str));
  EXPECT_EQ(10, lexical_cast<int32_t>(u"010"_str));
  EXPECT_EQ(-1, lexical_cast<int32_t>(u"-1"_str));
  EXPECT_EQ(-2, lexical_cast<int32_t>(u"-2"_str));
  EXPECT_EQ(-20, lexical_cast<int32_t>(u"-20"_str));
  EXPECT_EQ(-20, lexical_cast<int32_t>(u"-020"_str));
  EXPECT_EQ(0, lexical_cast<int32_t>(u"0-2"_str));
  EXPECT_EQ(-2147483647, lexical_cast<int32_t>(u"-2147483647"_str));
  EXPECT_EQ(-2147483648, lexical_cast<int32_t>(u"-2147483648"_str));
  EXPECT_EQ(          0, lexical_cast<int32_t>(u"-2147483649"_str));
  EXPECT_EQ(          0, lexical_cast<int32_t>(u"-2157483649"_str));
  EXPECT_EQ(          0, lexical_cast<int32_t>(u"-3147483649"_str));
  EXPECT_EQ(-2147483648, lexical_cast<int32_t>(u"-02147483648"_str));
  EXPECT_EQ(-2147483648, lexical_cast<int32_t>(u"-000002147483648"_str));
  EXPECT_EQ(          0, lexical_cast<int32_t>(u"-21474836480"_str));
  EXPECT_EQ(2147483647, lexical_cast<int32_t>(u"2147483647"_str));
  EXPECT_EQ(2147483647, lexical_cast<int32_t>(u"000002147483647"_str));
  EXPECT_EQ(2147483647, lexical_cast<int32_t>(u"02147483647"_str));
  EXPECT_EQ(         0, lexical_cast<int32_t>(u"21474836470"_str));
  EXPECT_EQ(         0, lexical_cast<int32_t>(u"2147483648"_str));
  EXPECT_EQ(         0, lexical_cast<int32_t>(u"2157483648"_str));
  EXPECT_EQ(         0, lexical_cast<int32_t>(u"3147483648"_str));
  EXPECT_EQ(0u, lexical_cast<uint32_t>(u"0"_str));
  EXPECT_EQ(2u, lexical_cast<uint32_t>(u"2"_str));
  EXPECT_EQ(123u, lexical_cast<uint32_t>(u"123"_str));
  EXPECT_EQ(123u, lexical_cast<uint32_t>(u"0123"_str));
  EXPECT_EQ(123u, lexical_cast<uint32_t>(u"0000123"_str));
  EXPECT_EQ(4294967294u, lexical_cast<uint32_t>(u"4294967294"_str));
  EXPECT_EQ(4294967295u, lexical_cast<uint32_t>(u"4294967295"_str));
  EXPECT_EQ(         0u, lexical_cast<uint32_t>(u"4294967296"_str));
  EXPECT_EQ(         0u, lexical_cast<uint32_t>(u"4594967295"_str));
  EXPECT_EQ(         0u, lexical_cast<uint32_t>(u"5294967295"_str));
  EXPECT_EQ(         0u, lexical_cast<uint32_t>(u"42949672950"_str));
  EXPECT_EQ(4294967295u, lexical_cast<uint32_t>(u"04294967295"_str));

  EXPECT_EQ(0, lexical_cast<int32_t>(u" 123"_str));
  EXPECT_EQ(0u, lexical_cast<uint32_t>(u" 123"_str));
  EXPECT_EQ(0, lexical_cast<int32_t>(u"123abc"_str));
  EXPECT_EQ(0u, lexical_cast<uint32_t>(u"123abc"_str));
  EXPECT_EQ(0, lexical_cast<int32_t>(u"1 23"_str));
  EXPECT_EQ(0u, lexical_cast<uint32_t>(u"1 23"_str));
}

TEST(TestStringLexicalCast, toBoolean)
{
  EXPECT_TRUE(lexical_cast<bool>(u"true"_str));
  EXPECT_FALSE(lexical_cast<bool>(u"true123"_str));
  EXPECT_FALSE(lexical_cast<bool>(u"false"_str));
  EXPECT_FALSE(lexical_cast<bool>(u"some-string"_str));
  EXPECT_FALSE(lexical_cast<bool>(u""_str));
  EXPECT_FALSE(lexical_cast<bool>(DependentString()));
}

TEST(TestStringLexicalCast, toOwnedString)
{
  EXPECT_EQ(u"some-string"_str, lexical_cast<OwnedString>(u"some-string"_str));
  EXPECT_EQ(u""_str, lexical_cast<OwnedString>(u""_str));
}
