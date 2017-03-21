#pragma once

#include <vector>

#include "String.h"
#include "intrusive_ptr.h"
#include "debug.h"

class Filter : public ref_counted
{
protected:
  OwnedString mText;

public:
  enum Type
  {
    UNKNOWN = 0,
    INVALID = 1,
    COMMENT = 2,
    BLOCKING = 3,
    WHITELIST = 4,
    ELEMHIDE = 5,
    ELEMHIDEEXCEPTION = 6,
    CSSPROPERTY = 7,
  };

  explicit Filter(Type type, const String& text);
  ~Filter();

  Type mType;

  /* TODO
  std::vector<Subscription> mSubscriptions;
  */

  EMSCRIPTEN_KEEPALIVE const String& GetText() const
  {
    return mText;
  }

  EMSCRIPTEN_KEEPALIVE OwnedString Serialize() const;

  static EMSCRIPTEN_KEEPALIVE Filter* FromText(DependentString& text);
};

typedef intrusive_ptr<Filter> FilterPtr;
