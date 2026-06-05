export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? String(error) : String(error);
