/**
 * LocaleMiddleware — resolves the request locale and stores it in res.locals.locale
 * for downstream use by sendResponse().
 *
 * Priority order: ?lang= query param → Accept-Language header → default 'en'.
 * The query param override exists for testing and explicit client control without
 * changing browser settings. Full locale tags (e.g. pt-BR) are tried before the
 * base language (pt) so regional variants are honoured when supported.
 */
import { NextFunction, Request, Response } from 'express';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../utility/i18n';

const LocaleMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const langQuery = req.query.lang as string | undefined;
  if (
    langQuery &&
    (SUPPORTED_LOCALES as readonly string[]).includes(langQuery)
  ) {
    res.locals.locale = langQuery;
    return next();
  }

  const acceptLang = req.headers['accept-language'];
  if (acceptLang) {
    const supported = SUPPORTED_LOCALES as readonly string[];
    for (const segment of acceptLang.split(',')) {
      const fullTag = segment.split(';')[0].trim();
      if (supported.includes(fullTag)) {
        res.locals.locale = fullTag;
        return next();
      }
      const baseTag = fullTag.split('-')[0].toLowerCase();
      if (supported.includes(baseTag)) {
        res.locals.locale = baseTag;
        return next();
      }
    }
  }

  res.locals.locale = DEFAULT_LOCALE;
  next();
};

export default LocaleMiddleware;
