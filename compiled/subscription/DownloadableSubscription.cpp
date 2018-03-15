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
    result.append(ABP_TEXT("fixedTitle=true\n"_str));
  if (!mHomepage.empty())
  {
    result.append(ABP_TEXT("homepage="_str));
    result.append(mHomepage);
    result.append(ABP_TEXT('\n'));
  }
  if (mLastCheck)
  {
    result.append(ABP_TEXT("lastCheck="_str));
    result.append(mLastCheck);
    result.append(ABP_TEXT('\n'));
  }
  if (mHardExpiration)
  {
    result.append(ABP_TEXT("expires="_str));
    result.append(mHardExpiration);
    result.append(ABP_TEXT('\n'));
  }
  if (mSoftExpiration)
  {
    result.append(ABP_TEXT("softExpiration="_str));
    result.append(mSoftExpiration);
    result.append(ABP_TEXT('\n'));
  }
  if (mLastDownload)
  {
    result.append(ABP_TEXT("lastDownload="_str));
    result.append(mLastDownload);
    result.append(ABP_TEXT('\n'));
  }
  if (!mDownloadStatus.empty())
  {
    result.append(ABP_TEXT("downloadStatus="_str));
    result.append(mDownloadStatus);
    result.append(ABP_TEXT('\n'));
  }
  if (mLastSuccess)
  {
    result.append(ABP_TEXT("lastSuccess="_str));
    result.append(mLastSuccess);
    result.append(ABP_TEXT('\n'));
  }
  if (mErrorCount)
  {
    result.append(ABP_TEXT("errors="_str));
    result.append(mErrorCount);
    result.append(ABP_TEXT('\n'));
  }
  if (mDataRevision)
  {
    result.append(ABP_TEXT("version="_str));
    result.append(mDataRevision);
    result.append(ABP_TEXT('\n'));
  }
  if (!mRequiredVersion.empty())
  {
    result.append(ABP_TEXT("requiredVersion="_str));
    result.append(mRequiredVersion);
    result.append(ABP_TEXT('\n'));
  }
  if (mDownloadCount)
  {
    result.append(ABP_TEXT("downloadCount="_str));
    result.append(mDownloadCount);
    result.append(ABP_TEXT('\n'));
  }
  return result;
}
