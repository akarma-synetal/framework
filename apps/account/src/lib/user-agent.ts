// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Best-effort User-Agent string parser. We deliberately avoid pulling in a
 * full UA-parser dependency — we only need enough resolution to pick an
 * icon and a friendly label for the sessions list.
 */

import {
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  type LucideIcon,
} from 'lucide-react';

export interface ParsedUserAgent {
  browser: string;
  os: string;
  device: 'mobile' | 'tablet' | 'desktop';
  /** Human-readable summary used as the session row title. */
  label: string;
  icon: LucideIcon;
}

const BROWSER_PATTERNS: Array<[RegExp, string]> = [
  [/Edg\//i, 'Edge'],
  [/OPR\//i, 'Opera'],
  [/Chrome\//i, 'Chrome'],
  [/Firefox\//i, 'Firefox'],
  [/Safari\//i, 'Safari'],
];

const OS_PATTERNS: Array<[RegExp, string]> = [
  [/Windows NT 10/i, 'Windows 10/11'],
  [/Windows/i, 'Windows'],
  [/Mac OS X|Macintosh/i, 'macOS'],
  [/iPhone|iOS/i, 'iOS'],
  [/iPad/i, 'iPadOS'],
  [/Android/i, 'Android'],
  [/Linux/i, 'Linux'],
];

export function parseUserAgent(ua: string | undefined): ParsedUserAgent {
  if (!ua) {
    return {
      browser: 'Unknown',
      os: 'Unknown',
      device: 'desktop',
      label: 'Unknown device',
      icon: Globe,
    };
  }

  const browser =
    BROWSER_PATTERNS.find(([re]) => re.test(ua))?.[1] ?? 'Browser';
  const os = OS_PATTERNS.find(([re]) => re.test(ua))?.[1] ?? 'Unknown OS';

  const isTablet = /iPad|Tablet/i.test(ua);
  const isMobile = !isTablet && /Mobile|Android|iPhone|iPod/i.test(ua);
  const device: ParsedUserAgent['device'] = isTablet
    ? 'tablet'
    : isMobile
      ? 'mobile'
      : 'desktop';

  let icon: LucideIcon = Monitor;
  if (device === 'mobile') icon = Smartphone;
  else if (device === 'tablet') icon = Tablet;
  else if (/Linux|Windows|Mac/i.test(ua)) icon = Monitor;
  else icon = Globe;

  return {
    browser,
    os,
    device,
    label: `${browser} · ${os}`,
    icon,
  };
}
