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

#include "bindings.ipp"
#include "filter/Filter.h"
#include "filter/InvalidFilter.h"
#include "filter/CommentFilter.h"
#include "filter/ActiveFilter.h"
#include "filter/RegExpFilter.h"
#include "filter/BlockingFilter.h"
#include "filter/WhitelistFilter.h"
#include "filter/ElemHideBase.h"
#include "filter/ElemHideFilter.h"
#include "filter/ElemHideException.h"
#include "filter/ElemHideEmulationFilter.h"

EMSCRIPTEN_BINDINGS
{
  class_<Filter>("Filter")
      .property("text", &Filter::GetText)
      .function("serialize", &Filter::Serialize)
      .class_function("fromText", &Filter::FromText)
      .subclass_differentiator(&Filter::mType, {
        {Filter::Type::INVALID, "InvalidFilter"},
        {Filter::Type::COMMENT, "CommentFilter"},
        {Filter::Type::BLOCKING, "BlockingFilter"},
        {Filter::Type::WHITELIST, "WhitelistFilter"},
        {Filter::Type::ELEMHIDE, "ElemHideFilter"},
        {Filter::Type::ELEMHIDEEXCEPTION, "ElemHideException"},
        {Filter::Type::ELEMHIDEEMULATION, "ElemHideEmulationFilter"},
      });

  class_<InvalidFilter,Filter>("InvalidFilter")
      .class_property("type", "'invalid'")
      .property("reason", &InvalidFilter::GetReason);

  class_<CommentFilter,Filter>("CommentFilter")
      .class_property("type", "'comment'");

  class_<ActiveFilter,Filter>("ActiveFilter")
      .property("disabled", &ActiveFilter::GetDisabled, &ActiveFilter::SetDisabled)
      .property("hitCount", &ActiveFilter::GetHitCount, &ActiveFilter::SetHitCount)
      .property("lastHit", &ActiveFilter::GetLastHit, &ActiveFilter::SetLastHit)
      .function("isActiveOnDomain", &ActiveFilter::IsActiveOnDomain)
      .function("isActiveOnlyOnDomain", &ActiveFilter::IsActiveOnlyOnDomain)
      .function("isGeneric", &ActiveFilter::IsGeneric)
      .function("serialize", &ActiveFilter::Serialize);

  class_<RegExpFilter,ActiveFilter>("RegExpFilter")
      .function("matches", &RegExpFilter::Matches)
      .class_initializer(&RegExpFilter::InitJSTypes);

  class_<BlockingFilter,RegExpFilter>("BlockingFilter")
      .class_property("type", "'blocking'");

  class_<WhitelistFilter,RegExpFilter>("WhitelistFilter")
      .class_property("type", "'whitelist'");

  class_<ElemHideBase,ActiveFilter>("ElemHideBase")
      .property("selector", &ElemHideBase::GetSelector)
      .property("selectorDomain", &ElemHideBase::GetSelectorDomain);

  class_<ElemHideFilter,ElemHideBase>("ElemHideFilter")
      .class_property("type", "'elemhide'");

  class_<ElemHideException,ElemHideBase>("ElemHideException")
      .class_property("type", "'elemhideexception'");

  class_<ElemHideEmulationFilter,ElemHideBase>("ElemHideEmulationFilter")
      .class_property("type", "'elemhideemulation'");
}
