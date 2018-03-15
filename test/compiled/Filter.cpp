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

#include <gtest/gtest.h>
#include "compiled/String.h"
#include "compiled/filter/Filter.h"
#include "compiled/filter/ElemHideBase.h"

ABP_NS_USING

TEST(TestFilter, testFromText)
{
  OwnedString t(ABP_TEXT("www.example.com#?#:-abp-properties(foo)"_str));
  DependentString text(t);

  FilterPtr filter(Filter::FromText(text), false);
  EXPECT_EQ(filter->GetText(), ABP_TEXT("www.example.com#?#:-abp-properties(foo)"_str));
}

TEST(TestFilter, testFilterConversionText)
{
  {
    OwnedString t(ABP_TEXT("www.example.com##[-abp-properties='foo']"_str));
    DependentString text(t);

    FilterPtr filter(Filter::FromText(text), false);
    EXPECT_EQ(filter->GetText(), ABP_TEXT("www.example.com#?#:-abp-properties(foo)"_str));
  }
  {
    OwnedString t(ABP_TEXT("example.com##foo[-abp-properties='something']bar"_str));
    DependentString text(t);

    FilterPtr filter(Filter::FromText(text), false);
    EXPECT_EQ(filter->GetText(), ABP_TEXT("example.com#?#foo:-abp-properties(something)bar"_str));
  }
  {
    OwnedString t(ABP_TEXT("foo.com##[-abp-properties='/margin: [3-4]{2}/']"_str));
    DependentString text(t);

    FilterPtr filter(Filter::FromText(text), false);
    EXPECT_EQ(filter->GetText(), ABP_TEXT("foo.com#?#:-abp-properties(/margin: [3-4]{2}/)"_str));
    ASSERT_TRUE(filter->As<ElemHideBase>());
    EXPECT_EQ(filter->As<ElemHideBase>()->GetSelector(), ABP_TEXT(":-abp-properties(/margin: [3-4]\\7B 2\\7D /)"_str));
  }
}

TEST(TestFilter, testFilterExceptionConversionText)
{
  OwnedString t(ABP_TEXT("www.example.com#@#[-abp-properties='foo']"_str));
  DependentString text(t);

  FilterPtr filter(Filter::FromText(text), false);
  EXPECT_EQ(filter->GetText(), ABP_TEXT("www.example.com#@#:-abp-properties(foo)"_str));
}

TEST(TestFilter, testFilterSyntaxErrorConversion)
{
  {
    OwnedString t(ABP_TEXT("www.example.com#@#[-abp-properties='foo'bar'baz']"_str));
    DependentString text(t);

    FilterPtr filter(Filter::FromText(text), false);
    EXPECT_FALSE(filter);
  }
  {
    OwnedString t(ABP_TEXT("www.example.com#@#[-abp-properties='foo'bar']"_str));
    DependentString text(t);

    FilterPtr filter(Filter::FromText(text), false);
    EXPECT_FALSE(filter);
  }
  {
    OwnedString t(ABP_TEXT("www.example.com#@#[-abp-properties='foo'bar]"_str));
    DependentString text(t);

    FilterPtr filter(Filter::FromText(text), false);
    EXPECT_FALSE(filter);
  }
  {
    OwnedString t(ABP_TEXT("www.example.com#@#[-abp-properties=bar'foo']"_str));
    DependentString text(t);

    FilterPtr filter(Filter::FromText(text), false);
    EXPECT_FALSE(filter);
  }
}
