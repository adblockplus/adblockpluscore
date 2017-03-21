#include <cstdio>

#include "ActiveFilter.h"
#include "StringScanner.h"

namespace
{
  const DependentString DEFAULT_DOMAIN(u""_str);

  OwnedString to_string(unsigned int i)
  {
    char buffer[11];
    int len = sprintf(buffer, "%u", i);

    OwnedString result(len);
    for (String::size_type i = 0; i < len; i++)
      result[i] = buffer[i];
    return result;
  }
}

ActiveFilter::ActiveFilter(Type type, const String& text, bool ignoreTrailingDot)
    : Filter(type, text), mDisabled(false), mHitCount(0), mLastHit(0),
      mIgnoreTrailingDot(ignoreTrailingDot)
{
}

ActiveFilter::DomainMap* ActiveFilter::GetDomains() const
{
  return mDomains.get();
}

ActiveFilter::SitekeySet* ActiveFilter::GetSitekeys() const
{
  return mSitekeys.get();
}

void ActiveFilter::ParseDomains(const String& domains,
    String::value_type separator) const
{
  DomainMap::size_type count = 2;
  for (String::size_type i = 0; i < domains.length(); i++)
    if (domains[i] == separator)
      count++;

  mDomains.reset(new DomainMap(count));
  annotate_address(mDomains.get(), "DomainMap");

  StringScanner scanner(domains, 0, separator);
  String::size_type start = 0;
  bool reverse = false;
  bool hasIncludes = false;
  bool done = scanner.done();
  while (!done)
  {
    done = scanner.done();
    String::value_type currChar = scanner.next();
    if (currChar == u'~' && scanner.position() == start)
    {
      start++;
      reverse = true;
    }
    else if (currChar == separator)
    {
      String::size_type len = scanner.position() - start;
      if (len > 0 && mIgnoreTrailingDot && domains[start + len - 1] == '.')
        len--;
      if (len > 0)
      {
        enter_context("Adding to ActiveFilter.mDomains");
        (*mDomains)[DependentString(domains, start, len)] = !reverse;
        exit_context();

        if (!reverse)
          hasIncludes = true;
      }
      start = scanner.position() + 1;
      reverse = false;
    }
  }
  enter_context("Adding to ActiveFilter.mDomains");
  (*mDomains)[DEFAULT_DOMAIN] = !hasIncludes;
  exit_context();
}

void ActiveFilter::AddSitekey(const String& sitekey) const
{
  if (!mSitekeys)
  {
    mSitekeys.reset(new SitekeySet());
    annotate_address(mSitekeys.get(), "SitekeySet");
  }

  enter_context("Adding to ActiveFilter.mSitekeys");
  mSitekeys->insert(sitekey);
  exit_context();
}

bool ActiveFilter::IsActiveOnDomain(DependentString& docDomain, const String& sitekey) const
{
  auto sitekeys = GetSitekeys();
  if (sitekeys && !sitekeys->find(sitekey))
    return false;

  // If no domains are set the rule matches everywhere
  auto domains = GetDomains();
  if (!domains)
    return true;

  // If the document has no host name, match only if the filter isn't restricted
  // to specific domains
  if (docDomain.empty())
    return (*domains)[DEFAULT_DOMAIN];

  docDomain.toLower();

  String::size_type len = docDomain.length();
  if (len > 0 && mIgnoreTrailingDot && docDomain[len - 1] == '.')
    docDomain.reset(docDomain, 0, len - 1);
  while (true)
  {
    auto it = domains->find(docDomain);
    if (it)
      return it->second;

    String::size_type nextDot = docDomain.find(u'.');
    if (nextDot == docDomain.npos)
      break;
    docDomain.reset(docDomain, nextDot + 1);
  }
  return (*domains)[DEFAULT_DOMAIN];
}

bool ActiveFilter::IsActiveOnlyOnDomain(DependentString& docDomain) const
{
  auto domains = GetDomains();
  if (!domains || docDomain.empty() || (*domains)[DEFAULT_DOMAIN])
    return false;

  docDomain.toLower();

  String::size_type len = docDomain.length();
  if (len > 0 && mIgnoreTrailingDot && docDomain[len - 1] == '.')
    docDomain.reset(docDomain, 0, len - 1);
  for (auto it = domains->begin(); it != domains->end(); ++it)
  {
    if (!it->second || it->first.equals(docDomain))
      continue;

    size_t len1 = it->first.length();
    size_t len2 = docDomain.length();
    if (len1 > len2 &&
        DependentString(it->first, len1 - len2).equals(docDomain) &&
        it->first[len1 - len2 - 1] == u'.')
    {
      continue;
    }

    return false;
  }
  return true;
}

bool ActiveFilter::IsGeneric() const
{
  auto sitekeys = GetSitekeys();
  auto domains = GetDomains();
  return !sitekeys && (!domains || (*domains)[DEFAULT_DOMAIN]);
}

OwnedString ActiveFilter::Serialize() const
{
  /* TODO this is very inefficient */
  OwnedString result(Filter::Serialize());
  if (mDisabled)
    result.append(u"disabled=true\n"_str);
  if (mHitCount)
  {
    result.append(u"hitCount="_str);
    result.append(to_string(mHitCount));
    result.append(u'\n');
  }
  if (mLastHit)
  {
    result.append(u"lastHit="_str);
    result.append(to_string(mLastHit));
    result.append(u'\n');
  }
  return result;
}
