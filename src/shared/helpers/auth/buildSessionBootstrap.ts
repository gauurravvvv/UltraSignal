/**
 * buildSessionBootstrap — assembles the phase-2 "session-ready"
 * payload for GET /api/v1/auth/session.
 *
 * Inputs:
 *  - user: an already-authenticated User row (caller is responsible
 *    for credential verification and account-state checks before
 *    handing the user here).
 *  - client: the Client row with `config` relation loaded.
 *
 * Output mirrors the DBExec FE contract so the Relay component
 * stays portable. `theme` and `branding` are returned as `null` and
 * `announcements` as `[]` because UltraSignal does not yet ship
 * those modules — placeholders so the FE shape is forward-compatible.
 *
 * Errors propagate to the caller (getSession), which decides how to
 * respond to the client.
 */
import { Client } from '../../db/entities/client.entity';
import { User } from '../../db/entities/user.entity';
import { AppDataSource } from '../../db';
import { resolveUserPermissions } from '../../utility/resolveUserPermissions';
import { sanitiseUser } from '../../utility/sanitiseUser';

export interface SessionBootstrap {
  user: Record<string, unknown>;
  permissions: unknown[];
  role: string;
  sessionInactivityTimeout: number;
  theme: null;
  branding: null;
  announcements: unknown[];
}

export async function buildSessionBootstrap(
  user: User,
  client: Client,
): Promise<SessionBootstrap> {
  const resolved = await resolveUserPermissions(AppDataSource, user.id);

  return {
    user: sanitiseUser(user),
    permissions: resolved.permissions,
    role: resolved.roleName,
    sessionInactivityTimeout: client.config?.sessionInactivityTimeout || 30,
    theme: null,
    branding: null,
    announcements: [],
  };
}
