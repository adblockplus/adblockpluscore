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

