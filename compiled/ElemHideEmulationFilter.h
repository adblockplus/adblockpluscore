#pragma once

#include <cstddef>

#include "Filter.h"
#include "ElemHideBase.h"

class ElemHideEmulationFilter : public ElemHideBase
{
public:
  explicit ElemHideEmulationFilter(const String& text,
      const ElemHideData& data);
};
