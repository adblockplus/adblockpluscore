/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
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

#include <cstddef>
#include <climits>

#include "Map.h"

namespace Uint32Map_internal
{
  struct Uint32SetEntry
  {
  public:
    typedef uint32_t key_type;
    typedef key_type key_type_cref;
    typedef size_t size_type;

  protected:
    static const key_type KEY_INVALID = 0xFFFFFFFF;
    static const key_type KEY_DELETED = 0xFFFFFFFE;

  public:
    key_type first;

    Uint32SetEntry(key_type_cref key = KEY_INVALID)
        : first(key)
    {
    }

    bool equals(key_type_cref other) const
    {
      return first == other;
    }

    bool is_invalid() const
    {
      return first == KEY_INVALID;
    }

    bool is_deleted() const
    {
      return first == KEY_DELETED;
    }

    void erase()
    {
      first = KEY_DELETED;
    }

    static size_type hash(key_type_cref key)
    {
      return key;
    }
  };

  template<typename Value>
  struct Uint32MapEntry : Uint32SetEntry
  {
    typedef Uint32SetEntry super;
    typedef Value value_type;

    value_type second;

    Uint32MapEntry(key_type_cref key = KEY_INVALID, value_type value = value_type())
        : Uint32SetEntry(key), second(value)
    {
    }

    void erase()
    {
      super::erase();
      second = value_type();
    }
  };
}

using Uint32Set = Set<Uint32Map_internal::Uint32SetEntry>;

template<typename Value>
using Uint32Map = Map<Uint32Map_internal::Uint32MapEntry<Value>>;
