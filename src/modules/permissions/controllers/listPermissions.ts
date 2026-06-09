/**
 * listPermissions — returns the permission catalog (modules + screens)
 * the role editor needs to render its table of None/Read/Write/Full
 * radio columns.
 *
 * Query parameters:
 *   ?scope=ORG|SYSTEM       (defaults to ORG)
 *   ?roleId=<uuid>          (optional — when present, each screen row
 *                            is enriched with the role's current `level`
 *                            from role_permission_mapping, or 0 if no
 *                            mapping row exists)
 *
 * Response shape:
 *   {
 *     modules: [
 *       {
 *         id, value, name, icon, sequence, scope,
 *         screens: [
 *           { id, value, name, icon, sequence, scope, level? }
 *         ]
 *       }
 *     ]
 *   }
 *
 * Convention: a leaf-only "module" (e.g. `home`) appears as a module row
 * with an empty `screens` array AND its own `level` field — the FE
 * treats those as single-row entries in the editor.
 */
import { Request, Response } from 'express';
import { CODE } from '../../../../config/config';
import { GENERIC } from '../../../shared/constants/response.messages';
import { AppDataSource } from '../../../shared/db';
import { Permission } from '../../../shared/db/entities/permission.entity';
import { RolePermissionMapping } from '../../../shared/db/entities/role-permission-mapping.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';

interface ScreenOut {
  id: string;
  value: string;
  name: string;
  icon: string | null;
  sequence: number;
  scope: 'SYSTEM' | 'ORG';
  level?: number;
}

interface ModuleOut extends ScreenOut {
  screens: ScreenOut[];
}

const listPermissions = async (req: Request, res: Response) => {
  Logger.info('List Permissions request');

  const scope = (req.query.scope as string)?.toUpperCase() === 'SYSTEM' ? 'SYSTEM' : 'ORG';
  const roleId = (req.query.roleId as string) || null;

  try {
    const all = await AppDataSource.getRepository(Permission).find({
      where: { scope, status: 1 },
      order: { sequence: 'ASC' },
    });

    // Optional: load this role's mappings to annotate each leaf with
    // its current level.
    let levelByPermId = new Map<string, number>();
    if (roleId) {
      const mappings = await AppDataSource.getRepository(RolePermissionMapping).find({
        where: { roleId },
      });
      levelByPermId = new Map(mappings.map(m => [m.permissionId, m.level]));
    }

    // Build module → screens hierarchy.
    const modules = all.filter(p => p.parentId === null);
    const screensByParent = new Map<string, Permission[]>();
    for (const p of all) {
      if (p.parentId) {
        const list = screensByParent.get(p.parentId) ?? [];
        list.push(p);
        screensByParent.set(p.parentId, list);
      }
    }

    const out: ModuleOut[] = modules.map(m => {
      const children = (screensByParent.get(m.id) ?? []).map(c => ({
        id: c.id,
        value: c.value,
        name: c.name,
        icon: c.icon,
        sequence: c.sequence,
        scope: c.scope,
        ...(roleId ? { level: levelByPermId.get(c.id) ?? 0 } : {}),
      }));
      return {
        id: m.id,
        value: m.value,
        name: m.name,
        icon: m.icon,
        sequence: m.sequence,
        scope: m.scope,
        ...(roleId && children.length === 0
          ? { level: levelByPermId.get(m.id) ?? 0 }
          : {}),
        screens: children,
      };
    });

    return sendResponse(res, true, CODE.SUCCESS, 'permission.list_fetched', {
      count: out.length,
      modules: out,
    });
  } catch (error) {
    Logger.error(`Error in listPermissions: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default listPermissions;
