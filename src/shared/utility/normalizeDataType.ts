/**
 * Normalize raw PostgreSQL type names (from pg_typeof()) to simplified
 * analytical types used consistently across the application.
 *
 * pg_typeof() returns values like "character varying", "double precision",
 * "timestamp without time zone", etc. This function maps them to a
 * concise vocabulary: text, integer, numeric, boolean, date, timestamp, json.
 */
const normalizeDataType = (rawType: string | null | undefined): string => {
  if (!rawType) return 'text';
  const t = rawType.toLowerCase();

  // Integer types
  if (t.includes('int') || t.includes('serial')) return 'integer';

  // Decimal / float types
  if (
    t.includes('numeric') ||
    t.includes('decimal') ||
    t.includes('float') ||
    t.includes('double') ||
    t.includes('real') ||
    t.includes('money')
  )
    return 'numeric';

  // Boolean
  if (t.includes('bool')) return 'boolean';

  // Timestamp (check before date/time since "timestamp" contains "time")
  if (t.includes('timestamp')) return 'timestamp';

  // Date / time / interval
  if (t.includes('date') || t.includes('time') || t.includes('interval'))
    return 'date';

  // JSON
  if (t.includes('json')) return 'json';

  // Text / string types
  if (
    t.includes('char') ||
    t.includes('text') ||
    t.includes('string') ||
    t.includes('citext') ||
    t.includes('name')
  )
    return 'text';

  // Everything else (uuid, bytea, inet, array, enum, etc.) → text
  return 'text';
};

export default normalizeDataType;
