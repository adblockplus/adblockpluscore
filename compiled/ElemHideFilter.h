#pragma once

#include <cstddef>

#include "Filter.h"
#include "ElemHideBase.h"

class ElemHideFilter: public ElemHideBase
{
public:
  explicit ElemHideFilter(const String& text, const ElemHideBaseData& data);
};
