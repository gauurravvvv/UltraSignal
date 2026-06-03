import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { CODE } from '../../../config/config';
import sendResponse from './response';

type ValidationSource = 'body' | 'params' | 'query';

/**
 * Generic Joi validation middleware factory.
 *
 * Usage in routes:
 *   router.post('/add', AuthMiddleware, validate(schema), controller.add);
 *
 * Or inside a validation middleware:
 *   const { error, value } = validateSchema(schema, req.body);
 *
 * Features:
 *   - Returns first validation error (abortEarly: true)
 *   - Strips unknown fields (prevents injection of extra fields)
 *   - Replaces req[source] with sanitized values (trimmed, lowercased, etc.)
 *   - Error messages without quoted field labels
 */
export const validate = (
  schema: Joi.ObjectSchema,
  source: ValidationSource = 'body',
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: true,
      stripUnknown: true,
      errors: { wrap: { label: false } },
    });

    if (error) {
      return sendResponse(
        res,
        false,
        CODE.BAD_REQUEST,
        error.details[0].message,
      );
    }

    req[source] = value;
    next();
  };
};

/**
 * Inline schema validation (for use inside middleware functions
 * that need additional logic like role checks or DB lookups).
 *
 * Returns { error, value } — caller handles the error.
 *
 * Usage:
 *   const { error, value } = validateSchema(schema, req.body);
 *   if (error) return sendResponse(res, false, 400, error);
 *   req.body = value;
 */
export const validateSchema = (
  schema: Joi.ObjectSchema,
  data: any,
): { error: string | null; value: any } => {
  const result = schema.validate(data, {
    abortEarly: true,
    stripUnknown: true,
    errors: { wrap: { label: false } },
  });

  if (result.error) {
    return { error: result.error.details[0].message, value: null };
  }

  return { error: null, value: result.value };
};
