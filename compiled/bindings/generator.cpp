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

#include <cstdio>

#include "generator.h"
#include "library.h"

namespace
{
  std::vector<bindings_internal::ClassInfo> classes;
}

namespace bindings_internal
{
  FunctionInfo::FunctionInfo()
  {
  }

  FunctionInfo::FunctionInfo(TypeCategory returnType, TYPEID pointerType,
      std::initializer_list<TypeCategory> argTypes, bool instance_function,
      void* function)
      : returnType(returnType), pointerType(pointerType),
        instance_function(instance_function)
  {
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
      case TypeCategory::CLASS_REF:
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
        case TypeCategory::CLASS_REF:
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

    int nameLength = GetFunctionName(nullptr, function, signature.c_str());
    name.resize(nameLength);
    GetFunctionName(name.data(), function, signature.c_str());
  }

  bool FunctionInfo::empty() const
  {
    return name.empty();
  }

  ClassInfo* find_class(TYPEID classID)
  {
    for (auto& classInfo : classes)
      if (classInfo.id == classID)
        return &classInfo;
    return nullptr;
  }

  void register_class(const char* name, TYPEID classID, TYPEID baseClassID,
                      ptrdiff_t ref_counted_offset,
                      const FunctionInfo& instanceGetter)
  {
    if (find_class(classID))
      throw std::runtime_error(std::string("Duplicate definition for class ") + name);

    if (baseClassID != TypeInfo<NoBaseClass>() && !find_class(baseClassID))
      throw std::runtime_error(std::string("Unknown base class defined for class ") + name);

    ClassInfo classInfo;
    classInfo.id = classID;
    classInfo.baseClass = baseClassID;
    classInfo.name = name;
    classInfo.subclass_differentiator.offset = SIZE_MAX;
    classInfo.ref_counted_offset = ref_counted_offset;
    classInfo.instanceGetter = instanceGetter;
    classes.push_back(classInfo);
  }

  void register_property(TYPEID classID, const char* name,
      const FunctionInfo& getter, const FunctionInfo& setter,
      const char* jsValue)
  {
    ClassInfo* classInfo = find_class(classID);
    if (!classInfo)
      throw std::runtime_error(std::string("Property defined on unknown class: ") + name);

    PropertyInfo propertyInfo;
    propertyInfo.name = name;
    propertyInfo.getter = getter;
    propertyInfo.setter = setter;
    propertyInfo.jsValue = jsValue;
    classInfo->properties.push_back(propertyInfo);
  }

  void register_method(TYPEID classID, const char* name,
      const FunctionInfo& call)
  {
    ClassInfo* classInfo = find_class(classID);
    if (!classInfo)
      throw std::runtime_error(std::string("Method defined on unknown class: ") + name);

    MethodInfo methodInfo;
    methodInfo.name = name;
    methodInfo.call = call;
    classInfo->methods.push_back(methodInfo);
  }

  void register_differentiator(TYPEID classID, size_t offset,
      std::vector<std::pair<int, std::string>>& mapping)
  {
    ClassInfo* classInfo = find_class(classID);
    if (!classInfo)
      throw std::runtime_error("Subclass differentiator defined on unknown class");

    if (classInfo->subclass_differentiator.offset != SIZE_MAX)
      throw std::runtime_error("More than one subclass differentiator defined for class " + classInfo->name);

    DifferentiatorInfo differentiatorInfo;
    differentiatorInfo.offset = offset;
    differentiatorInfo.mapping = mapping;
    classInfo->subclass_differentiator = differentiatorInfo;
  }

