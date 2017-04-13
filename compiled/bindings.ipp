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

#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <exception>
#include <map>
#include <string>
#include <type_traits>
#include <utility>
#include <vector>

#include <emscripten.h>

#include "String.h"
#include "intrusive_ptr.h"

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
    char name[1024];

    FunctionInfo()
    {
      name[0] = '\0';
    }

    FunctionInfo(TypeCategory returnType, TYPEID pointerType,
        std::initializer_list<TypeCategory> argTypes, bool instance_function,
        void* function)
        : returnType(returnType), pointerType(pointerType),
          instance_function(instance_function)
    {
      name[0] = '\0';

      // The function parameter is a pointer to the function pointer.
      // Emscripten's "function pointers" are actually integers indicating the
      // position in the call table. 0 represents nullptr.
      if (!*reinterpret_cast<int*>(function))
        return;

      std::string signature;

      // Add return type to the signature. Similar logic in Emscripten:
      // https://github.com/kripken/emscripten/blob/1.37.3/src/modules.js#L46
      switch (returnType)
      {
        case TypeCategory::DEPENDENT_STRING:
        case TypeCategory::OWNED_STRING:
          // Technically, objects aren't really returned with clang. The caller
          // instead adds the reference to the resulting object as an implicit
          // parameter.
          signature += "vi";
          break;
        case TypeCategory::VOID:
          signature += 'v';
          break;
        case TypeCategory::FLOAT:
          signature += 'f';
          break;
        case TypeCategory::DOUBLE:
          signature += 'd';
          break;
        case TypeCategory::INT:
        case TypeCategory::INT64:
        case TypeCategory::STRING_REF:
        case TypeCategory::CLASS_PTR:
          signature += 'i';
          break;
        default:
          throw std::runtime_error("Unexpected function return type");
      }

      // `this` pointer is an implicit parameter with clang and should be added
      // to the signature.
      if (instance_function)
        signature += 'i';

      // Add explicit parameters to the signature, Similar logic in Emscripten:
      // https://github.com/kripken/emscripten/blob/1.37.3/src/modules.js#L67
      for (const auto& type : argTypes)
      {
        switch (type)
        {
          case TypeCategory::INT:
          case TypeCategory::STRING_REF:
          case TypeCategory::CLASS_PTR:
            signature += 'i';
            break;
          case TypeCategory::INT64:
            // See https://github.com/kripken/emscripten/blob/1.37.3/src/modules.js#L73,
            // numerical types larger than 32-bit are split into multiple
            // 32-bit parameters.
            signature += "ii";
            break;
          case TypeCategory::FLOAT:
            signature += 'f';
            break;
          case TypeCategory::DOUBLE:
            signature += 'd';
            break;
          default:
            throw std::runtime_error("Unexpected function argument type");
        }
        args.push_back(type);
      }

      get_function_name(function, signature.c_str());
    }

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

    bool empty() const
    {
      return name[0] == '\0';
    }

    void get_function_name(void* ptr, const char* signature)
    {
      // This is a hack, C++ won't let us get the mangled function name.
      // JavaScript is more dynamic so we pass the pointer to our function
      // there. With that and the function signature we can call the function -
      // with a full stack so that we will cause it to abort. Sometimes the
      // function we are calling will also be missing from the build. The result
      // is the same: abort() is called which in turn calls stackTrace(). By
      // replacing stackTrace() we get access to the call stack and search it
      // for the name of our function.

      EM_ASM_ARGS({
        var signature = AsciiToString($2);
        var args = [];
        for (var i = 1; i < signature.length; i++)
          args.push(0);

        var oldPrint = Module.print;
        var oldPrintErr = Module.printErr;
        var oldStackTrace = stackTrace;
        var sp = Runtime.stackSave();
        Module.print = function(){};
        Module.printErr = function(){};
        stackTrace = function()
        {
          var stack = [];
          for (var f = arguments.callee.caller; f; f = f.caller)
          {
            if (f.name)
            {
              if (f.name.indexOf("dynCall") == 0)
                break;
              else
                stack.push(f.name);
            }
          }

          result = stack[stack.length - 1];
          if (result && result.indexOf("__wrapper") >= 0)
            result = stack[stack.length - 2];
          throw result;
        };

        Runtime.stackRestore(STACK_MAX);

        try
        {
          Runtime.dynCall(signature, HEAP32[$1 >> 2], args);
        }
        catch(e)
        {
          Module.stringToAscii(e, $0);
        }
        finally
        {
          Runtime.stackRestore(sp);
          Module.print = oldPrint;
          Module.printErr = oldPrintErr;
          stackTrace = oldStackTrace;
        }
      }, name, ptr, signature);
    }
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

  struct ClassInfo
  {
    ClassInfo* baseClass;
    std::string name;
    std::vector<PropertyInfo> properties;
    std::vector<MethodInfo> methods;
    std::vector<FunctionInfo> initializers;
    DifferentiatorInfo subclass_differentiator;
    ptrdiff_t ref_counted_offset;
  };

  std::map<TYPEID, ClassInfo> classes;

  void register_class(const char* name, TYPEID classID, TYPEID baseClassID,
                      ptrdiff_t ref_counted_offset)
  {
    auto it = classes.find(classID);
    if (it != classes.end())
      throw std::runtime_error(std::string("Duplicate definition for class ") + name);

    ClassInfo* baseClass = nullptr;
    if (baseClassID != TypeInfo<NoBaseClass>())
    {
      it = classes.find(baseClassID);
      if (it == classes.end())
        throw std::runtime_error(std::string("Unknown base class defined for class ") + name);
      baseClass = &(it->second);
    }

    ClassInfo classInfo;
    classInfo.baseClass = baseClass;
    classInfo.name = name;
    classInfo.subclass_differentiator.offset = SIZE_MAX;
    classInfo.ref_counted_offset = ref_counted_offset;
    classes[classID] = classInfo;
  }

  void register_property(TYPEID classID, const char* name,
      const FunctionInfo& getter, const FunctionInfo& setter,
      const char* jsValue = "")
  {
    auto it = classes.find(classID);
    if (it == classes.end())
      throw std::runtime_error(std::string("Property defined on unknown class: ") + name);

    PropertyInfo propertyInfo;
    propertyInfo.name = name;
    propertyInfo.getter = getter;
    propertyInfo.setter = setter;
    propertyInfo.jsValue = jsValue;
    it->second.properties.push_back(propertyInfo);
  }

  void register_method(TYPEID classID, const char* name,
      const FunctionInfo& call)
  {
    auto it = classes.find(classID);
    if (it == classes.end())
      throw std::runtime_error(std::string("Method defined on unknown class: ") + name);

    MethodInfo methodInfo;
    methodInfo.name = name;
    methodInfo.call = call;
    it->second.methods.push_back(methodInfo);
  }

  void register_initializer(TYPEID classID, const FunctionInfo& call)
  {
    auto it = classes.find(classID);
    if (it == classes.end())
      throw std::runtime_error("Initializer defined on unknown class");

    it->second.initializers.push_back(call);
  }

  void register_differentiator(TYPEID classID, size_t offset,
      std::vector<std::pair<int, std::string>>& mapping)
  {
    auto it = classes.find(classID);
    if (it == classes.end())
      throw std::runtime_error("Subclass differentiator defined on unknown class");

    if (it->second.subclass_differentiator.offset != SIZE_MAX)
      throw std::runtime_error("More than one subclass differentiator defined for class " + it->second.name);

    DifferentiatorInfo differentiatorInfo;
    differentiatorInfo.offset = offset;
    differentiatorInfo.mapping = mapping;
    it->second.subclass_differentiator = differentiatorInfo;
  }

  const std::string generateCall(const FunctionInfo& call,
      std::vector<std::string>& params)
  {
    if (call.returnType == TypeCategory::DEPENDENT_STRING ||
        call.returnType == TypeCategory::OWNED_STRING)
    {
      params.insert(params.begin(), "string");
    }

    std::string call_str(call.name);
    call_str += "(";
    for (int i = 0; i < params.size(); i++)
    {
      if (i > 0)
        call_str += ", ";
      call_str += params[i];
    }
    call_str += ")";

    switch (call.returnType)
    {
      case TypeCategory::VOID:
        return "  " + call_str + ";\n";
      case TypeCategory::INT:
      case TypeCategory::FLOAT:
      case TypeCategory::DOUBLE:
        return "  var result = " + call_str + ";\n";
      case TypeCategory::INT64:
        return "  var result = Runtime.makeBigInt(" + call_str + ", " +
                                                  "Runtime.getTempRet0(), " +
                                                  "true);\n";
      case TypeCategory::DEPENDENT_STRING:
      case TypeCategory::OWNED_STRING:
      {
        std::string result;
        result += "  var string = createString();\n";
        result += "  " + call_str + ";\n";
        result += "  var result = readString(string);\n";
        if (call.returnType == TypeCategory::OWNED_STRING)
          result += "  Module._DestroyString(string);\n";
        return result;
      }
      case TypeCategory::STRING_REF:
        return "  var result = readString(" + call_str + ");\n";
      case TypeCategory::CLASS_PTR:
      {
        std::string result;
        result += "  var result = " + call_str + ";\n";
        result += "  if (result)\n";
        result += "  {\n";

        auto it = classes.find(call.pointerType);
        if (it == classes.end())
          throw std::runtime_error("Function " + std::string(call.name) + " returns pointer to unknown class");

        const ClassInfo& cls = it->second;
        auto offset = cls.subclass_differentiator.offset;
        if (offset == SIZE_MAX)
          result += "    result = " + cls.name + "(result);\n";
        else
        {
          result += "    var type = HEAP32[result + " + std::to_string(offset)+ " >> 2];\n";
          result += "    if (type in " + cls.name + "_mapping)\n";
          result += "      result = new (exports[" + cls.name + "_mapping[type]])(result);\n";
          result += "    else\n";
          result += "      throw new Error('Unexpected " + cls.name + " type: ' + type);\n";
        }

        result += "  }\n";
        result += "  else\n";
        result += "    result = null;\n";
        return result;
      }
      default:
        throw std::runtime_error("Unexpected return type for " + std::string(call.name));
    }
  }

  const std::string wrapCall(const FunctionInfo& call)
  {
    bool hasStringArgs = false;
    std::vector<std::string> params;
    std::string prefix = "function(";
    for (int i = 0; i < call.args.size(); i++)
    {
      std::string argName("arg" + std::to_string(i));
      if (i > 0)
        prefix += ", ";
      prefix += argName;

      if (call.args[i] == TypeCategory::STRING_REF)
      {
        hasStringArgs = true;
        params.push_back(std::string("createString(") + argName + ")");
      }
      else if (call.args[i] == TypeCategory::CLASS_PTR)
        params.push_back(argName + "._pointer");
      else if (call.args[i] == TypeCategory::INT64)
      {
        // 64-bit integers are passed as two integer parameters
        params.push_back(argName + " >>> 0");
        params.push_back(argName + " / 0x100000000 >>> 0");
      }
      else
        params.push_back(argName);
    }
    prefix += ")\n{\n";

    std::string suffix = "}";
    if (call.returnType != TypeCategory::VOID)
      suffix = "  return result;\n" + suffix;

    if (call.returnType == TypeCategory::DEPENDENT_STRING ||
        call.returnType == TypeCategory::OWNED_STRING || hasStringArgs)
    {
      prefix += "  var sp = Runtime.stackSave();\n";
      suffix = "  Runtime.stackRestore(sp);\n" + suffix;
    }

    if (call.instance_function)
      params.insert(params.begin(), "this._pointer");

    return prefix + generateCall(call, params) + suffix;
  }

  std::string generatePropertyDescriptor(const PropertyInfo& property)
  {
    if (!property.jsValue.empty())
      return "value: " + property.jsValue;

    std::string result("get: " + wrapCall(property.getter));
    if (!property.setter.empty())
      result += ", set: " + wrapCall(property.setter);
    return result;
  }

  void printHelpers()
  {
    printf("var sizeofString = %i;\n", sizeof(String));

    puts(R"(
      function copyString(str, buffer)
      {
        var length = str.length;
        for (var i = 0, pointer = (buffer >> 1); i < length; i++, pointer++)
          HEAP16[pointer] = str.charCodeAt(i);
        return length;
      }

      function createString(str)
      {
        var length = 0;
        var buffer = 0;
        if (str)
        {
          buffer = Runtime.stackAlloc(str.length * 2);
          length = copyString(str, buffer);
        }

        var result = Runtime.stackAlloc(sizeofString);
        Module._InitString(result, buffer, length);
        return result;
      }

      function readString(str)
      {
        var length = Module._GetStringLength(str);
        var pointer = Module._GetStringData(str) >> 1;
        return String.fromCharCode.apply(String, HEAP16.slice(pointer, pointer + length));
      }

      function createClass(superclass, ref_counted_offset)
      {
        var result = function(pointer)
        {
          this._pointer = pointer;
        };
        if (superclass)
          result.prototype = Object.create(superclass.prototype);
        result.prototype.delete = function()
        {
          Module._ReleaseRef(this._pointer + ref_counted_offset);
        };
        return result;
      }
    )");
  }

  void printClass(const ClassInfo& cls)
  {
    DifferentiatorInfo differentiator = cls.subclass_differentiator;
    if (differentiator.offset != SIZE_MAX)
    {
      printf("var %s_mapping = \n", cls.name.c_str());
      puts("{");
      for (const auto& item : differentiator.mapping)
        printf("  %i: '%s',\n", item.first, item.second.c_str());
      puts("};");
    }

    printf("exports.%s = createClass(%s, %i);\n", cls.name.c_str(),
        (cls.baseClass ? ("exports." + cls.baseClass->name).c_str() : "null"),
        cls.ref_counted_offset);

    for (const auto& item : cls.properties)
    {
      printf("Object.defineProperty(exports.%s.prototype, '%s', {%s});\n",
          cls.name.c_str(), item.name.c_str(),
          generatePropertyDescriptor(item).c_str());
    }

    for (const auto& item : cls.methods)
    {
      std::string obj("exports." + cls.name);
      if (item.call.instance_function)
        obj += ".prototype";
      printf("%s.%s = %s;\n", obj.c_str(), item.name.c_str(),
          wrapCall(item.call).c_str());
    }

    for (const auto& item : cls.initializers)
      printf("%s()\n", item.name);
  }

  void printBindings()
  {
    printHelpers();

    for (const auto& item : classes)
      printClass(item.second);
  }
}

