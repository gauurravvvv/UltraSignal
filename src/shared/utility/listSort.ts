/**
 * listSort — shared helpers for the standard list-endpoint sort contract.
 *
 * Wire contract:
 *   ?sort=[{"field":"name","order":"asc"},{"field":"status","order":"desc"}]
 *
 * Used by every list endpoint that exposes sortable columns. Each endpoint declares
 * its own whitelist (the columns its FE table can sort on) and a column-name map
 * that translates client-facing field names to TypeORM column references.
 *
 * Why a custom Joi rule rather than two passes: keeps validation in middleware,
 * gives one consistent 400-with-message for every malformed payload, and prevents
 * each controller from re-implementing the parse-then-validate dance.
 */
import Joi from 'joi';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

export interface SortEntry<F extends string = string> {
  field: F;
  order: 'asc' | 'desc';
}

/**
 * Build a Joi rule for the `sort` query param.
 *
 * @param whitelist  Field names the client may sort on. Anything else → 400.
 * @returns A Joi string schema that JSON-parses, validates the shape, and on
 *          success re-stringifies so the controller can keep treating req.query.sort
 *          as a string (parse-once in the controller, no surprises).
 */
export const buildSortJoi = <F extends string>(
  whitelist: readonly F[],
): Joi.StringSchema => {
  const entrySchema = Joi.object<SortEntry<F>>({
    field: Joi.string()
      .valid(...whitelist)
      .required(),
    order: Joi.string().valid('asc', 'desc').required(),
  }).unknown(false);

  const arraySchema = Joi.array<SortEntry<F>[]>()
    .items(entrySchema)
    .max(whitelist.length)
    .unique('field');

  return Joi.string().custom((raw, helpers) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return helpers.error('any.invalid', {
        message: 'sort must be a valid JSON-encoded array',
      });
    }
    const { error, value } = arraySchema.validate(parsed);
    if (error) {
      return helpers.error('any.invalid', { message: error.message });
    }
    return JSON.stringify(value);
  }, 'sort JSON parser');
};

/**
 * Apply the validated `sort` JSON string to a TypeORM query builder.
 *
 * Array order = SQL precedence — first entry is .orderBy (primary), each subsequent
 * entry chains via .addOrderBy. When the client sends no `sort` the default column
 * + direction is applied so every list endpoint has a deterministic order.
 *
 * @param query           QueryBuilder to mutate in place.
 * @param sort            Validated JSON string from req.query.sort (or undefined).
 * @param columnMap       Maps each whitelisted field name to its TypeORM column reference.
 * @param defaultColumn   Column reference used when no sort is supplied.
 * @param defaultDirection Direction used when no sort is supplied.
 */
export const applySort = <T extends ObjectLiteral, F extends string>(
  query: SelectQueryBuilder<T>,
  sort: string | undefined,
  columnMap: Record<F, string>,
  defaultColumn: string,
  defaultDirection: 'ASC' | 'DESC' = 'DESC',
): SelectQueryBuilder<T> => {
  const entries: SortEntry<F>[] = sort ? JSON.parse(sort) : [];
  if (entries.length === 0) {
    query.orderBy(defaultColumn, defaultDirection);
    return query;
  }
  entries.forEach(({ field, order }, idx) => {
    const column = columnMap[field];
    const direction: 'ASC' | 'DESC' = order === 'asc' ? 'ASC' : 'DESC';
    if (idx === 0) {
      query.orderBy(column, direction);
    } else {
      query.addOrderBy(column, direction);
    }
  });
  return query;
};
