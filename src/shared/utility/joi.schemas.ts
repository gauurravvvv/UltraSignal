import Joi from 'joi';
import { MAX_LENGTH, MIN_LENGTH, REGEX_PATTERNS } from '../../../config/config';

// Unicode-aware name pattern: supports José, O'Brien, Mary-Jane, Van Dyke
const NAME_PATTERN = /^[\p{L}][\p{L}'\- ]*$/u;

// Username pattern: starts with letter, alphanumeric + . _ -
const USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9._-]*$/;

// Organisation name: starts with letter/number, allows letters, numbers, spaces, dots, underscores, hyphens
const ORG_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._-]*$/;

// Valid encryption algorithms
const ENCRYPTION_ALGORITHMS = [
  'aes-256-gcm',
  'aes-192-gcm',
  'aes-128-gcm',
  'aes-256-cbc',
  'aes-192-cbc',
  'aes-128-cbc',
];

/**
 * Custom Joi validator for password strength.
 * Returns specific error codes for each failed rule,
 * enabling per-rule error messages.
 */
const strongPassword = (value: string, helpers: Joi.CustomHelpers) => {
  if (/\s/.test(value)) return helpers.error('password.noSpaces');
  if (!/[a-z]/.test(value)) return helpers.error('password.lowercase');
  if (!/[A-Z]/.test(value)) return helpers.error('password.uppercase');
  if (!/\d/.test(value)) return helpers.error('password.digit');
  if (!/[^a-zA-Z0-9\s]/.test(value)) return helpers.error('password.special');
  return value;
};

/**
 * Shared Joi field schemas — reusable across all modules.
 *
 * Usage:
 *   const schema = Joi.object({
 *     email: fields.email.required(),
 *     firstName: fields.firstName.required(),
 *   });
 *
 * Each field includes: type, sanitization (trim/lowercase),
 * constraints (min/max), pattern validation, and error messages.
 * Call .required() when composing into a route schema.
 */
