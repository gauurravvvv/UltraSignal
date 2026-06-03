/**
 * idFromParam — bridge middleware for the REST migration.
 *
 * Historically every PUT endpoint took the resource id in the request
 * body (`{ id, name, ... }`). The REST migration moves the id into the
 * URL path. Rather than rewrite every validation schema and controller
 * to read from `req.params`, this small middleware copies the path
 * param into `req.body[<bodyField>]` before the validation middleware
 * runs. The downstream code stays exactly as it was.
 *
 * Usage:
 *   router.put(
 *     '/:orgId/:analysisId',
 *     idFromParam('analysisId', 'id'),   // copies req.params.analysisId → req.body.id
 *     ...validation, controller,
 *   );
 *
 *   router.put(
 *     '/:orgId/:datasetId/fields/:fieldId',
 *     idFromParam('fieldId', 'fieldId'), // copies req.params.fieldId → req.body.fieldId
 *     ...,
 *   );
 *
 * Why a middleware and not a one-liner per route: a few endpoints
 * already validate that body.id is a uuid and that fields.id is
 * required — we want that validation to keep firing exactly as it
 * does today. This middleware is invisible to the validation layer.
 */
import { NextFunction, Request, Response } from 'express';

export const idFromParam =
  (paramName: string, bodyField = 'id') =>
  (req: Request, _res: Response, next: NextFunction) => {
    const value = req.params[paramName];
    if (value !== undefined) {
      req.body = { ...(req.body || {}), [bodyField]: value };
    }
    next();
  };
