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
#include <cstdint>
#include <cstdlib>
#include <functional>
#include <string>
#include <type_traits>
#include <utility>
#include <vector>

#include "../String.h"
#include "../intrusive_ptr.h"

namespace bindings_internal
{
  typedef void* TYPEID;

  enum class TypeCategory
  {
    UNKNOWN,
    VOID,
    INT,
    INT64,
    FLOAT,
    DOUBLE,
    DEPENDENT_STRING,
    OWNED_STRING,
    STRING_REF,
    CLASS_PTR
  };

  template<typename T>
  struct TypeInfo
  {
    /*
     * Since TypeInfo is a templated type, in practice the compiler will define
     * a new type for each possible template parameter value. We use that fact
     * to generate type identifiers: each of these TypeInfo types has a
     * different s_typeIDHelper member, so we use a pointer to that static
     * variable as a type identifier - it will be different for each template
     * parameter.
     */
    static char s_typeIDHelper;
    constexpr operator TYPEID() const
    {
      return &s_typeIDHelper;
    }

    constexpr operator TypeCategory() const
    {
      if (std::is_void<T>())
        return TypeCategory::VOID;

      if (std::is_same<T, uint64_t>())
        return TypeCategory::INT64;

      if (std::is_integral<T>() || std::is_enum<T>())
        return TypeCategory::INT;

      if (std::is_same<T, float>())
        return TypeCategory::FLOAT;

      if (std::is_same<T, double>())
        return TypeCategory::DOUBLE;

      if (std::is_same<DependentString, T>() || std::is_same<const DependentString, T>())
        return TypeCategory::DEPENDENT_STRING;

      if (std::is_same<OwnedString, T>() || std::is_same<const OwnedString, T>())
        return TypeCategory::OWNED_STRING;

      if (std::is_same<String&, T>() || std::is_same<const String&, T>() ||
        std::is_same<DependentString&, T>())
      {
        return TypeCategory::STRING_REF;
      }

      if (std::is_pointer<T>() && std::is_class<typename std::remove_pointer<T>::type>())
        return TypeCategory::CLASS_PTR;

      return TypeCategory::UNKNOWN;
    }

    constexpr TYPEID pointer_type() const
    {
      if (std::is_pointer<T>())
        return TypeInfo<typename std::remove_pointer<T>::type>();
      else
        return nullptr;
    }
  };

  template<typename T>
  char TypeInfo<T>::s_typeIDHelper;

  struct FunctionInfo
  {
    TypeCategory returnType;
    TYPEID pointerType;
    std::vector<TypeCategory> args;
    bool instance_function;
    int effectiveArgs;
    TypeCategory effectiveReturnType;
    std::string name;

    FunctionInfo();

    FunctionInfo(TypeCategory returnType, TYPEID pointerType,
        std::initializer_list<TypeCategory> argTypes, bool instance_function,
        void* function);

    template<typename ReturnType, typename... Args>
    FunctionInfo(ReturnType (*function)(Args...))
        : FunctionInfo(TypeInfo<ReturnType>(),
          TypeInfo<ReturnType>().pointer_type(), { TypeInfo<Args>()... }, false,
          &function)
    {
    }

    template<typename ClassType, typename ReturnType, typename... Args>
    FunctionInfo(ReturnType (ClassType::*function)(Args...))
        : FunctionInfo(TypeInfo<ReturnType>(),
          TypeInfo<ReturnType>().pointer_type(), { TypeInfo<Args>()... }, true,
          &function)
    {
    }

    template<typename ClassType, typename ReturnType, typename... Args>
    FunctionInfo(ReturnType (ClassType::*function)(Args...) const)
        : FunctionInfo(TypeInfo<ReturnType>(),
          TypeInfo<ReturnType>().pointer_type(), { TypeInfo<Args>()... }, true,
          &function)
    {
    }

    bool empty() const;

    void get_function_name(void* ptr, const char* signature);
  };

  class NoBaseClass
  {
  };

  struct PropertyInfo
  {
    std::string name;
    FunctionInfo getter;
    FunctionInfo setter;
    std::string jsValue;
  };

  struct MethodInfo
  {
    std::string name;
    FunctionInfo call;
  };

  struct DifferentiatorInfo
  {
    size_t offset;
    std::vector<std::pair<int, std::string>> mapping;
  };

  typedef std::vector<PropertyInfo> Properties;
  typedef std::vector<MethodInfo> Methods;

  struct ClassInfo
  {
    TYPEID id;
    TYPEID baseClass;
    std::string name;
    Properties properties;
    Methods methods;
    DifferentiatorInfo subclass_differentiator;
    ptrdiff_t ref_counted_offset;
    FunctionInfo instanceGetter;
  };

