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
 * along with Adblock Plus. If not, see <http://www.gnu.org/licenses/>.
 */

#pragma once

// ABP_NS, ABP_NS_BEGIN, ABP_NS_END and ABP_NS_USING allow to put the code of
// this library into ABP_NS namespace. The easiest way to do it is to define
// ABP_NS on the next line.
//#define ABP_NS abp_core
#if defined(ABP_NS)
#define ABP_NS_BEGIN namespace ABP_NS {
#define ABP_NS_END }
#define ABP_NS_USING using namespace ABP_NS;
#else
#define ABP_NS
#define ABP_NS_BEGIN
#define ABP_NS_END
#define ABP_NS_USING
#endif

