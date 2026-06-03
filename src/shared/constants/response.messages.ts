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
  ID_REQUIRED: 'client.id_required',
  INVALID_ID: 'client.invalid_id',
  DB_CONNECTION_FAILED: 'client.db_connection_failed',
  MASTER_DB_REFRESHED: 'client.master_db_refreshed',
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

// Client Admin
export const CLIENT_ADMIN = {
  CREATED: 'client_admin.created',
  UPDATED: 'client_admin.updated',
  DELETED: 'client_admin.deleted',
  FETCHED: 'client_admin.fetched',
  LIST_FETCHED: 'client_admin.list_fetched',
  NOT_FOUND: 'client_admin.not_found',
  ALREADY_EXISTS_EMAIL: 'client_admin.already_exists_email',
  ALREADY_EXISTS_USERNAME: 'client_admin.already_exists_username',
  PASSWORD_UPDATED: 'client_admin.password_updated',
  CANNOT_DELETE_DEFAULT: 'client_admin.cannot_delete_default',
  ACCOUNT_UNLOCKED: 'client_admin.account_unlocked',
  ACCOUNT_NOT_LOCKED: 'client_admin.account_not_locked',
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

// Datasource
export const DATASOURCE = {
  CREATED: 'datasource.created',
  UPDATED: 'datasource.updated',
  DELETED: 'datasource.deleted',
  BULK_DELETED: 'datasource.bulk_deleted',
  FETCHED: 'datasource.fetched',
  LIST_FETCHED: 'datasource.list_fetched',
  NOT_FOUND: 'datasource.not_found',
  ALREADY_EXISTS: 'datasource.already_exists',
  CONNECTION_FAILED: 'datasource.connection_failed',
  CONNECTION_SUCCESS: 'datasource.connection_success',
  MASTER_NOT_FOUND: 'datasource.master_not_found',
  STRUCTURE_FETCHED: 'datasource.structure_fetched',
  VALIDATED: 'datasource.validated',
  SCHEMA_NOT_FOUND: 'datasource.schema_not_found',
  TABLE_NOT_FOUND: 'datasource.table_not_found',
};

// Connection
export const CONNECTION = {
  CREATED: 'connection.created',
  UPDATED: 'connection.updated',
  DELETED: 'connection.deleted',
  BULK_DELETED: 'connection.bulk_deleted',
  FETCHED: 'connection.fetched',
  LIST_FETCHED: 'connection.list_fetched',
  NOT_FOUND: 'connection.not_found',
  ALREADY_EXISTS: 'connection.already_exists',
  TEST_SUCCESS: 'connection.test_success',
  TEST_FAILED: 'connection.test_failed',
  TERMINATED: 'connection.terminated',
  PROCESS_NOT_FOUND: 'connection.process_not_found',
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

// Access
export const ACCESS = {
  GRANTED: 'access.granted',
  REVOKED: 'access.revoked',
  LIST_FETCHED: 'access.list_fetched',
  NOT_FOUND: 'access.not_found',
  ALREADY_EXISTS: 'access.already_exists',
  DATASOURCE_DETAILS_NOT_FOUND: 'access.datasource_details_not_found',
  CONNECTION_NOT_FOUND: 'access.connection_not_found',
};

// Dataset
export const DATASET = {
  CREATED: 'dataset.created',
  UPDATED: 'dataset.updated',
  DELETED: 'dataset.deleted',
  BULK_DELETED: 'dataset.bulk_deleted',
  FETCHED: 'dataset.fetched',
  LIST_FETCHED: 'dataset.list_fetched',
  NOT_FOUND: 'dataset.not_found',
  ALREADY_EXISTS: 'dataset.already_exists',
  ID_REQUIRED: 'dataset.id_required',
  FIELD_VALIDATED: 'dataset.field_validated',
  FORMULA_VALIDATED: 'dataset.formula_validated',
  FORMULA_INVALID: 'dataset.formula_invalid',
  QUERY_EXECUTION_FAILED: 'dataset.query_execution_failed',
  DUPLICATED: 'dataset.duplicated',
};

// Tab
export const TAB = {
  CREATED: 'tab.created',
  UPDATED: 'tab.updated',
  DELETED: 'tab.deleted',
  BULK_DELETED: 'tab.bulk_deleted',
  FETCHED: 'tab.fetched',
  LIST_FETCHED: 'tab.list_fetched',
  NOT_FOUND: 'tab.not_found',
  ALREADY_EXISTS: 'tab.already_exists',
};

// Section
export const SECTION = {
  CREATED: 'section.created',
  UPDATED: 'section.updated',
  DELETED: 'section.deleted',
  BULK_DELETED: 'section.bulk_deleted',
  FETCHED: 'section.fetched',
  LIST_FETCHED: 'section.list_fetched',
  NOT_FOUND: 'section.not_found',
  ALREADY_EXISTS: 'section.already_exists',
};

// Prompt
export const PROMPT = {
  CREATED: 'prompt.created',
  UPDATED: 'prompt.updated',
  DELETED: 'prompt.deleted',
  BULK_DELETED: 'prompt.bulk_deleted',
  FETCHED: 'prompt.fetched',
  LIST_FETCHED: 'prompt.list_fetched',
  NOT_FOUND: 'prompt.not_found',
  ALREADY_EXISTS: 'prompt.already_exists',
  VALUES_FETCHED: 'prompt.values_fetched',
  ID_REQUIRED: 'prompt.id_required',
};

// Query Builder
export const QUERY_BUILDER = {
  CREATED: 'query_builder.created',
  UPDATED: 'query_builder.updated',
  DELETED: 'query_builder.deleted',
  BULK_DELETED: 'query_builder.bulk_deleted',
  FETCHED: 'query_builder.fetched',
  LIST_FETCHED: 'query_builder.list_fetched',
  NOT_FOUND: 'query_builder.not_found',
  ALREADY_EXISTS: 'query_builder.already_exists',
  PROMPTS_FETCHED: 'query_builder.prompts_fetched',
  PROMPTS_SAVED: 'query_builder.prompts_saved',
  SQL_GENERATED: 'query_builder.sql_generated',
  ID_REQUIRED: 'query_builder.id_required',
};

// Analysis
export const ANALYSIS = {
  CREATED: 'analysis.created',
  UPDATED: 'analysis.updated',
  DELETED: 'analysis.deleted',
  BULK_DELETED: 'analysis.bulk_deleted',
  FETCHED: 'analysis.fetched',
  LIST_FETCHED: 'analysis.list_fetched',
  NOT_FOUND: 'analysis.not_found',
  ALREADY_EXISTS: 'analysis.already_exists',
  ID_REQUIRED: 'analysis.id_required',
};

// Analysis Filter
export const ANALYSIS_FILTER = {
  CREATED: 'analysis_filter.created',
  UPDATED: 'analysis_filter.updated',
  DELETED: 'analysis_filter.deleted',
  FETCHED: 'analysis_filter.fetched',
  LIST_FETCHED: 'analysis_filter.list_fetched',
  NOT_FOUND: 'analysis_filter.not_found',
  VALUES_FETCHED: 'analysis_filter.values_fetched',
  VALUES_FETCH_FAILED: 'analysis_filter.values_fetch_failed',
  INVALID_FILTER_TYPE: 'analysis_filter.invalid_filter_type',
  INVALID_CONTROL_TYPE: 'analysis_filter.invalid_control_type',
  COLUMN_REQUIRED: 'analysis_filter.column_required',
};

// Visual
export const VISUAL = {
  CREATED: 'visual.created',
  UPDATED: 'visual.updated',
  DELETED: 'visual.deleted',
  FETCHED: 'visual.fetched',
  LIST_FETCHED: 'visual.list_fetched',
  NOT_FOUND: 'visual.not_found',
  EMPTY_CONFIG: 'visual.empty_config',
};

// Announcement
export const ANNOUNCEMENT = {
  SAVED: 'announcement.saved',
  SAVE_FAILED: 'announcement.save_failed',
  UPDATED: 'announcement.updated',
  UPDATE_FAILED: 'announcement.update_failed',
  DELETED: 'announcement.deleted',
  DELETE_FAILED: 'announcement.delete_failed',
  LIST_FETCHED: 'announcement.list_fetched',
  LIST_FETCH_FAILED: 'announcement.list_fetch_failed',
  ACTIVE_FETCHED: 'announcement.active_fetched',
  ACTIVE_FETCH_FAILED: 'announcement.active_fetch_failed',
  DETAILS_FETCHED: 'announcement.details_fetched',
  DETAILS_FETCH_FAILED: 'announcement.details_fetch_failed',
  DISMISSED: 'announcement.dismissed',
  DISMISS_FAILED: 'announcement.dismiss_failed',
  NOT_FOUND: 'announcement.not_found',
  TARGET_GROUP_NOT_FOUND: 'announcement.target_group_not_found',
};

// Home
export const HOME = {
  FETCHED: 'home.fetched',
  FETCH_FAILED: 'home.fetch_failed',
};

// Dashboard
export const DASHBOARD = {
  CREATED: 'dashboard.created',
  FETCHED: 'dashboard.fetched',
  RENDERED: 'dashboard.rendered',
  LISTED: 'dashboard.listed',
  DELETED: 'dashboard.deleted',
  BULK_DELETED: 'dashboard.bulk_deleted',
  NOT_FOUND: 'dashboard.not_found',
  ALREADY_EXISTS: 'dashboard.already_exists',
};

// Audit Log
export const AUDIT_LOG = {
  LIST_FETCHED: 'audit_log.list_fetched',
  FETCH_FAILED: 'audit_log.fetch_failed',
  EXPORT_FAILED: 'audit_log.export_failed',
  NO_LOGS_FOUND: 'audit_log.no_logs_found',
  INVALID_EXPORT_FORMAT: 'audit_log.invalid_export_format',
  CLIENT_REQUIRED_FOR_EXPORT: 'audit_log.client_required_for_export',
  NO_LOGS_FOR_CLIENT: 'audit_log.no_logs_for_client',
};

// Login Activity
export const LOGIN_ACTIVITY = {
  LIST_FETCHED: 'login_activity.list_fetched',
  FETCH_FAILED: 'login_activity.fetch_failed',
  EXPORT_FAILED: 'login_activity.export_failed',
  NO_ACTIVITY_FOUND: 'login_activity.no_activity_found',
  NO_ACTIVITY_FOR_CLIENT: 'login_activity.no_activity_for_client',
};

// Query
export const QUERY = {
  EXECUTED: 'query.executed',
  EXECUTION_FAILED: 'query.execution_failed',
  SAVED: 'query.saved',
  FETCHED: 'query.fetched',
  LIST_FETCHED: 'query.list_fetched',
  DELETED: 'query.deleted',
  NOT_FOUND: 'query.not_found',
  ID_REQUIRED: 'query.id_required',
  REQUIRED: 'query.required',
  INVALID: 'query.invalid',
  CANCELLED: 'query.cancelled',
  PROCESS_NOT_FOUND: 'query.process_not_found',
  CANCEL_NOT_PERMITTED: 'query.cancel_not_permitted',
  CANCEL_NOT_SUPPORTED: 'query.cancel_not_supported',
};

// RLS Rule
export const RLS_RULE = {
  CREATED: 'rls_rule.created',
  UPDATED: 'rls_rule.updated',
  DELETED: 'rls_rule.deleted',
  LIST_FETCHED: 'rls_rule.list_fetched',
  FETCHED: 'rls_rule.fetched',
  NOT_FOUND: 'rls_rule.not_found',
  ALREADY_EXISTS: 'rls_rule.already_exists',
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

// Search
export const SEARCH = {
  RESULTS_FETCHED: 'search.results_fetched',
  FETCH_FAILED: 'search.fetch_failed',
};
