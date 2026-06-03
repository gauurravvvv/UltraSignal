/**
 * SanitizeOrgInputMiddleware — strips any client-supplied organisation key
 * from `req.body`, `req.params`, and `req.query` before any downstream
 * validation or controller can see it.
 *
 * The JWT is the only signed source of org identity. `AuthMiddleware`
 * decodes it and sets `res.locals.organisationId`; every protected
 * route's controller is expected to source the caller's org id from
 * there (or via `res.locals.orgData.id` once `VerifyResourceMiddleware`
 * runs). Anything the FE sends in body / params / query is irrelevant
 * to the BE and is dropped here.
 *
 * Why a sanitizer instead of trusting per-validation diligence:
 *   - Some Joi schemas previously declared `organisation: Joi.string()
 *     .required()` and used the value in DB queries. A regression that
 *     ships a foreign org id from the FE would have been honoured. Even
 *     after those validations were rewritten, this middleware is a
 *     defensive net so a future careless commit can't reintroduce the
 *     gap.
 *   - Joi's `stripUnknown: true` only drops fields that are NOT in the
 *     schema. A declared `organisation` field would survive. The
 *     sanitizer kicks in BEFORE Joi, so even if a schema declares the
 *     field, it's already gone.
 *
 * Pre-JWT routes (`/api/v1/auth/*`) are mounted in `server.ts` BEFORE
 * this middleware, so login / refresh-token / forgot-password / OTP
 * still receive the `organisation` (name) body field they need to
 * route the caller to the right org before issuing a JWT.
 */
import { NextFunction, Request, Response } from 'express';
import Logger from '../utility/logger/logger';

const FORBIDDEN_KEYS = ['organisation', 'organisationId', 'orgId'];

const stripKeys = (
  obj: Record<string, unknown> | undefined,
  source: 'body' | 'params' | 'query',
  path: string,
): void => {
  if (!obj || typeof obj !== 'object') return;
  for (const key of FORBIDDEN_KEYS) {
    if (key in obj) {
      Logger.debug(`SanitizeOrgInput: dropped req.${source}.${key} on ${path}`);
      delete obj[key];
    }
  }
};

const SanitizeOrgInputMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  stripKeys(req.body as Record<string, unknown>, 'body', req.path);
  stripKeys(
    req.params as unknown as Record<string, unknown>,
    'params',
    req.path,
  );
  stripKeys(req.query as Record<string, unknown>, 'query', req.path);
  next();
};

export default SanitizeOrgInputMiddleware;
