/**
 * Utility for building audit log metadata.
 *
 * - Per-module allowlists (AUDIT_FIELDS) control which entity fields are captured
 * - FIELD_LABELS provide human-readable names for export and display
 * - Value formatting: status enums, boolean-like fields, etc.
 * - Sensitive/system fields are always excluded as a safety net
 */

// ── Safety-net exclusions (always filtered even if allowlist accidentally includes them) ──

const SENSITIVE_FIELDS = new Set([
  'password',
  'dbPassword',
  'sessionId',
  'refreshToken',
  'refreshTokenExpiresAt',
  'otp',
  'otpExpiresAt',
  'pepperKey',
  'encryptionAlgorithm',
]);

const SYSTEM_FIELDS = new Set([
  'version',
  'createdBy',
  'updatedBy',
  'deletedBy',
  'deletedOn',
]);

// ── Per-entity-type field allowlists ──

export const AUDIT_FIELDS = {
  USER: ['firstName', 'lastName', 'email', 'role', 'status', 'isDefault'],
  GROUP: ['description', 'status'],
  DATASOURCE: ['description', 'status'],
  CONNECTION: ['description', 'dbUsername', 'status'],
  DATASET: ['description', 'sql', 'type', 'status'],
  DATASET_FIELD: [
    'columnToUse',
    'columnToView',
    'customLogic',
    'isCfUsed',
    'type',
    'sequence',
  ],
  ANALYSES: ['description', 'status'],
  QUERY_BUILDER: ['description', 'status'],
  TAB: ['description', 'status', 'sequence'],
  SECTION: ['description', 'status', 'sequence'],
  PROMPT: ['description', 'status', 'type', 'mandatory', 'sequence'],
  PROMPT_CONFIG: [
    'prompt_schema',
    'prompt_table',
    'prompt_column',
    'prompt_join',
    'prompt_where',
    'prompt_sql',
    'prompt_values_sql',
  ],
  CLIENT: ['name', 'description', 'status', 'isDefault'],
  ROLE: ['id', 'name', 'description', 'isDefault', 'status', 'clientId'],
} as const;

// ── Human-readable display labels ──

export const FIELD_LABELS: Record<string, string> = {
  // User fields
  firstName: 'First Name',
  lastName: 'Last Name',
  email: 'Email',
  role: 'Role',
  status: 'Status',
  isDefault: 'Default User',

  // Common entity fields
  name: 'Name',
  description: 'Description',

  // Datasource / Connection
  datasourceName: 'Datasource',
  dbUsername: 'DB Username',
  dbType: 'DB Type',
  hostname: 'Hostname',
  port: 'Port',
  isMasterDB: 'Master Database',

  // Dataset
  sql: 'SQL Query',
  type: 'Type',
  datasetName: 'Dataset',
  columnCount: 'Column Count',
  columns: 'Columns',
  queryBuilderName: 'Query Builder',
  relatedAnalysesCount: 'Related Analyses',

  // Dataset Field
  columnToUse: 'Column (Use)',
  columnToView: 'Column (View)',
  customLogic: 'Custom Logic',
  isCfUsed: 'Custom Field Used',
  sequence: 'Sequence',

  // Analysis
  analysisName: 'Analysis',
  visualCount: 'Visual Count',

  // Query Builder
  promptCount: 'Prompt Count',
  tabCount: 'Tab Count',

  // Tab / Section
  tabName: 'Tab',
  sectionName: 'Section',

  // Prompt
  mandatory: 'Mandatory',
  prompt_schema: 'Schema',
  prompt_table: 'Table',
  prompt_column: 'Column',
  prompt_join: 'Join',
  prompt_where: 'Where',
  prompt_sql: 'SQL',
  prompt_values_sql: 'Values SQL',
  schema: 'Schema',
  tables: 'Tables',
  hasJoin: 'Has Join',
  hasWhere: 'Has Where',
  valueCount: 'Value Count',
  valuesAdded: 'Values Added',
  valuesDeleted: 'Values Deleted',
  appearance: 'Appearance',
  config: 'Configuration',

  // Access
  usersAdded: 'Users Added',
  usersRemoved: 'Users Removed',
  groupsAdded: 'Groups Added',
  groupsRemoved: 'Groups Removed',

  // Group
  userCount: 'User Count',
  userIds: 'User IDs',

  // Misc
  visibility: 'Visibility',
  referencedFieldIds: 'Referenced Fields',
  datasetId: 'Dataset ID',
};

// ── Value formatting ──

export const formatStatus = (status: number): string =>
  status === 1 ? 'Active' : status === 0 ? 'Inactive' : String(status);

/**
 * Convert a raw camelCase key to a human-readable label.
 * Uses FIELD_LABELS map first, falls back to camelCase splitting.
 */
export const getFieldLabel = (key: string): string => {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  // Fallback: split camelCase
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
};

/**
 * Build a snapshot of an entity for audit metadata.
 *
 * @param entity   – The TypeORM entity (or plain object) to snapshot.
 * @param fields   – Allowlist of fields to capture. Pass an AUDIT_FIELDS value.
 *                   If omitted, captures all non-sensitive/non-system fields (legacy fallback).
 */
export const snapshotEntity = (
  entity: any,
  fields?: readonly string[],
): Record<string, any> => {
  if (!entity || typeof entity !== 'object') return {};

  const snapshot: Record<string, any> = {};
  const safetyExclude = new Set([...SENSITIVE_FIELDS, ...SYSTEM_FIELDS]);

  const keys = fields
    ? fields.filter(k => !safetyExclude.has(k))
    : Object.keys(entity).filter(k => !safetyExclude.has(k));

  for (const key of keys) {
    const value = entity[key];

    if (value === undefined) continue;
    if (typeof value === 'function') continue;

    // Skip nested relation objects but keep Date, null, arrays of primitives
    if (
      value !== null &&
      typeof value === 'object' &&
      !(value instanceof Date) &&
      !Array.isArray(value)
    )
      continue;

    // Format known enum / boolean-like columns
    if (key === 'status' && typeof value === 'number') {
      snapshot[key] = formatStatus(value);
    } else if (key === 'isDefault' && typeof value === 'number') {
      snapshot[key] = value === 1 ? 'Yes' : 'No';
    } else if (key === 'mandatory' && typeof value === 'number') {
      snapshot[key] = value === 1 ? 'Yes' : 'No';
    } else if (key === 'isCfUsed' && typeof value === 'number') {
      snapshot[key] = value === 0 ? 'Yes' : 'No';
    } else if (key === 'visibility' && typeof value === 'number') {
      snapshot[key] = value === 1 ? 'Public' : 'Private';
    } else {
      snapshot[key] = value;
    }
  }

  return snapshot;
};