export const fields = {
  email: Joi.string()
    .email()
    .trim()
    .lowercase()
    .max(MAX_LENGTH.EMAIL)
    .messages({
      'string.empty': 'Email is required',
      'string.email': 'Please enter a valid email address',
      'string.max': `Email must not exceed ${MAX_LENGTH.EMAIL} characters`,
      'any.required': 'Email is required',
    }),

  username: Joi.string()
    .trim()
    .min(MIN_LENGTH.USERNAME)
    .max(MAX_LENGTH.USERNAME)
    .pattern(USERNAME_PATTERN)
    .messages({
      'string.empty': 'Username is required',
      'string.min': `Username must be at least ${MIN_LENGTH.USERNAME} characters`,
      'string.max': `Username must not exceed ${MAX_LENGTH.USERNAME} characters`,
      'string.pattern.base':
        'Username must start with a letter and can only contain letters, numbers, dots, underscores and hyphens',
      'any.required': 'Username is required',
    }),

  password: Joi.string()
    .min(MIN_LENGTH.PASSWORD)
    .max(MAX_LENGTH.PASSWORD)
    .custom(strongPassword)
    .messages({
      'string.empty': 'Password is required',
      'string.min': `Password must be at least ${MIN_LENGTH.PASSWORD} characters`,
      'string.max': `Password must not exceed ${MAX_LENGTH.PASSWORD} characters`,
      'password.noSpaces': 'Password must not contain spaces',
      'password.lowercase':
        'Password must contain at least one lowercase letter',
      'password.uppercase':
        'Password must contain at least one uppercase letter',
      'password.digit': 'Password must contain at least one number',
      'password.special':
        'Password must contain at least one special character (e.g., @$!%*?&)',
      'any.required': 'Password is required',
    }),

  firstName: Joi.string()
    .trim()
    .min(MIN_LENGTH.FIRST_NAME)
    .max(MAX_LENGTH.FIRST_NAME)
    .pattern(NAME_PATTERN)
    .messages({
      'string.empty': 'First name is required',
      'string.min': `First name must be at least ${MIN_LENGTH.FIRST_NAME} characters`,
      'string.max': `First name must not exceed ${MAX_LENGTH.FIRST_NAME} characters`,
      'string.pattern.base':
        'First name must start with a letter and can only contain letters, hyphens, apostrophes and spaces',
      'any.required': 'First name is required',
    }),

  lastName: Joi.string()
    .trim()
    .min(MIN_LENGTH.LAST_NAME)
    .max(MAX_LENGTH.LAST_NAME)
    .pattern(NAME_PATTERN)
    .messages({
      'string.empty': 'Last name is required',
      'string.min': `Last name must be at least ${MIN_LENGTH.LAST_NAME} characters`,
      'string.max': `Last name must not exceed ${MAX_LENGTH.LAST_NAME} characters`,
      'string.pattern.base':
        'Last name must start with a letter and can only contain letters, hyphens, apostrophes and spaces',
      'any.required': 'Last name is required',
    }),

  id: Joi.string().trim().uuid().messages({
    'any.required': 'ID is required',
    'string.guid': 'Invalid ID format',
    'string.empty': 'ID is required',
  }),

  organisation: Joi.string().trim().messages({
    'any.required': 'Organisation is required',
    'string.empty': 'Organisation is required',
  }),

  status: Joi.number().valid(0, 1).messages({
    'any.only': 'Status must be either 0 or 1',
  }),

  orgName: Joi.string()
    .trim()
    .min(MIN_LENGTH.ORG_NAME)
    .max(MAX_LENGTH.ORG_NAME)
    .pattern(ORG_NAME_PATTERN)
    .messages({
      'string.empty': 'Organisation name is required',
      'string.min': `Organisation name must be at least ${MIN_LENGTH.ORG_NAME} characters`,
      'string.max': `Organisation name must not exceed ${MAX_LENGTH.ORG_NAME} characters`,
      'string.pattern.base':
        'Organisation name must start with a letter or number and can only contain letters, numbers, spaces, dots, underscores and hyphens',
      'any.required': 'Organisation name is required',
    }),

  description: Joi.string()
    .trim()
    .min(MIN_LENGTH.DESCRIPTION)
    .max(MAX_LENGTH.DESCRIPTION)
    .messages({
      'string.empty': 'Description is required',
      'string.min': `Description must be at least ${MIN_LENGTH.DESCRIPTION} characters`,
      'string.max': `Description must not exceed ${MAX_LENGTH.DESCRIPTION} characters`,
      'any.required': 'Description is required',
    }),

  encryptionAlgorithm: Joi.string()
    .trim()
    .lowercase()
    .valid(...ENCRYPTION_ALGORITHMS)
    .messages({
      'string.empty': 'Encryption algorithm is required',
      'any.only': `Encryption algorithm must be one of: ${ENCRYPTION_ALGORITHMS.join(
        ', ',
      )}`,
      'any.required': 'Encryption algorithm is required',
    }),

  pepperKey: Joi.string()
    .min(MIN_LENGTH.PEPPER_KEY)
    .pattern(REGEX_PATTERNS.PEPPER_KEY)
    .messages({
      'string.empty': 'Pepper key is required',
      'string.min': `Pepper key must be at least ${MIN_LENGTH.PEPPER_KEY} characters`,
      'string.pattern.base':
        'Pepper key can only contain letters, numbers and special characters (no spaces)',
      'any.required': 'Pepper key is required',
    }),

  maxLoginAttempts: Joi.number().integer().min(3).max(10).messages({
    'any.required': 'Max login attempts is required',
    'number.base': 'Max login attempts must be a number',
    'number.min': 'Max login attempts must be at least 3',
    'number.max': 'Max login attempts cannot exceed 10',
  }),
  accountLockDurationHours: Joi.number().min(0).max(24).messages({
    'any.required': 'Account lock duration is required',
    'number.base': 'Account lock duration must be a number',
    'number.min': 'Account lock duration cannot be negative',
    'number.max': 'Account lock duration cannot exceed 24 hours',
  }),
  passwordHistoryLimit: Joi.number().integer().min(1).max(24).messages({
    'any.required': 'Password history limit is required',
    'number.base': 'Password history limit must be a number',
    'number.min': 'Password history limit must be at least 1',
    'number.max': 'Password history limit cannot exceed 24',
  }),
  sessionInactivityTimeout: Joi.number().integer().min(5).max(1440).messages({
    'any.required': 'Session inactivity timeout is required',
    'number.base': 'Session inactivity timeout must be a number',
    'number.min': 'Session inactivity timeout must be at least 5 minutes',
    'number.max':
      'Session inactivity timeout cannot exceed 1440 minutes (24 hours)',
  }),
  emailProvider: Joi.string().trim().valid('SMTP', 'SES').messages({
    'any.only': 'Email provider must be SMTP or SES',
  }),
  smtpHost: Joi.string().trim().min(1).max(255).messages({
    'string.empty': 'SMTP host is required',
    'string.max': 'SMTP host must not exceed 255 characters',
    'any.required': 'SMTP host is required',
  }),
  smtpPort: Joi.number().integer().min(1).max(65535).messages({
    'number.base': 'SMTP port must be a number',
    'number.min': 'SMTP port must be at least 1',
    'number.max': 'SMTP port cannot exceed 65535',
    'any.required': 'SMTP port is required',
  }),
  smtpUser: Joi.string().trim().min(1).max(255).messages({
    'string.empty': 'SMTP username is required',
    'string.max': 'SMTP username must not exceed 255 characters',
    'any.required': 'SMTP username is required',
  }),
  smtpPassword: Joi.string().allow('', null).messages({}),
  smtpFrom: Joi.string().trim().email({ tlds: false }).messages({
    'string.empty': 'From email is required',
    'string.email': 'From email must be a valid email address',
    'any.required': 'From email is required',
  }),
  sesRegion: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .pattern(/^[a-z]{2}-[a-z]+-\d{1,2}$/)
    .messages({
      'string.empty': 'AWS region is required',
      'string.max': 'AWS region must not exceed 50 characters',
      'string.pattern.base':
        'AWS region must be a valid format (e.g. us-east-1, eu-west-2)',
      'any.required': 'AWS region is required',
    }),
  sesAccessKeyId: Joi.string().trim().min(16).max(128).messages({
    'string.empty': 'Access key ID is required',
    'string.min': 'Access key ID must be at least 16 characters',
    'string.max': 'Access key ID must not exceed 128 characters',
    'any.required': 'Access key ID is required',
  }),
  sesSecretAccessKey: Joi.string().allow('', null).messages({}),
  sesFrom: Joi.string().trim().email({ tlds: false }).messages({
    'string.empty': 'From email is required',
    'string.email': 'From email must be a valid email address',
    'any.required': 'From email is required',
  }),

  connectionName: Joi.string()
    .trim()
    .min(MIN_LENGTH.CONNECTION_NAME)
    .max(MAX_LENGTH.CONNECTION_NAME)
    .pattern(ORG_NAME_PATTERN)
    .messages({
      'string.empty': 'Connection name is required',
      'string.min': `Connection name must be at least ${MIN_LENGTH.CONNECTION_NAME} characters`,
      'string.max': `Connection name must not exceed ${MAX_LENGTH.CONNECTION_NAME} characters`,
      'string.pattern.base':
        'Connection name must start with a letter or number and can only contain letters, numbers, spaces, dots, underscores and hyphens',
      'any.required': 'Connection name is required',
    }),

  groupName: Joi.string()
    .trim()
    .min(MIN_LENGTH.GROUP_NAME)
    .max(MAX_LENGTH.GROUP_NAME)
    .pattern(ORG_NAME_PATTERN)
    .messages({
      'string.empty': 'Group name is required',
      'string.min': `Group name must be at least ${MIN_LENGTH.GROUP_NAME} characters`,
      'string.max': `Group name must not exceed ${MAX_LENGTH.GROUP_NAME} characters`,
      'string.pattern.base':
        'Group name must start with a letter or number and can only contain letters, numbers, spaces, dots, underscores and hyphens',
      'any.required': 'Group name is required',
    }),

  dbUsername: Joi.string()
    .trim()
    .min(1)
    .max(MAX_LENGTH.DB_USERNAME)
    .messages({
      'string.empty': 'Database username is required',
      'string.max': `Database username must not exceed ${MAX_LENGTH.DB_USERNAME} characters`,
      'any.required': 'Database username is required',
    }),

  dbPassword: Joi.string()
    .min(1)
    .max(MAX_LENGTH.DB_PASSWORD)
    .messages({
      'string.empty': 'Database password is required',
      'string.max': `Database password must not exceed ${MAX_LENGTH.DB_PASSWORD} characters`,
      'any.required': 'Database password is required',
    }),

  datasource: Joi.string().trim().messages({
    'any.required': 'Datasource is required',
    'string.empty': 'Datasource is required',
  }),

  users: Joi.array().items(Joi.string().trim()).min(1).messages({
    'array.min': 'At least 1 user is required',
    'array.base': 'Users must be an array',
    'any.required': 'Users are required',
  }),

  tabName: Joi.string()
    .trim()
    .min(MIN_LENGTH.TAB_NAME)
    .max(MAX_LENGTH.TAB_NAME)
    .pattern(ORG_NAME_PATTERN)
    .messages({
      'string.empty': 'Tab name is required',
      'string.min': `Tab name must be at least ${MIN_LENGTH.TAB_NAME} characters`,
      'string.max': `Tab name must not exceed ${MAX_LENGTH.TAB_NAME} characters`,
      'string.pattern.base':
        'Tab name must start with a letter or number and can only contain letters, numbers, spaces, dots, underscores and hyphens',
      'any.required': 'Tab name is required',
    }),

  sectionName: Joi.string()
    .trim()
    .min(MIN_LENGTH.SECTION_NAME)
    .max(MAX_LENGTH.SECTION_NAME)
    .pattern(ORG_NAME_PATTERN)
    .messages({
      'string.empty': 'Section name is required',
      'string.min': `Section name must be at least ${MIN_LENGTH.SECTION_NAME} characters`,
      'string.max': `Section name must not exceed ${MAX_LENGTH.SECTION_NAME} characters`,
      'string.pattern.base':
        'Section name must start with a letter or number and can only contain letters, numbers, spaces, dots, underscores and hyphens',
      'any.required': 'Section name is required',
    }),

  promptName: Joi.string()
    .trim()
    .min(MIN_LENGTH.PROMPT_NAME)
    .max(MAX_LENGTH.PROMPT_NAME)
    .pattern(ORG_NAME_PATTERN)
    .messages({
      'string.empty': 'Prompt name is required',
      'string.min': `Prompt name must be at least ${MIN_LENGTH.PROMPT_NAME} characters`,
      'string.max': `Prompt name must not exceed ${MAX_LENGTH.PROMPT_NAME} characters`,
      'string.pattern.base':
        'Prompt name must start with a letter or number and can only contain letters, numbers, spaces, dots, underscores and hyphens',
      'any.required': 'Prompt name is required',
    }),

  queryBuilderName: Joi.string()
    .trim()
    .min(MIN_LENGTH.QUERY_BUILDER_NAME)
    .max(MAX_LENGTH.QUERY_BUILDER_NAME)
    .pattern(ORG_NAME_PATTERN)
    .messages({
      'string.empty': 'Query Builder name is required',
      'string.min': `Query Builder name must be at least ${MIN_LENGTH.QUERY_BUILDER_NAME} characters`,
      'string.max': `Query Builder name must not exceed ${MAX_LENGTH.QUERY_BUILDER_NAME} characters`,
      'string.pattern.base':
        'Query Builder name must start with a letter or number and can only contain letters, numbers, spaces, dots, underscores and hyphens',
      'any.required': 'Query Builder name is required',
    }),

  tab: Joi.string().trim().messages({
    'any.required': 'Tab is required',
    'string.empty': 'Tab is required',
  }),

  section: Joi.string().trim().messages({
    'any.required': 'Section is required',
    'string.empty': 'Section is required',
  }),

  promptType: Joi.string()
    .trim()
    .lowercase()
    .valid(
      'calendar',
      'checkbox',
      'daterange',
      'dropdown',
      'multiselect',
      'number',
      'radio',
      'rangeslider',
      'text',
    )
    .messages({
      'string.empty': 'Prompt type is required',
      'any.only': 'Invalid prompt type',
      'any.required': 'Prompt type is required',
    }),

  datasetName: Joi.string()
    .trim()
    .min(MIN_LENGTH.DATASET_NAME)
    .max(MAX_LENGTH.DATASET_NAME)
    .pattern(ORG_NAME_PATTERN)
    .messages({
      'string.empty': 'Dataset name is required',
      'string.min': `Dataset name must be at least ${MIN_LENGTH.DATASET_NAME} characters`,
      'string.max': `Dataset name must not exceed ${MAX_LENGTH.DATASET_NAME} characters`,
      'string.pattern.base':
        'Dataset name must start with a letter or number and can only contain letters, numbers, spaces, dots, underscores and hyphens',
      'any.required': 'Dataset name is required',
    }),

  analysisName: Joi.string()
    .trim()
    .min(MIN_LENGTH.ANALYSIS_NAME)
    .max(MAX_LENGTH.ANALYSIS_NAME)
    .pattern(ORG_NAME_PATTERN)
    .messages({
      'string.empty': 'Analysis name is required',
      'string.min': `Analysis name must be at least ${MIN_LENGTH.ANALYSIS_NAME} characters`,
      'string.max': `Analysis name must not exceed ${MAX_LENGTH.ANALYSIS_NAME} characters`,
      'string.pattern.base':
        'Analysis name must start with a letter or number and can only contain letters, numbers, spaces, dots, underscores and hyphens',
      'any.required': 'Analysis name is required',
    }),

  fieldName: Joi.string()
    .trim()
    .min(MIN_LENGTH.FIELD_NAME)
    .max(MAX_LENGTH.FIELD_NAME)
    .messages({
      'string.empty': 'Field name is required',
      'string.min': `Field name must be at least ${MIN_LENGTH.FIELD_NAME} character`,
      'string.max': `Field name must not exceed ${MAX_LENGTH.FIELD_NAME} characters`,
      'any.required': 'Field name is required',
    }),

  sql: Joi.string()
    .trim()
    .min(1)
    .max(MAX_LENGTH.SQL)
    .messages({
      'string.empty': 'SQL query is required',
      'string.max': `SQL query must not exceed ${MAX_LENGTH.SQL} characters`,
      'any.required': 'SQL query is required',
    }),

  queryBuilder: Joi.string().trim().messages({
    'any.required': 'Query Builder is required',
    'string.empty': 'Query Builder is required',
  }),

  connection: Joi.string().trim().messages({
    'any.required': 'Connection is required',
    'string.empty': 'Connection is required',
  }),

  otp: Joi.string()
    .trim()
    .uppercase()
    .length(6)
    .pattern(/^[A-Z0-9]{6}$/)
    .messages({
      'string.empty': 'OTP is required',
      'string.length': 'OTP must be exactly 6 characters',
      'string.pattern.base': 'OTP must contain only letters and numbers',
      'any.required': 'OTP is required',
    }),

  dbDisplayName: Joi.string()
    .trim()
    .min(MIN_LENGTH.DB_DISPLAY_NAME)
    .max(MAX_LENGTH.DB_DISPLAY_NAME)
    .pattern(ORG_NAME_PATTERN)
    .messages({
      'string.empty': 'Database name is required',
      'string.min': `Database name must be at least ${MIN_LENGTH.DB_DISPLAY_NAME} characters`,
      'string.max': `Database name must not exceed ${MAX_LENGTH.DB_DISPLAY_NAME} characters`,
      'string.pattern.base':
        'Database name must start with a letter or number and can only contain letters, numbers, spaces, dots, underscores and hyphens',
      'any.required': 'Database name is required',
    }),

  dbHost: Joi.string()
    .trim()
    .min(1)
    .max(MAX_LENGTH.DB_HOST)
    .messages({
      'string.empty': 'Database host is required',
      'string.max': `Database host must not exceed ${MAX_LENGTH.DB_HOST} characters`,
      'any.required': 'Database host is required',
    }),

  dbPort: Joi.number().integer().min(1).max(65535).messages({
    'number.base': 'Port must be a number',
    'number.integer': 'Port must be a whole number',
    'number.min': 'Port must be at least 1',
    'number.max': 'Port cannot exceed 65535',
    'any.required': 'Database port is required',
  }),

  dbName: Joi.string().trim().min(1).messages({
    'string.empty': 'Database name is required',
    'any.required': 'Database name is required',
  }),

  dbType: Joi.string().trim().messages({
    'string.empty': 'Database type is required',
    'any.required': 'Database type is required',
  }),

  justification: Joi.string().trim().max(500).allow('', null).messages({
    'string.max': 'Justification must not exceed 500 characters',
  }),
};
