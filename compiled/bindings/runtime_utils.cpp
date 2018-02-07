#include "runtime.h"
#include "../intrusive_ptr.h"
#include "../String.h"

ABP_NS_USING

extern "C"
{
  void BINDINGS_EXPORTED InitString(DependentString* str,
      String::value_type* data, String::size_type len)
  {
    // String is already allocated on stack, we merely need to call
    // constructor.
    new (str) DependentString(data, len);
  }

  void BINDINGS_EXPORTED InitOwnedString(OwnedString* str)
  {
    // String is already allocated on stack, we merely need to call
    // constructor.
    new (str) OwnedString();
  }

  void BINDINGS_EXPORTED DestroyString(OwnedString* str)
  {
    // Stack memory will be freed automatically, we need to call
    // destructor explicitly however.
    str->~OwnedString();
  }

  String::size_type BINDINGS_EXPORTED GetStringLength(
      const String& str)
  {
    return str.length();
  }

  const String::value_type* BINDINGS_EXPORTED GetStringData(
      const String& str)
  {
    return str.data();
  }

  void BINDINGS_EXPORTED ReleaseRef(ref_counted* ptr)
  {
    ptr->ReleaseRef();
  }
}
