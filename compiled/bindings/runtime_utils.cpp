#include <emscripten.h>

#include "../intrusive_ptr.h"
#include "../String.h"

extern "C"
{
  void EMSCRIPTEN_KEEPALIVE InitString(DependentString* str,
      String::value_type* data, String::size_type len)
  {
    // String is already allocated on stack, we merely need to call
    // constructor.
    new (str) DependentString(data, len);
  }

  void EMSCRIPTEN_KEEPALIVE DestroyString(OwnedString* str)
  {
    // Stack memory will be freed automatically, we need to call
    // destructor explicitly however.
    str->~OwnedString();
  }

  String::size_type EMSCRIPTEN_KEEPALIVE GetStringLength(
      const String& str)
  {
    return str.length();
  }

  const String::value_type* EMSCRIPTEN_KEEPALIVE GetStringData(
      const String& str)
  {
    return str.data();
  }

  void EMSCRIPTEN_KEEPALIVE ReleaseRef(ref_counted* ptr)
  {
    ptr->ReleaseRef();
  }
}
