// ──────────────────────────────────────────────
// Centralised API Response Message Keys
// Values are i18n dot-notation keys resolved via src/utility/i18n.ts.
// English translations live in src/locales/en.json.
// ──────────────────────────────────────────────

// Generic
export const GENERIC = {
  UNAUTHORIZED: 'generic.unauthorized',
  SERVER_ERROR: 'generic.server_error',
  NOT_FOUND: 'generic.not_found',
  ROUTE_NOT_FOUND: 'generic.route_not_found',
  BAD_REQUEST: 'generic.bad_request',
  VALIDATION_ERROR: 'generic.validation_error',
};

// Auth
export const AUTH = {
  LOGIN_SUCCESS: 'auth.login_success',
  LOGIN_FAILED: 'auth.login_failed',
  USER_NOT_FOUND: 'auth.user_not_found',
  INVALID_PASSWORD: 'auth.invalid_password',
  LOGOUT_SUCCESS: 'auth.logout_success',
  SESSION_EXPIRED: 'auth.session_expired',
  INVALID_TOKEN: 'auth.invalid_token',
  PASSWORD_CHANGED: 'auth.password_changed',
  PASSWORD_RESET_SENT: 'auth.password_reset_sent',
  PASSWORD_SET_SUCCESS: 'auth.password_set_success',
  OTP_SENT: 'auth.otp_sent',
  OTP_VERIFIED: 'auth.otp_verified',
  OTP_INVALID: 'auth.otp_invalid',
  OTP_EXPIRED: 'auth.otp_expired',
  SETUP_TOKEN_INVALID: 'auth.setup_token_invalid',
  SETUP_TOKEN_EXPIRED: 'auth.setup_token_expired',
  ACCOUNT_INACTIVE: 'auth.account_inactive',
  REFRESH_TOKEN_SUCCESS: 'auth.refresh_token_success',
  REFRESH_TOKEN_INVALID: 'auth.refresh_token_invalid',
  SETUP_TOKEN_VERIFIED: 'auth.setup_token_verified',
  SETUP_TOKEN_VALID: 'auth.setup_token_valid',
  PASSWORD_ALREADY_SET: 'auth.password_already_set',
  NO_SETUP_TOKEN: 'auth.no_setup_token',
  SETUP_LINK_RESENT: 'auth.setup_link_resent',
  PASSWORD_NOT_SET: 'auth.password_not_set',
  PASSWORD_REUSED: 'auth.password_reused',
  ACCOUNT_LOCKED: 'auth.account_locked',
  ROLE_INACTIVE: 'auth.role_inactive',
};

// Client
export const CLIENT = {
  CREATED: 'client.created',
  UPDATED: 'client.updated',
  DELETED: 'client.deleted',
  BULK_DELETED: 'client.bulk_deleted',
  FETCHED: 'client.fetched',
  LIST_FETCHED: 'client.list_fetched',
  NOT_FOUND: 'client.not_found',
  ALREADY_EXISTS: 'client.already_exists',
  CODE_ALREADY_EXISTS: 'client.code_already_exists',
  ID_REQUIRED: 'client.id_required',
  INVALID_ID: 'client.invalid_id',
  DB_CONNECTION_FAILED: 'client.db_connection_failed',
  MASTER_DB_REFRESHED: 'client.master_db_refreshed',
};

// Data Source
export const DATA_SOURCE = {
  CREATED: 'data_source.created',
  UPDATED: 'data_source.updated',
  DELETED: 'data_source.deleted',
  FETCHED: 'data_source.fetched',
  LIST_FETCHED: 'data_source.list_fetched',
  NOT_FOUND: 'data_source.not_found',
  ALREADY_EXISTS: 'data_source.already_exists',
  ID_REQUIRED: 'data_source.id_required',
  INVALID_ID: 'data_source.invalid_id',
  TYPE_NOT_FOUND: 'data_source.type_not_found',
  CONNECTION_OK: 'data_source.connection_ok',
  CONNECTION_FAILED: 'data_source.connection_failed',
  SCHEMA_NOT_FOUND: 'data_source.schema_not_found',
};

