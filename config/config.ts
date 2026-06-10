import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, `../.env`) });

export const SERVER_PORT =
  parseInt(process.env.SERVER_PORT || '3001', 10) || 3001;
export const DB_CONFIG = {
  type: process.env.DB_TYPE,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  logging: process.env.DB_LOGGING,
  sync: process.env.DB_SYNC,
  clear: process.env.DB_CLEAR,
};

export const DEFAULT_SYSTEM_ADMIN_CREDS = {
  FIRST_NAME: process.env.SYSTEM_ADMIN_FIRST_NAME || '',
  LAST_NAME: process.env.SYSTEM_ADMIN_LAST_NAME || '',
  USER_NAME: process.env.SYSTEM_ADMIN_USER_NAME || '',
  EMAIL: process.env.SYSTEM_ADMIN_EMAIL || '',
  PASSWORD: process.env.SYSTEM_ADMIN_PASSWORD || '',
};

export const SYSTEM_CLIENT = {
  NAME: process.env.SUPER_CLIENT_NAME || '',
  DESCRIPTION: process.env.SUPER_CLIENT_DESC || '',
};

export const WEB_URL = process.env.WEB_URL || 'http://localhost:4201';
export const FE_URL = process.env.FE_URL || 'http://localhost:4200';

export const VALIDATION = {
  email:
    "^[-!#$%&'*+/0-9=?A-Z^_a-z{|}~](\\.?[-!#$%&'*+/0-9=?A-Z^_a-z`{|}~])*@[a-zA-Z0-9](-*\\.?[a-zA-Z0-9])*\\.[a-zA-Z](-?[a-zA-Z0-9])+$",
  mobile: '^(\\+\\d{1,3}[- ]?)?\\d{1}$',
  password: '^(?=.*[a-z])(?=.*[A-Z])(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$',
};

export const ROLES = {
  SYSTEM_ADMIN: 'SYSTEM-ADMIN',
  CLIENT_ADMIN: 'CLIENT-ADMIN',
  CLIENT_USER: 'CLIENT-USER',
};

export const CLIENT_TYPE = {
  DEFAULT: 1,
  CUSTOM: 0,
};

export const JWT_SECRET_KEY = (() => {
  const key = process.env.JWT_SECRET_KEY;
  if (!key) throw new Error('JWT_SECRET_KEY environment variable is required');
  return key;
})();

export const SESSION_EXPIRE_TIME = parseInt(
  process.env.SESSION_EXPIRE_TIME || '0',
);
export const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m';
export const REFRESH_TOKEN_EXPIRY_DAYS =
  parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS || '7') || 7;
export const RESET_PASS_EXPIRE_TIME = 15;
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const DEFAULT_MAX_LOGIN_ATTEMPTS = 5;
export const DEFAULT_ACCOUNT_LOCK_DURATION_HOURS = 1;
export const DEFAULT_PASSWORD_HISTORY_LIMIT = 5;
export const DEFAULT_SESSION_INACTIVITY_TIMEOUT = 30;
export const SETUP_TOKEN_EXPIRY_HOURS =
  parseInt(process.env.SETUP_TOKEN_EXPIRY_HOURS || '72') || 72;

export const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587') || 587,
  secure: (parseInt(process.env.SMTP_PORT || '587') || 587) === 465,
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
  // Optional — surfaced in email footers + "didn't request this?" links.
  // Blank means the corresponding template section is suppressed.
  supportEmail: process.env.SUPPORT_EMAIL || '',
  docsUrl: process.env.DOCS_URL || '',
};

export const MAX_ROW = 10000000;
export const DEFAULT_PAGE = 1;

// Default row limit for dataset/analysis query execution
export const DATASET_QUERY_LIMIT = 1000;

export const DEFAULT_CLIENT_CONFIG = {
  maxLoginAttempts: 5,
  accountLockDurationHours: 1,
  passwordHistoryLimit: 5,
  sessionInactivityTimeout: 30,
};

