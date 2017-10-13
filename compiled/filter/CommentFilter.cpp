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

#include "CommentFilter.h"

CommentFilter::CommentFilter(const String& text)
    : Filter(classType, text)
{
}

Filter::Type CommentFilter::Parse(const String& text)
{
  if (text.length() && text[0] == u'!')
    return Type::COMMENT;
  else
    return Type::UNKNOWN;
}

CommentFilter* CommentFilter::Create(const String& text)
{
  Type type = Parse(text);
  if (type == Type::COMMENT)
    return new CommentFilter(text);
  else
    return nullptr;
}
