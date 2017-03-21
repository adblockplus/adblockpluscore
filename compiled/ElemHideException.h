#pragma once

#include <cstddef>

#include "Filter.h"
#include "ElemHideBase.h"

class ElemHideException: public ElemHideBase
{
public:
  explicit ElemHideException(const String& text, const ElemHideBaseData& data);
};
