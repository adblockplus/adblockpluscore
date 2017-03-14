#include "bindings.ipp"
#include "Filter.h"
#include "InvalidFilter.h"
#include "CommentFilter.h"
#include "ActiveFilter.h"
#include "RegExpFilter.h"
#include "BlockingFilter.h"
#include "WhitelistFilter.h"
#include "ElemHideBase.h"
#include "ElemHideFilter.h"
#include "ElemHideException.h"
#include "ElemHideEmulationFilter.h"

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
