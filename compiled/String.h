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

#include <algorithm>
#include <cstddef>
#include <cstring>
#include <type_traits>

#include "debug.h"
#include "library.h"

inline void String_assert_writable(bool isWritable);

class String
{
  friend class DependentString;
  friend class OwnedString;

public:
  typedef char16_t value_type;
  typedef size_t size_type;

  // Type flags, stored in the top 2 bits of the mLen member
  static constexpr size_type INVALID = 0xC0000000;
  static constexpr size_type DELETED = 0x80000000;
  static constexpr size_type READ_ONLY = 0x40000000;
  static constexpr size_type READ_WRITE = 0x00000000;

  static constexpr size_type FLAGS_MASK = 0xC0000000;
  static constexpr size_type LENGTH_MASK = 0x3FFFFFFF;

  static constexpr size_type npos = -1;

protected:
  value_type* mBuf;
  size_type mLen;

  explicit String(value_type* buf, size_type len, size_type flags)
      : mBuf(buf), mLen((len & LENGTH_MASK) | flags)
  {
  }

  ~String()
  {
  }

  void reset(value_type* buf, size_type len, size_type flags)
  {
    mBuf = buf;
    mLen = (len & LENGTH_MASK) | flags;
  }

public:
  size_type length() const
  {
    return mLen & LENGTH_MASK;
  }

  bool empty() const
  {
    return !(mLen & LENGTH_MASK);
  }

  const value_type* data() const
  {
    return mBuf;
  }

  value_type* data()
  {
    String_assert_writable(is_writable());
    return mBuf;
  }

  const value_type& operator[](size_type pos) const
  {
    return mBuf[pos];
  }

  value_type& operator[](size_type pos)
  {
    String_assert_writable(is_writable());
    return mBuf[pos];
  }

  bool is_writable() const
  {
    return (mLen & FLAGS_MASK) == READ_WRITE;
  }

  bool equals(const String& other) const
  {
    if (length() != other.length())
      return false;

    return std::memcmp(mBuf, other.mBuf, sizeof(value_type) * length()) == 0;
  }

  bool operator==(const String& other) const
  {
    return equals(other);
  }

  bool operator!=(const String& other) const
  {
    return !equals(other);
  }

  size_type find(value_type c, size_type pos = 0) const
  {
    for (size_type i = pos; i < length(); ++i)
      if (mBuf[i] == c)
        return i;
    return npos;
  }

  size_type find(const String& str, size_type pos = 0) const
  {
    if (pos > LENGTH_MASK || pos + str.length() > length())
      return npos;

    if (!str.length())
      return pos;

    for (; pos + str.length() <= length(); ++pos)
    {
      if (mBuf[pos] == str[0] &&
          std::memcmp(mBuf + pos, str.mBuf, sizeof(value_type) * str.length()) == 0)
      {
        return pos;
      }
    }

    return npos;
  }

  size_type rfind(value_type c, size_type pos = npos) const
  {
    if (length() == 0)
      return npos;

    if (pos >= length())
      pos = length() - 1;

    for (int i = pos; i >= 0; --i)
      if (mBuf[i] == c)
        return i;
    return npos;
  }

  bool is_invalid() const
  {
    return (mLen & FLAGS_MASK) == INVALID;
  }

  bool is_deleted() const
  {
    return (mLen & FLAGS_MASK) == DELETED;
  }

  void toLower()
  {
    size_type len = length();
    for (size_type i = 0; i < len; ++i)
    {
      value_type currChar = mBuf[i];

      // This should be more efficient with a lookup table but I couldn't measure
      // any performance difference.
      if (currChar >= u'A' && currChar <= u'Z')
        mBuf[i] = currChar + u'a' - u'A';
      else if (currChar >= 128)
      {
        mBuf[i] = CharToLower(currChar);
      }
    }
  }
};

class DependentString : public String
{
public:
  explicit DependentString()
      : String(nullptr, 0, INVALID)
  {
  }

  explicit DependentString(value_type* buf, size_type len)
      : String(buf, len, READ_WRITE)
  {
  }

  explicit DependentString(const value_type* buf, size_type len)
      : String(const_cast<value_type*>(buf), len, READ_ONLY)
  {
  }

