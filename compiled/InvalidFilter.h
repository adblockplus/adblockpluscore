#pragma once

#include "Filter.h"

class InvalidFilter : public Filter
{
public:
  explicit InvalidFilter(const String& text, const String& reason);
  EMSCRIPTEN_KEEPALIVE const String& GetReason() const
  {
    return mReason;
  };
private:
  OwnedString mReason;
};
