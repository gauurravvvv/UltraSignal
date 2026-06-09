/**
 * Strip sensitive / internal fields from a user row before sending
 * it to a client. Single source of truth for the auth response
 * sanitisation contract — used by login (phase 1) and
 * buildSessionBootstrap (phase 2).
 */
export function sanitiseUser(user: any): Record<string, unknown> {
  if (!user) return {};
  const {
    password,
    refreshToken,
    refreshTokenExpiresAt,
    otp,
    otpExpiresAt,
    sessionId,
    failedLoginAttempts,
    accountLockedAt,
    version,
    createdBy,
    updatedBy,
    updatedOn,
    deletedBy,
    deletedOn,
    setupToken,
    setupTokenExpiresAt,
    ...safe
  } = user;
  return safe;
}
