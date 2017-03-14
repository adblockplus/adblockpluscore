#include "InvalidFilter.h"

InvalidFilter::InvalidFilter(const String& text,
    const String& reason)
    : Filter(Type::INVALID, text), mReason(reason)
{
}
