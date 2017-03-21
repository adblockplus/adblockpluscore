#pragma once

#include "RegExpFilter.h"

class BlockingFilter : public RegExpFilter
{
public:
  explicit BlockingFilter(const String& text, const RegExpFilterData& data);
};
