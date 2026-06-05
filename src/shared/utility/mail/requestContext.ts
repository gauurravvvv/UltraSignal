import { Request } from 'express';

/**
 * Security context captured at the moment a sensitive operation
 * (password reset, password change) was initiated. Surfaced in
 * the resulting email so the recipient can spot account takeover —
 * the same "from IP / device / time" line that GitHub, Slack,
 * Notion, Linear, etc. include in their transactional mail.
 */
export interface RequestContext {
  ip: string;
  userAgent: string;
  timestamp: Date;
}

/**
 * Build a `RequestContext` from an Express `req`, extracting the
 * caller's IP and user agent for inclusion in transactional emails.
 */
export const buildRequestContext = (req: Request): RequestContext => ({
  ip:
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.ip ||
    '',
  userAgent: (req.headers['user-agent'] as string) || '',
  timestamp: new Date(),
});

/**
 * Format a `Date` as ISO 8601 with the UTC offset spelled out.
 * Example: `2026-05-25 14:30:00 UTC`.
 *
 * Always rendered in UTC because the BE has no way to know the
 * recipient's preferred timezone. UTC + a clear label is the
 * least-ambiguous choice for mail that may be opened anywhere.
 */
export const formatRequestTimestamp = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`
  );
};
