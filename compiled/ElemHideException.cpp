#include "ElemHideException.h"

ElemHideException::ElemHideException(const String& text,
    const ElemHideBaseData& data)
    : ElemHideBase(Type::ELEMHIDEEXCEPTION, text, data)
{
}
