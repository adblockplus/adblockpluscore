#pragma once

#include <emscripten.h>
#include <emscripten/trace.h>

#if defined(assert)
#undef assert
#endif

class String;

struct console_type
{
  static void log(const String& str)
  {
    EM_ASM_ARGS(console.log(readString($0)), &str);
  }

  static void log(int i)
  {
    EM_ASM_ARGS(console.log($0), i);
  }

  static void log(void* ptr)
  {
    EM_ASM_ARGS(console.log($0), ptr);
  }

  static void error(const String& str)
  {
    EM_ASM_ARGS(console.error(new Error(readString($0)).stack), &str);
  }
};

static console_type console;

#if defined(DEBUG)
inline void assert(bool condition, const String& str)
{
  if (!condition)
    console.error(str);
}
#else
#define assert(condition, str)
#endif

inline void annotate_address(void* address, const char* name)
{
#if defined(__EMSCRIPTEN_TRACING__)
  emscripten_trace_annotate_address_type(address, name);
#endif
}

inline void enter_context(const char* context)
{
#if defined(__EMSCRIPTEN_TRACING__)
  emscripten_trace_enter_context(context);
#endif
}

inline void exit_context()
{
#if defined(__EMSCRIPTEN_TRACING__)
  emscripten_trace_exit_context();
#endif
}
