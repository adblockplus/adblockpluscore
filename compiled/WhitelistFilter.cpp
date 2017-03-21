#include "WhitelistFilter.h"

WhitelistFilter::WhitelistFilter(const String& text,
    const RegExpFilterData& data)
    : RegExpFilter(Type::WHITELIST, text, data)
{
}
