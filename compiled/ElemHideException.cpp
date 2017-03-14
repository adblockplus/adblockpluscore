#include "ElemHideException.h"

ElemHideException::ElemHideException(const String& text,
    const ElemHideData& data)
    : ElemHideBase(Type::ELEMHIDEEXCEPTION, text, data)
{
}
