import { Response } from 'express';
import { t } from './i18n';

/**
 * sendResponse — single envelope writer used by every controller.
 *
 * Sets the real HTTP status code via res.status(code) so the
 * transport layer matches the application-level outcome. Before this
 * change every response shipped as HTTP 200 regardless of outcome,
 * which made downstream tooling (proxies, CDNs, browser dev-tools
 * filtering, monitoring) treat application-level errors as
 * successes.
 *
 * Envelope shape is unchanged so the FE keeps reading
 * response.code / response.status / response.message / response.data
 * as it did before. The FE request interceptor preserves the
 * always-resolve semantics callers depend on by converting
 * HttpErrorResponses whose body carries our envelope back into a
 * success emission with the original envelope as the body — see
 * http-request.interceptor.
 *
 * Note: 440 (session expired) is non-standard but kept as-is — it is
 * the FE's session-refresh trigger and the interceptor still handles
 * it via both the success channel (legacy body-based check) and the
 * error channel (HttpErrorResponse.status === 440).
 */
export default function sendResponse(
  res: Response,
  status: boolean,
  code: number,
  message: string,
  data?: any,
) {
  const locale: string = res.locals?.locale ?? 'en';
  res.status(code).send({
    status,
    code,
    message: t(message, locale),
    data,
    meta: buildMeta(res),
  });
}

/**
 * Per-response metadata block. `requestId` lets a user paste an id from
 * a failed request into a bug report and have an operator grep the
 * logs for the matching line. `durationMs` is how long the request
 * spent on the server (high-resolution timer, rounded to ms).
 *
 * Both values are populated by RequestContextMiddleware, which is
 * mounted globally in server.ts. If the middleware is somehow
 * bypassed (a controller calls sendResponse from a non-HTTP code path,
 * for example), we degrade silently to `requestId: null,
 * durationMs: null` rather than crashing.
 */
function buildMeta(res: Response): {
  requestId: string | null;
  durationMs: number | null;
} {
  const requestId = (res.locals?.requestId as string | undefined) ?? null;
  const startedAt = res.locals?.requestStartedAt as bigint | undefined;
  const durationMs =
    typeof startedAt === 'bigint'
      ? Number((process.hrtime.bigint() - startedAt) / 1_000_000n)
      : null;
  return { requestId, durationMs };
}
