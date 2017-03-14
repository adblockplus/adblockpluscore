#pragma once

#include "Filter.h"

class CommentFilter : public Filter
{
public:
  explicit CommentFilter(const String& text);
  static Type Parse(const String& text);
  static CommentFilter* Create(const String& text);
};