export const MAX_LENGTH = {
  FIRST_NAME: 30,
  LAST_NAME: 30,
  USERNAME: 30,
  PASSWORD: 128,
  EMAIL: 254,
  CLIENT_NAME: 64,
  DESCRIPTION: 500,
  CONNECTION_NAME: 64,
  GROUP_NAME: 64,
  TAB_NAME: 64,
  SECTION_NAME: 64,
  PROMPT_NAME: 64,
  QUERY_BUILDER_NAME: 64,
  DATASET_NAME: 100,
  ANALYSIS_NAME: 100,
  FIELD_NAME: 128,
  SQL: 10000,
  DB_USERNAME: 128,
  DB_PASSWORD: 256,
  DB_DISPLAY_NAME: 64,
  DB_HOST: 255,
};

export const MIN_LENGTH = {
  FIRST_NAME: 2,
  LAST_NAME: 2,
  USERNAME: 6,
  PASSWORD: 8,
  CLIENT_NAME: 2,
  DESCRIPTION: 2,
  PEPPER_KEY: 32,
  CONNECTION_NAME: 2,
  GROUP_NAME: 2,
  TAB_NAME: 2,
  SECTION_NAME: 2,
  PROMPT_NAME: 2,
  QUERY_BUILDER_NAME: 2,
  DATASET_NAME: 2,
  ANALYSIS_NAME: 2,
  FIELD_NAME: 1,
  DB_DISPLAY_NAME: 2,
};

export const CODE = {
  SUCCESS: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  ALREADY_EXISTS: 405,
  CONFLICT: 409,
  SESSION_EXPIRED: 440,
  SERVER_ERROR: 500,
};

export const STATUS = {
  ACTIVE: 1,
  INACTIVE: 0,
};

/**
 * Enum-style values for the `isDefault` column on User / Client /
 * Role / Group entities. The DB stores 0 or 1 (typeorm `enum: [0, 1]`)
 * — use these constants instead of literals to make the intent at the
 * call site obvious and to localise any future widening (e.g. to a
 * three-state SYSTEM / DEFAULT / CUSTOM model).
 */
export const IS_DEFAULT = {
  YES: 1,
  NO: 0,
} as const;

export const CONNECTION_TIMEOUT = 30000;

/**
 * Database engines UltraSignal can talk to.
 *
 * TypeORM-engines (POSTGRES / MYSQL / MARIADB / MSSQL / ORACLE) go
 * through getDbConnection(). SNOWFLAKE has no TypeORM driver and
 * routes through connectToSnowflake() in snowflakeConnection.ts.
 *
 * Master / per-client master DBs are always POSTGRES.
 *
 * Branch with `dbType === DB_TYPES.SNOWFLAKE` whenever you need to
 * pick between the two paths.
 */
export const DB_TYPES = {
  POSTGRES: 'postgres',
  MYSQL: 'mysql',
  MARIADB: 'mariadb',
  MSSQL: 'mssql',
  ORACLE: 'oracle',
  SNOWFLAKE: 'snowflake',
} as const;

/**
 * Boolean flag pair for the `isMasterDb` argument of getDbConnection().
 * `MASTER` pins the ULTRASIGNAL_SCHEMA_NAME schema (used for the platform
 * master DB and per-client master DBs). `EXTERNAL` leaves the schema
 * unset so user-owned external datasources resolve tables out of
 * their own default schema (`public` on Postgres). Picking the wrong
 * one routes queries to a non-existent schema and surfaces as
 * `relation "<table>" does not exist`.
 */
export const IS_MASTER_DB = {
  MASTER: true,
  EXTERNAL: false,
} as const;

/**
 * Boolean flag pair for the `sync` argument of getDbConnection().
 * Schema sync is destructive-ish (auto-DDL) and is only used during
 * client onboarding. Every other caller must pass OFF.
 */
export const DB_SYNC = {
  ON: true,
  OFF: false,
} as const;