  void register_class(const char* name, TYPEID classID, TYPEID baseClassID,
                      ptrdiff_t ref_counted_offset,
                      const FunctionInfo& instanceGetter = FunctionInfo());

  void register_property(TYPEID classID, const char* name,
      const FunctionInfo& getter, const FunctionInfo& setter,
      const char* jsValue = "");

  void register_method(TYPEID classID, const char* name,
      const FunctionInfo& call);

  void register_differentiator(TYPEID classID, size_t offset,
      std::vector<std::pair<int, std::string>>& mapping);

  std::string wrapCall(const FunctionInfo& call, bool isFunction = true,
      const FunctionInfo& instanceGetter = FunctionInfo());
}

template<typename ClassType,
    typename BaseClass = bindings_internal::NoBaseClass,
    typename std::enable_if<std::is_base_of<ref_counted, ClassType>::value>::type* = nullptr>
class class_
{
public:
  class_(const char* name)
  {
    ClassType* ptr = reinterpret_cast<ClassType*>(0x10000000);
    ptrdiff_t ref_counted_offset =
        reinterpret_cast<char*>(static_cast<ref_counted*>(ptr)) -
        reinterpret_cast<char*>(ptr);
    bindings_internal::register_class(name,
        bindings_internal::TypeInfo<ClassType>(),
        bindings_internal::TypeInfo<BaseClass>(),
        ref_counted_offset
      );
  }

  template<typename FieldType>
  const class_& property(const char* name,
      FieldType (ClassType::*getter)() const,
      void (ClassType::*setter)(FieldType) = nullptr) const
  {
    bindings_internal::register_property(
        bindings_internal::TypeInfo<ClassType>(), name, getter, setter);
    return *this;
  }

  const class_& class_property(const char* name,
      const char* jsValue) const
  {
    bindings_internal::register_property(
        bindings_internal::TypeInfo<ClassType>(), name,
        bindings_internal::FunctionInfo(), bindings_internal::FunctionInfo(),
        jsValue);
    return *this;
  }

  template<typename ReturnType, typename... Args>
  const class_& function(const char* name, ReturnType (ClassType::*method)(Args...)) const
  {
    bindings_internal::register_method(
        bindings_internal::TypeInfo<ClassType>(), name, method);
    return *this;
  }

  template<typename ReturnType, typename... Args>
  const class_& function(const char* name, ReturnType (ClassType::*method)(Args...) const) const
  {
    bindings_internal::register_method(
        bindings_internal::TypeInfo<ClassType>(), name, method);
    return *this;
  }

  template<typename ReturnType, typename... Args>
  const class_& class_function(const char* name, ReturnType (*method)(Args...)) const
  {
    bindings_internal::register_method(
        bindings_internal::TypeInfo<ClassType>(), name, method);
    return *this;
  }

  template<typename ReturnType,
      typename std::enable_if<std::is_convertible<ReturnType, int32_t>::value>::type* = nullptr>
  const class_& subclass_differentiator(ReturnType ClassType::* member,
      std::initializer_list<std::pair<ReturnType, const char*>> list) const
  {
    ClassType* instance = nullptr;
    size_t offset = (char*)&(instance->*member) - (char*)instance;

    std::vector<std::pair<int, std::string>> mapping;
    for (const auto& item : list)
      mapping.emplace_back(item.first, item.second);

    bindings_internal::register_differentiator(
        bindings_internal::TypeInfo<ClassType>(), offset, mapping);
    return *this;
  }
};

template<typename ClassType>
class singleton
{
public:
  singleton(const char* name, ClassType* (*instanceGetter)())
  {
    bindings_internal::register_class(name,
        bindings_internal::TypeInfo<ClassType>(),
        bindings_internal::TypeInfo<bindings_internal::NoBaseClass>(),
        0,
        instanceGetter
      );
  }

  template<typename FieldType>
  const singleton& property(const char* name,
      FieldType (ClassType::*getter)() const,
      void (ClassType::*setter)(FieldType) = nullptr) const
  {
    bindings_internal::register_property(
        bindings_internal::TypeInfo<ClassType>(), name, getter, setter);
    return *this;
  }

  template<typename ReturnType, typename... Args>
  const singleton& function(const char* name, ReturnType (ClassType::*method)(Args...)) const
  {
    bindings_internal::register_method(
        bindings_internal::TypeInfo<ClassType>(), name, method);
    return *this;
  }

  template<typename ReturnType, typename... Args>
  const singleton& function(const char* name, ReturnType (ClassType::*method)(Args...) const) const
  {
    bindings_internal::register_method(
        bindings_internal::TypeInfo<ClassType>(), name, method);
    return *this;
  }
};

void printBindings();
