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
