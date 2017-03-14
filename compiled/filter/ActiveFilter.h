#pragma once

#include <emscripten.h>

#include "Filter.h"
#include "../StringMap.h"

#define FILTER_PROPERTY(type, name, getter, setter) \
    private:\
      type name;\
    public:\
      type EMSCRIPTEN_KEEPALIVE getter() const\
      {\
        return name;\
      }\
      void EMSCRIPTEN_KEEPALIVE setter(type value)\
      {\
        if (name != value)\
        {\
          type oldvalue = name;\
          name = value;\
          DependentString action(u"filter."_str #name);\
          EM_ASM_ARGS({\
            var filter = new (exports[Filter_mapping[$2]])($1);\
            FilterNotifier.triggerListeners(readString($0), filter, $3, $4);\
          }, &action, this, mType, value, oldvalue);\
        }\
      }

class ActiveFilter : public Filter
{
protected:
  typedef StringMap<bool> DomainMap;
  typedef StringSet SitekeySet;
  void ParseDomains(const String& domains, String::value_type separator) const;
  void AddSitekey(const String& sitekey) const;
  virtual DomainMap* GetDomains() const;
  virtual SitekeySet* GetSitekeys() const;
  mutable std::unique_ptr<DomainMap> mDomains;
  mutable std::unique_ptr<SitekeySet> mSitekeys;
private:
  bool mIgnoreTrailingDot;
public:
  explicit ActiveFilter(Type type, const String& text, bool ignoreTrailingDot);
  FILTER_PROPERTY(bool, mDisabled, GetDisabled, SetDisabled);
  FILTER_PROPERTY(unsigned int, mHitCount, GetHitCount, SetHitCount);
  FILTER_PROPERTY(unsigned int, mLastHit, GetLastHit, SetLastHit);
  bool EMSCRIPTEN_KEEPALIVE IsActiveOnDomain(DependentString& docDomain,
      const String& sitekey) const;
  bool EMSCRIPTEN_KEEPALIVE IsActiveOnlyOnDomain(DependentString& docDomain) const;
  bool EMSCRIPTEN_KEEPALIVE IsGeneric() const;
  OwnedString EMSCRIPTEN_KEEPALIVE Serialize() const;
};