#if defined(PRINT_BINDINGS)
  // Bindings generation step: collect bindings information and print
  // corresponding JS code.
  #define EMSCRIPTEN_BINDINGS \
      struct BindingsInitializer {\
          BindingsInitializer();\
          BindingsInitializer(bool dummy)\
          {\
            try\
            {\
              BindingsInitializer();\
              bindings_internal::printBindings();\
            }\
            catch (const std::exception& e)\
            {\
              EM_ASM_ARGS(\
                console.error("Error occurred generating JavaScript bindings: " +\
                    Module.AsciiToString($0)), e.what()\
              );\
              abort();\
            }\
          }\
      } BindingsInitializer_instance(true);\
      BindingsInitializer::BindingsInitializer()
#else
  // Actual compilation step: ignore bindings information but define some
  // exported helper functions necessary for the bindings.
  #define EMSCRIPTEN_BINDINGS \
      extern "C"\
      {\
        void EMSCRIPTEN_KEEPALIVE InitString(DependentString* str,\
            String::value_type* data, String::size_type len)\
        {\
          /* String is already allocated on stack, we merely need to call*/\
          /* constructor.*/\
          new (str) DependentString(data, len);\
        }\
        void EMSCRIPTEN_KEEPALIVE DestroyString(OwnedString* str)\
        {\
          /* Stack memory will be freed automatically, we need to call*/\
          /* destructor explicitly however.*/\
          str->~OwnedString();\
        }\
        String::size_type EMSCRIPTEN_KEEPALIVE GetStringLength(\
            const String& str)\
        {\
          return str.length();\
        }\
        const String::value_type* EMSCRIPTEN_KEEPALIVE GetStringData(\
            const String& str)\
        {\
          return str.data();\
        }\
        void EMSCRIPTEN_KEEPALIVE ReleaseRef(ref_counted* ptr)\
        {\
          ptr->ReleaseRef();\
        }\
      }\
      void BindingsInitializer_dummy()
#endif

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

  const class_& class_initializer(void (*function)()) const
  {
    bindings_internal::register_initializer(
        bindings_internal::TypeInfo<ClassType>(), function);
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
