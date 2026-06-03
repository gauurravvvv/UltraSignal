/**
 * TrimMiddleware — strips leading/trailing whitespace from every string in the request
 * body before it reaches validation or controllers.
 *
 * Applied globally so individual Joi schemas and controllers don't need to call `.trim()`
 * on each field. Handles nested objects and arrays so the trim applies to deep structures
 * like address objects or tag lists.
 */
import { NextFunction, Request, Response } from 'express';

const trimStrings = (obj: any): any => {
  if (typeof obj === 'string') {
    return obj.trim();
  }
  if (Array.isArray(obj)) {
    return obj.map(trimStrings);
  }
  if (obj !== null && typeof obj === 'object') {
    const trimmedObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        trimmedObj[key] = trimStrings(obj[key]);
      }
    }
    return trimmedObj;
  }
  return obj;
};

const TrimMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.body) {
    req.body = trimStrings(req.body);
  }
  next();
};

export default TrimMiddleware;
