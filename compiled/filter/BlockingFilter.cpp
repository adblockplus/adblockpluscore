#include "BlockingFilter.h"

BlockingFilter::BlockingFilter(const String& text,
    const RegExpFilterData& data)
    : RegExpFilter(Type::BLOCKING, text, data)
{
}
