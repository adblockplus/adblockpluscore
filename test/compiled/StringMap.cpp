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
#include "compiled/StringMap.h"

ABP_NS_USING

template<template <typename T> class S>
void testStringMap()
{
  S<std::string> map;

  EXPECT_EQ(map.begin(), map.end());

  auto key = ABP_TEXT("Foobar"_str);
  EXPECT_EQ(6u, key.length());
  EXPECT_EQ(0u, map.size());

  map[ABP_TEXT("Foobar"_str)] = "one";
  EXPECT_EQ(1u, map.size());
  EXPECT_NE(map.begin(), map.end());

  map[ABP_TEXT(""_str)] = "null";
  EXPECT_EQ(2u, map.size());

  auto entry = map.find(ABP_TEXT("Foobar"_str));
  EXPECT_TRUE(entry);

  entry = map.find(ABP_TEXT("Foobar2"_str));
  EXPECT_FALSE(entry);

  map[ABP_TEXT("Foobar2"_str)] = "two";
  entry = map.find(ABP_TEXT("Foobar2"_str));
  EXPECT_TRUE(entry);

  map[ABP_TEXT("Foobar3"_str)] = "three";
  entry = map.find(ABP_TEXT("Foobar3"_str));
  EXPECT_TRUE(entry);

  EXPECT_EQ(4u, map.size());

  EXPECT_TRUE(map.erase(ABP_TEXT("Foobar2"_str)));
  // already deleted. Returns false.
  EXPECT_FALSE(map.erase(ABP_TEXT("Foobar2"_str)));
  // invalid. Returns false.
  EXPECT_FALSE(map.erase(ABP_TEXT("Foobar42"_str)));

  EXPECT_EQ(4u, map.size());

  entry = map.find(ABP_TEXT("Foobar2"_str));
  EXPECT_FALSE(entry);

  uint32_t i = 0;
  for (const auto& e : map)
  {
    EXPECT_FALSE(e.is_invalid());
    // entries that are deleted shouldn't be returned.
    EXPECT_FALSE(e.is_deleted());
    i++;
  }

  EXPECT_EQ(3u, i);
  // We did not return deleted entries (there is one).
  // So size is different than actual count.
  EXPECT_NE(i, map.size());
}

TEST(TestStringMap, stringMap)
{
  testStringMap<StringMap>();
}

TEST(TestStringMap, ownedStringMap)
{
  testStringMap<OwnedStringMap>();
}
