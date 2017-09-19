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
#include <cmath>
#include <initializer_list>
#include <memory>

#include "String.h"
#include "debug.h"

template<typename T>
class StringMap;

namespace StringMap_internal
{
  template<typename Entry>
  struct HashContainerIterator
  {
    typedef Entry entry_type;
    typedef HashContainerIterator<Entry> iterator;

    const entry_type* mPos;
    const entry_type* mEnd;

    explicit HashContainerIterator(const entry_type* start, const entry_type* end)
        : mPos(start), mEnd(end)
    {
      if (mPos != mEnd && mPos->first.is_invalid())
        ++(*this);
    }

    const entry_type& operator*() const
    {
      return *mPos;
    }

    const entry_type* operator->() const
    {
      return mPos;
    }

    iterator& operator++()
    {
      do {
        ++mPos;
      } while(mPos != mEnd && mPos->first.is_invalid());
      return *this;
    }

    bool operator==(const iterator& it) const
    {
      return mPos == it.mPos;
    }

    bool operator!=(const iterator& it) const
    {
      return mPos != it.mPos;
    }
  };

  template<typename Entry>
  struct HashContainerReference
  {
    typedef Entry entry_type;

    entry_type* mEntry;

    explicit HashContainerReference(entry_type* entry)
        : mEntry(entry)
    {
    }

    const entry_type* operator->() const
    {
      return mEntry;
    }

    operator bool() const
    {
      return !mEntry->first.is_invalid();
    }
  };

  template<typename Entry>
  class HashContainer
  {
  public:
    typedef Entry entry_type;
    typedef size_t size_type;
    typedef HashContainerIterator<Entry> const_iterator;
    typedef HashContainerReference<const Entry> const_reference;

  private:
    explicit HashContainer(const HashContainer& other);
    void operator=(const HashContainer& other);

  protected:
    static constexpr size_type MIN_BUCKETS = 1;
    static constexpr double LOAD_FACTOR = 0.8;
    std::unique_ptr<entry_type[]> mBuckets;
    size_type mBucketCount;
    size_type mEntryCount;

#if defined(DEBUG)
    size_type mInsertCounter;
#endif

    explicit HashContainer(size_type expectedEntries = 0)
        : mEntryCount(0)
    {
      expectedEntries = ceil(expectedEntries / LOAD_FACTOR);
      mBucketCount = MIN_BUCKETS;
      while (mBucketCount < expectedEntries)
        mBucketCount <<= 1;

      mBuckets.reset(new entry_type[mBucketCount]);
      // Working around https://github.com/waywardmonkeys/emscripten-trace-collector/issues/2 here
      annotate_address(reinterpret_cast<size_type*>(mBuckets.get()) - 1, "Hash table buffer");
    }

    static size_type hash(const String& str)
    {
      // FNV-1a hash function
      size_type result = 2166136261;
      for (String::size_type i = 0; i < str.length(); i++)
        result = (result ^ str[i]) * 16777619;
      return result;
    }

    entry_type* find_bucket(const String& key) const
    {
      size_type h = hash(key);

      // This does quadratic probing, effectively the following formula is used:
      // pos = (hash + 1/2 i + 1/2 i ^ 2) mod bucketCount
      for (size_type i = 0; ; ++i)
      {
        // mBucketCount is 2^n so (h & mBucketCount - 1) is equivalent to
        // h % mBucketCount but significantly faster.
        entry_type* entry = &mBuckets[h & (mBucketCount - 1)];
        if (entry->first.is_invalid() || entry->first.equals(key))
          return entry;
        h += i;
      }
    }

    void resize(size_type bucketCount)
    {
      std::unique_ptr<entry_type[]> oldBuckets(std::move(mBuckets));
      size_type oldCount = mBucketCount;

      mEntryCount = 0;
      mBucketCount = bucketCount;
      mBuckets.reset(new entry_type[mBucketCount]);
      // Working around https://github.com/waywardmonkeys/emscripten-trace-collector/issues/2 here
      annotate_address(reinterpret_cast<size_type*>(mBuckets.get()) - 1, "Hash table buffer");

      // Copy old entries into the new buffer
      for (size_type i = 0; i < oldCount; i++)
      {
        entry_type& entry = oldBuckets[i];
        if (!entry.first.is_invalid() && !entry.first.is_deleted())
        {
          *find_bucket(entry.first) = entry;
          mEntryCount++;
        }
      }
    }

