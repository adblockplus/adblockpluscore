/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-2017 eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

#pragma once

#include "library.h"

#if defined(assert)
#undef assert
#endif

class String;

struct console_type
{
  static void log(const String& str)
  {
    LogString(str);
  }

  static void log(int i)
  {
    LogInteger(i);
  }

  static void log(const void* ptr)
  {
    LogPointer(ptr);
  }

  static void error(const String& str)
  {
    LogError(str);
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

#if defined(__EMSCRIPTEN_TRACING__)
#include <emscripten/trace.h>

inline void init_tracing()
{
  emscripten_trace_configure("http://127.0.0.1:5000/", "MyApplication");
}

inline void shutdown_tracing()
{
  emscripten_trace_close();
}

inline void annotate_address(void* address, const char* name)
{
  emscripten_trace_annotate_address_type(address, name);
}

inline void enter_context(const char* context)
{
  emscripten_trace_enter_context(context);
}

inline void exit_context()
{
  emscripten_trace_exit_context();
}

#else // defined(__EMSCRIPTEN_TRACING__)

inline void init_tracing()
{
}

inline void shutdown_tracing()
{
}

inline void annotate_address(void* address, const char* name)
{
}

inline void enter_context(const char* context)
{
}

inline void exit_context()
{
}

#endif // defined(__EMSCRIPTEN_TRACING__)
