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

#include "Subscription.h"

class DownloadableSubscription : public Subscription
{
public:
  explicit DownloadableSubscription(const String& id);

  SUBSCRIPTION_PROPERTY(bool, mFixedTitle, GetFixedTitle, SetFixedTitle);
  SUBSCRIPTION_STRING_PROPERTY(mHomepage, GetHomepage, SetHomepage);
  SUBSCRIPTION_PROPERTY(uint64_t, mLastCheck, GetLastCheck, SetLastCheck);
  SUBSCRIPTION_PROPERTY(uint64_t, mHardExpiration, GetHardExpiration, SetHardExpiration);
  SUBSCRIPTION_PROPERTY(uint64_t, mSoftExpiration, GetSoftExpiration, SetSoftExpiration);
  SUBSCRIPTION_PROPERTY(uint64_t, mLastDownload, GetLastDownload, SetLastDownload);
  SUBSCRIPTION_STRING_PROPERTY(mDownloadStatus, GetDownloadStatus, SetDownloadStatus);
  SUBSCRIPTION_PROPERTY(uint64_t, mLastSuccess, GetLastSuccess, SetLastSuccess);
  SUBSCRIPTION_PROPERTY(int, mErrorCount, GetErrorCount, SetErrorCount);
  SUBSCRIPTION_PROPERTY(uint64_t, mDataRevision, GetDataRevision, SetDataRevision);
  SUBSCRIPTION_STRING_PROPERTY(mRequiredVersion, GetRequiredVersion, SetRequiredVersion);
  SUBSCRIPTION_PROPERTY(int, mDownloadCount, GetDownloadCount, SetDownloadCount);

  EMSCRIPTEN_KEEPALIVE OwnedString Serialize() const;
};