    entry_type* assign(entry_type* existing, const entry_type& entry)
    {
      if (existing->first.is_invalid())
      {
        if (mEntryCount + 1 >= mBucketCount * LOAD_FACTOR)
        {
          resize(mBucketCount << 1);
          existing = find_bucket(entry.first);
        }
        mEntryCount++;
#if defined(DEBUG)
        mInsertCounter++;
#endif
      }
      *existing = entry;
      return existing;
    }

  public:
    void insert(const entry_type& entry)
    {
      assign(find_bucket(entry.first), entry);
    }

    bool erase(const String& key)
    {
      entry_type* entry = find_bucket(key);
      if (entry->first.is_invalid())
        return false;

      entry->first.erase();
      return true;
    }

    const_reference find(const String& key) const
    {
      return const_reference(find_bucket(key));
    }

    const_iterator begin() const
    {
      return const_iterator(&mBuckets[0], &mBuckets[mBucketCount]);
    }

    const_iterator end() const
    {
      return const_iterator(&mBuckets[mBucketCount], &mBuckets[mBucketCount]);
    }

    size_type size() const
    {
      return mEntryCount;
    }
  };

  struct StringSetEntry
  {
    StringSetEntry() {}
    StringSetEntry(const String& key)
        : first(key)
    {
    }

    DependentString first;
  };

  template<typename T>
  struct StringMapEntry
  {
    StringMapEntry() {}
    StringMapEntry(const String& key)
        : first(key), second()
    {
    }
    StringMapEntry(const String& key, T value)
        : first(key), second(value)
    {
    }

    DependentString first;
    T second;
  };

  template<typename T>
  struct StringMapEntryReference : public HashContainerReference<StringMapEntry<T>>
  {
    typedef HashContainerReference<StringMapEntry<T>> super;
    typedef typename super::entry_type entry_type;
    typedef StringMap<T> map_type;

    map_type* mMap;

#if defined(DEBUG)
    typename map_type::size_type mInsertCounter;
    typename map_type::size_type mHash;
#endif

    StringMapEntryReference(map_type* map, const String& key, entry_type* entry)
        : super(entry), mMap(map)
    {
#if defined(DEBUG)
      mInsertCounter = mMap->mInsertCounter;
      mHash = mMap->hash(key);
#endif
    }

    void assign(const String& key, const T& value)
    {
#if defined(DEBUG)
      assert2(mInsertCounter == mMap->mInsertCounter,
          u"There should be no insert operations performed between map.find() and assign()"_str);
      assert2(mHash == mMap->hash(key),
          u"The keys used in map.find() and assign() should be identical"_str);
#endif

      mMap->assign(this->mEntry, entry_type(key, value));
    }
  };
}

class StringSet
  : public StringMap_internal::HashContainer<StringMap_internal::StringSetEntry>
{
};

template<typename T>
class StringMap
  : public StringMap_internal::HashContainer<StringMap_internal::StringMapEntry<T>>
{
public:
  typedef StringMap_internal::HashContainer<StringMap_internal::StringMapEntry<T>> super;
  typedef typename super::size_type size_type;
  typedef typename super::entry_type entry_type;
  typedef typename super::const_reference const_reference;
  typedef StringMap_internal::StringMapEntryReference<T> reference;
  friend struct StringMap_internal::StringMapEntryReference<T>;

  explicit StringMap(size_type expectedEntries = 0)
      : super(expectedEntries)
  {
  }

  StringMap(std::initializer_list<entry_type> list)
      : super(list.size())
  {
    for (const auto& item : list)
      super::insert(item);
  }

  ~StringMap()
  {
  }

  T& operator[](const String& key)
  {
    entry_type* entry = super::find_bucket(key);
    if (entry->first.is_invalid())
      entry = super::assign(entry, key);
    return entry->second;
  }

  const_reference find(const String& key) const
  {
    return super::find(key);
  }

  reference find(const String& key)
  {
    return reference(this, key, super::find_bucket(key));
  }
};
