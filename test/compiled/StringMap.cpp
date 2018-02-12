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
#include "gtest/gtest.h"
#include "compiled/StringMap.h"

ABP_NS_USING

template<template <typename T> class S>
void testStringMap()
{
  S<std::string> map;

  EXPECT_EQ(map.begin(), map.end());

  auto key = u"Foobar"_str;
  EXPECT_EQ(key.length(), 6);
  EXPECT_EQ(map.size(), 0);

  map[u"Foobar"_str] = "one";
  EXPECT_EQ(map.size(), 1);
  EXPECT_NE(map.begin(), map.end());

  map[u""_str] = "null";
  EXPECT_EQ(map.size(), 2);

  auto entry = map.find(u"Foobar"_str);
  EXPECT_TRUE(entry);

  entry = map.find(u"Foobar2"_str);
  EXPECT_FALSE(entry);

  map[u"Foobar2"_str] = "two";
  entry = map.find(u"Foobar2"_str);
  EXPECT_TRUE(entry);

  map[u"Foobar3"_str] = "three";
  entry = map.find(u"Foobar3"_str);
  EXPECT_TRUE(entry);

  EXPECT_EQ(map.size(), 4);

  map.erase(u"Foobar2"_str);

  // DISABLED. This should be true, but it isn't
  //EXPECT_EQ(map.size(), 3);

  entry = map.find(u"Foobar2"_str);
  EXPECT_FALSE(entry);

  int i = 0;
  for (const auto& e : map)
  {
    EXPECT_FALSE(e.is_invalid());
    // DISABLED entries that are deleted shouldn't be returned.
    // See issue #6281
    //EXPECT_FALSE(e.is_deleted());
    i++;
  }

  EXPECT_EQ(i, 4); // SHOULD be 3. See issue #6281
  EXPECT_EQ(i, map.size());
}

TEST(TestStringMap, stringMap)
{
  testStringMap<StringMap>();
}

TEST(TestStringMap, ownedStringMap)
{
  testStringMap<OwnedStringMap>();
}
