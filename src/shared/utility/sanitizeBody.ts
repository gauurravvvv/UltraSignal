const SENSITIVE_KEYS = [
  'password',
  'pepperKey',
  'token',
  'refreshToken',
  'otp',
  'secretValue',
  'encryptionKey',
];

/**
 * Deep-clones the request body and replaces sensitive field values with '[REDACTED]'.
 * Handles nested objects (e.g., adminCredentials.password).
 */
export function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') return body;

  const clone = JSON.parse(JSON.stringify(body));

  const redact = (obj: any) => {
    for (const key of Object.keys(obj)) {
      if (SENSITIVE_KEYS.includes(key)) {
        obj[key] = '[REDACTED]';
      } else if (
        obj[key] &&
        typeof obj[key] === 'object' &&
        !Array.isArray(obj[key])
      ) {
        redact(obj[key]);
      }
    }
  };

  redact(clone);
  return clone;
}
