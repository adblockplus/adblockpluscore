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

#include <cmath>
#include <initializer_list>
#include <memory>

#include "base.h"
#include "debug.h"
#include "String.h"

ABP_NS_BEGIN

template<typename Entry>
class Map;

namespace Map_internal
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
      if (mPos != mEnd && (mPos->is_invalid() || mPos->is_deleted()))
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
      } while(mPos != mEnd && (mPos->is_invalid() || mPos->is_deleted()));
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
      return !(mEntry->is_invalid() || mEntry->is_deleted());
    }
  };

  template<typename Entry>
  class HashContainer
  {
  public:
    typedef Entry entry_type;
    typedef typename Entry::key_type_cref key_type_cref;
    typedef typename entry_type::size_type size_type;
    typedef HashContainerIterator<Entry> const_iterator;
    typedef HashContainerReference<const Entry> const_reference;

    explicit HashContainer(HashContainer&& other) = default;
    HashContainer& operator=(HashContainer&&) = default;

    explicit HashContainer(const HashContainer& other) = delete;
    void operator=(const HashContainer& other) = delete;

  protected:
    static constexpr size_type MIN_BUCKETS = 1;
    static constexpr double LOAD_FACTOR = 0.8;
    std::unique_ptr<entry_type[]> mBuckets;
    size_type mBucketCount;
    size_type mEntryCount;

#if defined(DEBUG)
    size_type mInsertCounter;
#endif

    entry_type* find_bucket(key_type_cref key) const
    {
      size_type h = entry_type::hash(key);

      // This does quadratic probing, effectively the following formula is used:
      // pos = (hash + 1/2 i + 1/2 i ^ 2) mod bucketCount
      for (size_type i = 0; ; ++i)
      {
        // mBucketCount is 2^n so (h & mBucketCount - 1) is equivalent to
        // h % mBucketCount but significantly faster.
        entry_type* entry = &mBuckets[h & (mBucketCount - 1)];
        if (entry->is_invalid() || entry->equals(key))
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
      allocate();

      // Copy old entries into the new buffer
      for (size_type i = 0; i < oldCount; i++)
      {
        entry_type& entry = oldBuckets[i];
        if (!entry.is_invalid() && !entry.is_deleted())
        {
          *find_bucket(entry.first) = std::move(entry);
          mEntryCount++;
        }
      }
    }

    // Prepare the bucket for assigning entry at key.
    entry_type* prepare_bucket(entry_type* existing, key_type_cref key)
    {
      if (existing->is_invalid())
      {
        if (mEntryCount + 1 >= mBucketCount * LOAD_FACTOR)
        {
          resize(mBucketCount << 1);
          existing = find_bucket(key);
        }
        mEntryCount++;
#if defined(DEBUG)
        mInsertCounter++;
#endif
      }
      return existing;
    }

    entry_type* assign(entry_type* existing, const entry_type& entry)
    {
      existing = prepare_bucket(existing, entry.first);
      *existing = entry;
      return existing;
    }

    entry_type* assign(entry_type* existing, entry_type&& entry)
    {
      existing = prepare_bucket(existing, entry.first);
      *existing = std::move(entry);
      return existing;
    }

    void allocate()
    {
      mBuckets.reset(new entry_type[mBucketCount]);
      // Working around https://github.com/waywardmonkeys/emscripten-trace-collector/issues/2 here
      annotate_address(reinterpret_cast<size_type*>(mBuckets.get()) - 1, "Hash table buffer");
    }

  public:
    explicit HashContainer(size_type expectedEntries = 0)
        : mEntryCount(0)
#if defined(DEBUG)
        , mInsertCounter(0)
#endif
    {
      expectedEntries = ceil(expectedEntries / LOAD_FACTOR);
      mBucketCount = MIN_BUCKETS;
      while (mBucketCount < expectedEntries)
        mBucketCount <<= 1;

      allocate();
    }

    void clear()
    {
      mEntryCount = 0;
      allocate();
    }

    void insert(const entry_type& entry)
    {
      assign(find_bucket(entry.first), entry);
    }

    bool erase(key_type_cref key)
    {
      entry_type* entry = find_bucket(key);
      if (entry->is_invalid())
        return false;

      entry->erase();
      return true;
    }

    const_reference find(key_type_cref key) const
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

  template<typename Entry>
  struct MapReference : public HashContainerReference<Entry>
  {
    typedef HashContainerReference<Entry> super;
    typedef typename super::entry_type entry_type;
    typedef typename entry_type::key_type_cref key_type_cref;
    typedef typename entry_type::value_type value_type;
    typedef Map<entry_type> map_type;

    map_type* mMap;

#if defined(DEBUG)
    typename map_type::size_type mInsertCounter;
    typename map_type::size_type mHash;
#endif

    MapReference(map_type* map, key_type_cref key, entry_type* entry)
        : super(entry), mMap(map)
    {
#if defined(DEBUG)
      mInsertCounter = mMap->mInsertCounter;
      mHash = entry_type::hash(key);
#endif
    }

    void assign(key_type_cref key, const value_type& value)
    {
#if defined(DEBUG)
      assert2(mInsertCounter == mMap->mInsertCounter,
          u"There should be no insert operations performed between map.find() and assign()"_str);
      assert2(mHash == entry_type::hash(key),
          u"The keys used in map.find() and assign() should be identical"_str);
#endif

      mMap->assign(this->mEntry, entry_type(key, value));
    }
  };
}

template<typename Entry>
using Set = Map_internal::HashContainer<Entry>;

template<typename Entry>
class Map : public Map_internal::HashContainer<Entry>
{
public:
  typedef Map_internal::HashContainer<Entry> super;
  typedef typename super::size_type size_type;
  typedef typename super::entry_type entry_type;
  typedef typename super::key_type_cref key_type_cref;
  typedef typename entry_type::value_type value_type;
  typedef typename super::const_reference const_reference;
  typedef Map_internal::MapReference<entry_type> reference;
  friend struct Map_internal::MapReference<entry_type>;

  using super::super;

  Map()
  {
  }

  Map(std::initializer_list<entry_type> list)
      : super(list.size())
  {
    for (const auto& item : list)
      super::insert(item);
  }

  value_type& operator[](key_type_cref key)
  {
    entry_type* entry = super::find_bucket(key);
    if (entry->is_invalid())
      entry = super::assign(entry, key);
    return entry->second;
  }

  const_reference find(key_type_cref key) const
  {
    return super::find(key);
  }

  reference find(key_type_cref key)
  {
    return reference(this, key, super::find_bucket(key));
  }
};

ABP_NS_END
