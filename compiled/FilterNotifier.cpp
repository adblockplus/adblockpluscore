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

#include <emscripten.h>

#include "FilterNotifier.h"

void FilterNotifier::FilterChange(Topic topic, Filter* filter)
{
  EM_ASM_ARGS({
    FilterNotifier.triggerListeners(notifierTopics.get($0),
                                    exports.Filter.fromPointer($1));
  }, topic, filter);
}

void FilterNotifier::SubscriptionChange(Topic topic, Subscription* subscription)
{
  EM_ASM_ARGS({
    FilterNotifier.triggerListeners(notifierTopics.get($0),
                                    exports.Subscription.fromPointer($1));
  }, topic, subscription);
}
