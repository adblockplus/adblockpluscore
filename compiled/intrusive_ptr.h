// Parts of this code have been copied from boost/smart_ptr/intrusive_ptr.hpp.
//
//  Copyright (c) 2001, 2002 Peter Dimov
//
// Distributed under the Boost Software License, Version 1.0. (See
// accompanying file LICENSE_1_0.txt or copy at
// http://www.boost.org/LICENSE_1_0.txt)

#pragma once

#include <algorithm>
#include <type_traits>

#include "debug.h"

class ref_counted
{
public:
  void AddRef()
  {
    mRefCount++;
  }

  void ReleaseRef()
  {
    assert(mRefCount > 0, u"Unexpected zero or negative reference count"_str);
    if (--mRefCount == 0)
      delete this;
  }

protected:
  ref_counted()
      : mRefCount(1)
  {
  }

  virtual ~ref_counted()
  {
    assert(mRefCount == 0, u"Destroying a ref-counted object with a non-zero reference count"_str);
  }

private:
  int mRefCount;
};

template<typename T,
    class = typename std::enable_if<std::is_base_of<ref_counted,T>::value>::type>
class intrusive_ptr
{
public:
  explicit intrusive_ptr()
      : mPointer(nullptr)
  {
  }

  explicit intrusive_ptr(T* pointer)
      : mPointer(pointer)
  {
    // Raw pointers always had their reference count increased by whatever gave
    // us the pointer so we don't need to do it here.
  }

  intrusive_ptr(const intrusive_ptr& other)
      : mPointer(other.mPointer)
  {
    if (mPointer)
      mPointer->AddRef();
  }

  intrusive_ptr(intrusive_ptr&& other)
      : mPointer(other.mPointer)
  {
    other.mPointer = nullptr;
  }

  ~intrusive_ptr()
  {
    if (mPointer)
      mPointer->ReleaseRef();
  }

  intrusive_ptr& operator=(intrusive_ptr& other)
  {
    intrusive_ptr(other).swap(*this);
    return *this;
  }

  intrusive_ptr& operator=(intrusive_ptr&& other)
  {
    intrusive_ptr(std::move(other)).swap(*this);
    return *this;
  }

  intrusive_ptr& operator=(T* other)
  {
    intrusive_ptr(other).swap(*this);
    return *this;
  }

  void reset()
  {
    intrusive_ptr().swap(*this);
  }

  void reset(T* other)
  {
    intrusive_ptr(other).swap(*this);
  }

  const T* get() const
  {
    return mPointer;
  }

  T* get()
  {
    return mPointer;
  }

  const T& operator*() const
  {
    return *mPointer;
  }

  T& operator*()
  {
    return *mPointer;
  }

  const T* operator->() const
  {
    return mPointer;
  }

  T* operator->()
  {
    return mPointer;
  }

  explicit operator bool() const
  {
    return mPointer != nullptr;
  }

  bool operator!() const
  {
    return mPointer == nullptr;
  }

  T* release()
  {
    T* result = mPointer;
    mPointer = nullptr;
    return result;
  }

  void swap(intrusive_ptr& other)
  {
    std::swap(mPointer, other.mPointer);
  }

private:
  T* mPointer;
};

template<typename T, typename U>
inline bool operator==(const intrusive_ptr<T>& a, const intrusive_ptr<U>& b)
{
  return a.get() == b.get();
}

template<typename T, typename U>
inline bool operator!=(const intrusive_ptr<T>& a, const intrusive_ptr<U>& b)
{
  return a.get() != b.get();
}

template<typename T, typename U>
inline bool operator==(const intrusive_ptr<T>& a, const U* b)
{
  return a.get() == b;
}

template<typename T, typename U>
inline bool operator!=(const intrusive_ptr<T>& a, const U* b)
{
    return a.get() != b;
}

template<typename T, typename U>
inline bool operator==(const T* a, const intrusive_ptr<U>& b)
{
  return a == b.get();
}

template<typename T, typename U>
inline bool operator!=(const T* a, intrusive_ptr<U> const& b)
{
  return a != b.get();
}
