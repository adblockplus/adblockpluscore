#include "CommentFilter.h"

CommentFilter::CommentFilter(const String& text)
    : Filter(Type::COMMENT, text)
{
}

Filter::Type CommentFilter::Parse(const String& text)
{
  if (text.length() && text[0] == u'!')
    return Type::COMMENT;
  else
    return Type::UNKNOWN;
}

CommentFilter* CommentFilter::Create(const String& text)
{
  Type type = Parse(text);
  if (type == Type::COMMENT)
    return new CommentFilter(text);
  else
    return nullptr;
}