  std::string generateCall(const FunctionInfo& call,
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
      {
        std::string result;
        result += "  var string = createString();\n";
        result += "  " + call_str + ";\n";
        result += "  var result = readString(string);\n";
        // We don't call a destructor here because we know that dependent
        // strings don't need to clean up.
        return result;
      }
      case TypeCategory::OWNED_STRING:
      {
        std::string result;
        result += "  var string = createOwnedString();\n";
        result += "  " + call_str + ";\n";
        result += "  var result = readString(string);\n";
        result += "  Module._DestroyString(string);\n";
        return result;
      }
      case TypeCategory::STRING_REF:
        return "  var result = readString(" + call_str + ");\n";
      case TypeCategory::CLASS_PTR:
      case TypeCategory::CLASS_REF:
      {
        std::string result;
        result += "  var result = " + call_str + ";\n";
        result += "  if (result)\n";

        const ClassInfo* cls = find_class(call.pointerType);
        if (!cls)
          throw std::runtime_error("Function " + call.name + " returns pointer to unknown class");

        auto offset = cls->subclass_differentiator.offset;
        if (offset == SIZE_MAX)
          result += "    result = exports." + cls->name + "(result);\n";
        else
          result += "    result = exports." + cls->name + ".fromPointer(result);\n";

        result += "  else\n";
        result += "    result = null;\n";
        return result;
      }
      default:
        throw std::runtime_error("Unexpected return type for " + call.name);
    }
  }

  std::string wrapCall(const FunctionInfo& call, bool isFunction,
      const FunctionInfo& instanceGetter)
  {
    bool hasStringArgs = false;
    std::vector<std::string> params;
    std::string prefix;

    if (isFunction)
      prefix += "function";
    prefix += "(";
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
        params.push_back(argName + " ? " + argName + "._pointer : 0");
      else if (call.args[i] == TypeCategory::CLASS_REF)
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
    {
      if (instanceGetter.empty())
        params.insert(params.begin(), "this._pointer");
      else
        params.insert(params.begin(), instanceGetter.name + "()");
    }

    return prefix + generateCall(call, params) + suffix;
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

      function createOwnedString()
      {
        var result = Runtime.stackAlloc(sizeofString);
        Module._InitOwnedString(result);
        return result;
      }

      function readString(str)
      {
        var length = Module._GetStringLength(str);
        var pointer = Module._GetStringData(str) >> 1;
        return String.fromCharCode.apply(String, HEAP16.slice(pointer, pointer + length));
      }

      function createClass(superclass, ref_counted_offset, props)
      {
        var result = function(pointer)
        {
          this._pointer = pointer;
        };
        var proto = (superclass ? superclass.prototype : null);
        result.prototype = Object.create(proto, Object.getOwnPropertyDescriptors(props));
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
    // Begin class definition
    bool singleton = !cls.instanceGetter.empty();
    if (singleton)
      printf("exports.%s = {\n", cls.name.c_str());
    else
    {
      ClassInfo* baseClass = find_class(cls.baseClass);
      printf("exports.%s = createClass(%s, %i, {\n", cls.name.c_str(),
          (baseClass ? ("exports." + baseClass->name).c_str() : "null"),
          cls.ref_counted_offset);
    }

    // Print prototype members
    for (const auto& property : cls.properties)
    {
      if (property.jsValue.empty())
      {
        printf("get %s%s,\n", property.name.c_str(),
               wrapCall(property.getter, false, cls.instanceGetter).c_str());
        if (!property.setter.empty())
        {
          printf("set %s%s,\n", property.name.c_str(),
                 wrapCall(property.setter, false, cls.instanceGetter).c_str());
        }
      }
      else
        printf("%s: %s,\n", property.name.c_str(), property.jsValue.c_str());
    }

    for (const auto& method : cls.methods)
    {
      if (method.call.instance_function)
      {
        printf("%s: %s,\n",
            method.name.c_str(),
            wrapCall(method.call, true, cls.instanceGetter).c_str());
      }
    }

    // End class definition
    if (singleton)
      printf("};\n");
    else
      printf("});\n");

    // Print static members
    DifferentiatorInfo differentiator = cls.subclass_differentiator;
    if (differentiator.offset != SIZE_MAX)
    {
      printf("exports.%s.fromPointer = function(ptr)\n", cls.name.c_str());
      puts("{");
      printf("  var type = HEAP32[ptr + %i >> 2];\n", differentiator.offset);
      printf("  if (type in %s_mapping)\n", cls.name.c_str());
      printf("    return new %s_mapping[type](ptr);\n", cls.name.c_str());
      printf("  throw new Error('Unexpected %s type: ' + type);\n", cls.name.c_str());
      puts("};");
    }
    else
    {
      printf("exports.%s.fromPointer = function(ptr)\n", cls.name.c_str());
      puts("{");
      printf("  return new exports.%s(ptr);\n", cls.name.c_str());
      puts("};");
    }

    for (const auto& method : cls.methods)
    {
      if (!method.call.instance_function)
      {
        printf("exports.%s.%s = %s;\n", cls.name.c_str(), method.name.c_str(),
               wrapCall(method.call).c_str());
      }
    }
  }

  void printClassMapping(const ClassInfo& cls)
  {
      DifferentiatorInfo differentiator = cls.subclass_differentiator;
      if (differentiator.offset == SIZE_MAX)
        return;

      printf("var %s_mapping = \n", cls.name.c_str());
      puts("{");
      for (const auto& item : differentiator.mapping)
        printf("  %i: exports.%s,\n", item.first, item.second.c_str());
      puts("};");
  }
}

void printBindings()
{
  bindings_internal::printHelpers();

  for (const auto& cls : classes)
    bindings_internal::printClass(cls);
  for (const auto& cls : classes)
    bindings_internal::printClassMapping(cls);
}