  explicit DependentString(String& str, size_type pos = 0, size_type len = npos)
      : String(
          str.mBuf + std::min(pos, str.length()),
          std::min(len, str.length() - std::min(pos, str.length())),
          str.is_writable() ? READ_WRITE: READ_ONLY
        )
  {
  }

  explicit DependentString(const String& str, size_type pos = 0,
      size_type len = npos)
      : String(
          str.mBuf + std::min(pos, str.length()),
          std::min(len, str.length() - std::min(pos, str.length())),
          READ_ONLY
        )
  {
  }

  void reset(value_type* buf, size_type len)
  {
    *this = DependentString(buf, len);
  }

  void reset(const value_type* buf, size_type len)
  {
    *this = DependentString(buf, len);
  }

  void reset(String& str, size_type pos = 0, size_type len = npos)
  {
    *this = DependentString(str, pos, len);
  }

  void reset(const String& str, size_type pos = 0, size_type len = npos)
  {
    *this = DependentString(str, pos, len);
  }

  void erase()
  {
    *this = DependentString();
    mLen = DELETED;
  }
};

inline DependentString operator "" _str(const String::value_type* str,
    String::size_type len)
{
  return DependentString(str, len);
}

inline void String_assert_writable(bool isWritable)
{
  assert(isWritable, u"Writing access to a read-only string"_str);
}

class OwnedString : public String
{
private:
  void grow(size_type additionalSize)
  {
    OwnedString newValue(length() + additionalSize);
    if (length() > 0)
      std::memcpy(newValue.mBuf, mBuf, sizeof(value_type) * length());
    *this = std::move(newValue);
  }

public:
  explicit OwnedString(size_type len = 0)
      : String(nullptr, len, READ_WRITE)
  {
    if (len)
    {
      mBuf = new value_type[length()];
      annotate_address(mBuf, "String");
    }
    else
      mBuf = nullptr;
  }

  explicit OwnedString(const String& str)
      : OwnedString(str.length())
  {
    if (length())
      std::memcpy(mBuf, str.mBuf, sizeof(value_type) * length());
  }

  OwnedString(const OwnedString& str)
      : OwnedString(static_cast<const String&>(str))
  {
  }

  explicit OwnedString(const value_type* str, size_type len)
      : OwnedString(DependentString(str, len))
  {
  }

  explicit OwnedString(OwnedString&& str)
      : OwnedString(0)
  {
    mBuf = str.mBuf;
    mLen = str.mLen;
    str.mBuf = nullptr;
    str.mLen = READ_WRITE | 0;
  }

  ~OwnedString()
  {
    if (mBuf)
      delete[] mBuf;
  }

  OwnedString& operator=(const String& str)
  {
    *this = OwnedString(str);
    return *this;
  }

  OwnedString& operator=(const OwnedString& str)
  {
    *this = OwnedString(str);
    return *this;
  }

  OwnedString& operator=(OwnedString&& str)
  {
    std::swap(mBuf, str.mBuf);
    std::swap(mLen, str.mLen);
    return *this;
  }

  void append(const value_type* source, size_type sourceLen)
  {
    if (!sourceLen)
      return;

    assert(source, u"Null buffer passed to OwnedString.append()"_str);
    size_t oldLength = length();
    grow(sourceLen);
    std::memcpy(mBuf + oldLength, source, sizeof(value_type) * sourceLen);
  }

  void append(const char* source, size_type sourceLen)
  {
    if (!sourceLen)
      return;

    assert(source, u"Null buffer passed to OwnedString.append()"_str);
    size_t oldLength = length();
    grow(sourceLen);
    for (size_t i = 0; i < sourceLen; i++)
      mBuf[oldLength + i] = source[i];
  }

  void append(const String& str)
  {
    append(str.mBuf, str.length());
  }

  void append(value_type c)
  {
    append(&c, 1);
  }

  template<typename T,
      typename std::enable_if<std::is_integral<T>::value>::type* = nullptr>
  void append(T num)
  {
    bool negative = false;
    if (num < 0)
    {
      negative = true;
      num = -num;
    }

    size_type size = 0;
    for (T i = num; i; i /= 10)
      size++;
    size = (size ? size : 1);

    size_type pos = length();
    grow((negative ? 1 : 0) + size);

    if (negative)
      mBuf[pos++] = '-';

    for (int i = size - 1; i >= 0; i--)
    {
      mBuf[pos + i] = '0' + (num % 10);
      num /= 10;
    }
  }
};