export const REGEX_PATTERNS = {
  // Email & Password: use validator.js instead of regex (see validation.helpers.ts)
  // Kept for backward compatibility in modules not yet migrated
  EMAIL: /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/,
  PASSWORD:
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  NAME: /^[a-zA-Z\s]+$/, // deprecated — use FIRSTNAME/LASTNAME instead
  MOBILE: /^[0-9]{10}$/,
  USERNAME: /^[A-Za-z][A-Za-z0-9._-]{5,29}$/,
  // Unicode-aware: supports accented chars (José), apostrophes (O'Brien), hyphens (Mary-Jane)
  FIRSTNAME: /^[\p{L}][\p{L}'\- ]*$/u,
  LASTNAME: /^[\p{L}][\p{L}'\- ]*$/u,
  PEPPER_KEY: /^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{32,}$/,
};

export const VALIDATION_MESSAGES = {
  ID: {
    REQUIRED: 'ID is required',
    INVALID: 'Invalid ID format',
  },
  EMAIL: {
    REQUIRED: 'Email is required',
    INVALID: 'Please enter a valid email address',
    LENGTH: `Email must not exceed ${254} characters`,
  },
  PASSWORD: {
    REQUIRED: 'Password is required',
    MIN_LENGTH: `Password must be at least ${8} characters`,
    MAX_LENGTH: `Password must not exceed ${128} characters`,
    NO_SPACES: 'Password must not contain spaces',
    LOWERCASE: 'Password must contain at least one lowercase letter',
    UPPERCASE: 'Password must contain at least one uppercase letter',
    DIGIT: 'Password must contain at least one number',
    SPECIAL:
      'Password must contain at least one special character (e.g., @$!%*?&)',
    // Legacy all-in-one message for modules not yet migrated
    INVALID:
      'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number and one special character',
  },
  USERNAME: {
    REQUIRED: 'Username is required',
    LENGTH: `Username must be between ${6} and ${30} characters`,
    INVALID:
      'Username must start with a letter and can only contain letters, numbers, dots, underscores and hyphens',
  },
  NAME: {
    FIRST_REQUIRED: 'First name is required',
    LAST_REQUIRED: 'Last name is required',
    FIRST_LENGTH: `First name must be between ${2} and ${30} characters`,
    LAST_LENGTH: `Last name must be between ${2} and ${30} characters`,
    LENGTH: `Name must be between ${2} and ${30} characters`,
    INVALID:
      'Must start with a letter and can only contain letters, hyphens, apostrophes and spaces',
    REQUIRED: 'Name is required',
  },
  MOBILE: {
    REQUIRED: 'Mobile number is required',
    INVALID: 'Invalid mobile number format. Must be 10 digits',
  },
  MAX_USERS: {
    REQUIRED: 'Maximum number of users is required',
  },
  MAX_ENVIRONMENTS: {
    REQUIRED: 'Maximum number of environments is required',
  },
  MAX_DATABASES: {
    REQUIRED: 'Maximum number of databases is required',
  },
  MAX_ADMINS: {
    REQUIRED: 'Maximum number of admins is required',
  },
  MAX_CATEGORIES: {
    REQUIRED: 'Maximum number of categories is required',
  },
  USE_OWN_DB: {
    REQUIRED: 'Use own database is required',
    INVALID: 'Use own database must be either 0 or 1',
  },
  DESCRIPTION: {
    REQUIRED: 'Description is required',
  },
  ENCRYPTION_ALGORITHM: {
    REQUIRED: 'Encryption algorithm is required',
  },
  PEPPER_KEY: {
    REQUIRED: 'Pepper key is required',
  },
};

export const DATASET_FIELD_TYPE = {
  DEFAULT: 1,
  CUSTOM: 2,
};

export const GLOBAL_SEARCH_KEY = {
  TAB: 'queryBuilderTab',
  SECTION: 'queryBuilderSection',
  PROMPT: 'queryBuilderPrompt',
  QUERY_BUILDER: 'queryBuilderScreen',
  DATASET: 'datasetManager',
  ANALYSES: 'analyses',
  DASHBOARD: 'dashboard',
};

export const GLOBAL_SEARCH_ENTITY_TYPE = {
  TAB: 'Tab',
  SECTION: 'Section',
  PROMPT: 'Prompt',
  QUERY_BUILDER: 'Query Builder',
  DATASET: 'Dataset',
  ANALYSES: 'Analyses',
  DASHBOARD: 'Dashboard',
};
