#include <emscripten/trace.h>

#if defined(__EMSCRIPTEN_TRACING__)
struct InitTracing
{
  InitTracing()
  {
    emscripten_trace_configure("http://127.0.0.1:5000/", "MyApplication");
  }

  ~InitTracing()
  {
    emscripten_trace_close();
  }
};

InitTracing foo;
#endif