// Data Source Type
export const DATA_SOURCE_TYPE = {
  LIST_FETCHED: 'data_source_type.list_fetched',
};

// Threshold Profile
export const THRESHOLD_PROFILE = {
  LIST_FETCHED: 'threshold_profile.list_fetched',
};

// System Admin
export const SYSTEM_ADMIN = {
  CREATED: 'system_admin.created',
  UPDATED: 'system_admin.updated',
  DELETED: 'system_admin.deleted',
  BULK_DELETED: 'system_admin.bulk_deleted',
  FETCHED: 'system_admin.fetched',
  LIST_FETCHED: 'system_admin.list_fetched',
  NOT_FOUND: 'system_admin.not_found',
  ALREADY_EXISTS_EMAIL: 'system_admin.already_exists_email',
  ALREADY_EXISTS_USERNAME: 'system_admin.already_exists_username',
  PASSWORD_UPDATED: 'system_admin.password_updated',
  CANNOT_DELETE_DEFAULT: 'system_admin.cannot_delete_default',
  CANNOT_MODIFY_DEFAULT: 'system_admin.cannot_modify_default',
  ACCOUNT_UNLOCKED: 'system_admin.account_unlocked',
  ACCOUNT_NOT_LOCKED: 'system_admin.account_not_locked',
};

// User
export const USER = {
  CREATED: 'user.created',
  UPDATED: 'user.updated',
  DELETED: 'user.deleted',
  BULK_DELETED: 'user.bulk_deleted',
  FETCHED: 'user.fetched',
  LIST_FETCHED: 'user.list_fetched',
  NOT_FOUND: 'user.not_found',
  ALREADY_EXISTS_EMAIL: 'user.already_exists_email',
  ALREADY_EXISTS_USERNAME: 'user.already_exists_username',
  PASSWORD_UPDATED: 'user.password_updated',
  CANNOT_DELETE_DEFAULT: 'user.cannot_delete_default',
  CANNOT_MODIFY_DEFAULT: 'user.cannot_modify_default',
  ACCOUNT_UNLOCKED: 'user.account_unlocked',
  ACCOUNT_NOT_LOCKED: 'user.account_not_locked',
};

// Group
export const GROUP = {
  CREATED: 'group.created',
  UPDATED: 'group.updated',
  DELETED: 'group.deleted',
  BULK_DELETED: 'group.bulk_deleted',
  FETCHED: 'group.fetched',
  LIST_FETCHED: 'group.list_fetched',
  NOT_FOUND: 'group.not_found',
  ALREADY_EXISTS: 'group.already_exists',
  CANNOT_MODIFY_DEFAULT: 'group.cannot_modify_default',
  CANNOT_INCLUDE_DEFAULT_USER: 'group.cannot_include_default_user',
  CANNOT_REMOVE_DEFAULT_USER: 'group.cannot_remove_default_user',
};

// Home
export const HOME = {
  FETCHED: 'home.fetched',
  FETCH_FAILED: 'home.fetch_failed',
};

// Role
export const ROLE = {
  CREATED: 'role.created',
  UPDATED: 'role.updated',
  DELETED: 'role.deleted',
  BULK_DELETED: 'role.bulk_deleted',
  FETCHED: 'role.fetched',
  LIST_FETCHED: 'role.list_fetched',
  NOT_FOUND: 'role.not_found',
  ALREADY_EXISTS: 'role.already_exists',
  CANNOT_MODIFY_DEFAULT: 'role.cannot_modify_default',
  PERMISSIONS_FETCHED: 'role.permissions_fetched',
  INVALID_TYPE: 'role.invalid_type',
  TYPE_MISMATCH: 'role.type_mismatch',
};

// Profile
export const PROFILE = {
  FETCHED: 'profile.fetched',
  LOCALE_UPDATED: 'profile.locale_updated',
};
