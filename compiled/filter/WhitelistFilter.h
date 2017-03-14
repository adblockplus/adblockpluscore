#pragma once

#include "RegExpFilter.h"

class WhitelistFilter : public RegExpFilter
{
public:
  explicit WhitelistFilter(const String& text, const RegExpFilterData& data);
};
