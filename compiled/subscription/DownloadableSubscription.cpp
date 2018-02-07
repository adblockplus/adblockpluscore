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

#include "DownloadableSubscription.h"

ABP_NS_USING

DownloadableSubscription::DownloadableSubscription(const String& id)
    : Subscription(classType, id), mFixedTitle(false), mLastCheck(0),
      mHardExpiration(0), mSoftExpiration(0), mLastDownload(0), mLastSuccess(0),
      mErrorCount(0), mDataRevision(0), mDownloadCount(0)
{
  SetTitle(id);
}

OwnedString DownloadableSubscription::Serialize() const
{
  OwnedString result(Subscription::Serialize());
  if (mFixedTitle)
    result.append(u"fixedTitle=true\n"_str);
  if (!mHomepage.empty())
  {
    result.append(u"homepage="_str);
    result.append(mHomepage);
    result.append(u'\n');
  }
  if (mLastCheck)
  {
    result.append(u"lastCheck="_str);
    result.append(mLastCheck);
    result.append(u'\n');
  }
  if (mHardExpiration)
  {
    result.append(u"expires="_str);
    result.append(mHardExpiration);
    result.append(u'\n');
  }
  if (mSoftExpiration)
  {
    result.append(u"softExpiration="_str);
    result.append(mSoftExpiration);
    result.append(u'\n');
  }
  if (mLastDownload)
  {
    result.append(u"lastDownload="_str);
    result.append(mLastDownload);
    result.append(u'\n');
  }
  if (!mDownloadStatus.empty())
  {
    result.append(u"downloadStatus="_str);
    result.append(mDownloadStatus);
    result.append(u'\n');
  }
  if (mLastSuccess)
  {
    result.append(u"lastSuccess="_str);
    result.append(mLastSuccess);
    result.append(u'\n');
  }
  if (mErrorCount)
  {
    result.append(u"errors="_str);
    result.append(mErrorCount);
    result.append(u'\n');
  }
  if (mDataRevision)
  {
    result.append(u"version="_str);
    result.append(mDataRevision);
    result.append(u'\n');
  }
  if (!mRequiredVersion.empty())
  {
    result.append(u"requiredVersion="_str);
    result.append(mRequiredVersion);
    result.append(u'\n');
  }
  if (mDownloadCount)
  {
    result.append(u"downloadCount="_str);
    result.append(mDownloadCount);
    result.append(u'\n');
  }
  return result;
}
