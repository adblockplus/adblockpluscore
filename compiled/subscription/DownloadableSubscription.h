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

#include <cstdint>

#include "../base.h"
#include "Subscription.h"
#include "../bindings/runtime.h"

ABP_NS_BEGIN

class DownloadableSubscription : public Subscription
{
public:
  static constexpr Type classType = Type::DOWNLOADABLE;
  explicit DownloadableSubscription(const String& id);

  SUBSCRIPTION_PROPERTY(bool, mFixedTitle, SUBSCRIPTION_FIXEDTITLE,
      GetFixedTitle, SetFixedTitle);
  SUBSCRIPTION_STRING_PROPERTY(mHomepage, SUBSCRIPTION_HOMEPAGE,
      GetHomepage, SetHomepage);
  SUBSCRIPTION_PROPERTY(uint64_t, mLastCheck, SUBSCRIPTION_LASTCHECK,
      GetLastCheck, SetLastCheck);
  SUBSCRIPTION_PROPERTY(uint64_t, mHardExpiration, NONE,
      GetHardExpiration, SetHardExpiration);
  SUBSCRIPTION_PROPERTY(uint64_t, mSoftExpiration, NONE,
      GetSoftExpiration, SetSoftExpiration);
  SUBSCRIPTION_PROPERTY(uint64_t, mLastDownload, SUBSCRIPTION_LASTDOWNLOAD,
      GetLastDownload, SetLastDownload);
  SUBSCRIPTION_STRING_PROPERTY(mDownloadStatus, SUBSCRIPTION_DOWNLOADSTATUS,
      GetDownloadStatus, SetDownloadStatus);
  SUBSCRIPTION_PROPERTY(uint64_t, mLastSuccess, NONE,
      GetLastSuccess, SetLastSuccess);
  SUBSCRIPTION_PROPERTY(int, mErrorCount, SUBSCRIPTION_ERRORS,
      GetErrorCount, SetErrorCount);
  SUBSCRIPTION_PROPERTY(uint64_t, mDataRevision, NONE,
      GetDataRevision, SetDataRevision);
  SUBSCRIPTION_STRING_PROPERTY(mRequiredVersion, NONE,
      GetRequiredVersion, SetRequiredVersion);
  SUBSCRIPTION_PROPERTY(int, mDownloadCount, NONE,
      GetDownloadCount, SetDownloadCount);

  OwnedString BINDINGS_EXPORTED Serialize() const;
};

typedef intrusive_ptr<DownloadableSubscription> DownloadableSubscriptionPtr;

ABP_NS_END