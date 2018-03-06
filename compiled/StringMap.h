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

#include "base.h"
#include "Map.h"
#include "String.h"

ABP_NS_BEGIN
namespace StringMap_internal
{
  inline size_t stringHash(const String& key)
  {
    // FNV-1a hash function
    size_t result = 2166136261;
    for (size_t i = 0; i < key.length(); i++)
      result = (result ^ key[i]) * 16777619;
    return result;
  }
}

struct StringHash
{
  size_t operator()(const String& key) const
  {
    return StringMap_internal::stringHash(key);
  }
};

namespace StringMap_internal
{
  template<typename Key>
  struct StringSetEntry
  {
    static_assert(std::is_base_of<String, Key>::value, "Type of Key should be based on String");
    typedef Key key_type;
    typedef const String& key_type_cref;
    typedef size_t size_type;

    key_type first;

    StringSetEntry(key_type_cref key = key_type())
    {
      if (!key.is_invalid())
        first.reset(key);
    }

    bool equals(key_type_cref other) const
    {
      return first.equals(other);
    }

    bool is_invalid() const
    {
      return first.is_invalid();
    }

    bool is_deleted() const
    {
      return first.is_deleted();
    }

    void erase()
    {
      first.erase();
    }

    static size_type hash(key_type_cref key)
    {
      return stringHash(key);
    }
  };

  template<typename Key, typename Value>
  struct StringMapEntry : StringSetEntry<Key>
  {
    typedef StringSetEntry<Key> super;
    typedef Value value_type;

    value_type second;

    StringMapEntry(typename super::key_type_cref key = Key(),
                   value_type value = value_type())
        : super(key), second(std::move(value))
    {
    }

    void erase()
    {
      super::erase();
      second = value_type();
    }
  };
}

using StringSet = Set<StringMap_internal::StringSetEntry<DependentString>>;

template<typename Value>
using StringMap = Map<StringMap_internal::StringMapEntry<DependentString, Value>>;
template<typename Value>
using OwnedStringMap = Map<StringMap_internal::StringMapEntry<OwnedString, Value>>;
ABP_NS_END
