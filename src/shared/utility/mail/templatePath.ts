import * as fs from 'fs';
import * as path from 'path';

/**
 * Resolve an email template's path on disk, regardless of whether the
 * server is running from `src/` via ts-node (dev) or from `dist/src/`
 * after compilation (prod).
 *
 * Previously each helper hardcoded `__dirname + ../../../public/...`
 * which only worked in prod — in ts-node `__dirname` is `src/shared/...`
 * so the resolved path became `src/public/...`, which doesn't exist
 * because the build step copies `public/` into `dist/public/` only.
 *
 * The fix: try the project root first (`process.cwd()/public/...`),
 * then fall back to walking up from `__dirname` so the function also
 * works when the cwd has been changed elsewhere in the process. Both
 * paths cover dev and prod respectively.
 */
export const resolveEmailTemplate = (fileName: string): string => {
  // Primary: project root + /public/emailTemplate/<file>
  const cwdPath = path.join(
    process.cwd(),
    'public',
    'emailTemplate',
    fileName,
  );
  if (fs.existsSync(cwdPath)) return cwdPath;

  // Fallback for production builds: dist/src/.../mail/  →  dist/public/...
  // i.e. walk up three levels and join `public/emailTemplate/<file>`.
  const distPath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'public',
    'emailTemplate',
    fileName,
  );
  if (fs.existsSync(distPath)) return distPath;

  // Surface a clear error so this is easy to diagnose if neither
  // path exists (e.g. the file is misspelled or the copy-files
  // build step was skipped).
  throw new Error(
    `Email template not found. Tried:\n  ${cwdPath}\n  ${distPath}`,
  );
};
