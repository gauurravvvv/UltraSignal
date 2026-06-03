/**
 * RequestContextMiddleware — stamps a per-request id + start time so every
 * response envelope can include `meta.requestId` and `meta.durationMs`.
 *
 * The id flows three ways:
 *   - res.locals.requestId  → read by sendResponse() to populate the envelope.
 *   - X-Request-Id header   → echoed on the response so operators can grep
 *                             access logs / CDN traces for the same request.
 *   - inbound X-Request-Id  → if the client (or a frontend reverse proxy)
 *                             supplies one we trust and reuse it, instead of
 *                             minting a new UUID. Lets the FE correlate a
 *                             request across services.
 *
 * `crypto.randomUUID()` is Node 18+ built-in; no new dependency.
 *
 * Mounted before every other middleware in server.ts so even rejections
 * from rate-limiter / auth / validation carry the id.
 */
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

const REQUEST_ID_HEADER = 'x-request-id';

const RequestContextMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const incoming = req.header(REQUEST_ID_HEADER);
  const requestId = isSafeIncomingId(incoming) ? incoming! : randomUUID();

  res.locals.requestId = requestId;
  res.locals.requestStartedAt = process.hrtime.bigint();
  res.setHeader('X-Request-Id', requestId);

  next();
};

/**
 * Keep the incoming id only if it's a plausibly-formatted opaque token —
 * UUID-like, ULID, or any printable token under 128 chars without
 * whitespace. Anything else gets dropped and we mint a fresh UUID. This
 * stops a malicious caller from stuffing CRLF / control characters into
 * our logs via the header.
 */
function isSafeIncomingId(value: string | undefined): boolean {
  if (!value) return false;
  if (value.length === 0 || value.length > 128) return false;
  return /^[A-Za-z0-9._-]+$/.test(value);
}

export default RequestContextMiddleware;
