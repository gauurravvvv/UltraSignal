/**
 * listPermissions — returns the permission catalog (modules + submodules)
 * the role editor needs to render its table of None/Read/Write/Full
 * radio columns.
 *
 * Query parameters:
 *   ?scope=ORG|SYSTEM       defaults to ORG
 *   ?includeInactive=true   include rows with status = 0 (defaults to
 *                           active-only; only useful for an admin
 *                           "Permission Catalog" management screen)
 *   ?roleId=<uuid>          optional — when present, each submodule row
 *                           (and leaf-only module) is enriched with the
 *                           role's current `level` from
 *                           role_permission_mapping (0 if no mapping)
 *
 * Response shape:
 *   {
 *     count: number,
 *     modules: [
 *       {
 *         id, name, value, status, icon, sequence, scope,
 *         submodules: [
 *           { id, name, value, status, icon, sequence, scope, level? }
 *         ],
 *         level?     // present only on leaf-only modules (e.g. `home`)
 *       }
 *     ]
 *   }
 *
 * Convention: a leaf-only "module" (e.g. `home` — top-level row with no
 * children in the catalog) appears as a module row with an empty
 * `submodules` array AND its own `level` field — the FE treats those as
 * single-row entries in the editor.
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

interface SubmoduleOut {
  id: string;
  name: string;
  value: string;
  status: number;
  icon: string | null;
  sequence: number;
  scope: 'SYSTEM' | 'ORG';
  isMandatory: boolean;
  level?: number;
}

interface ModuleOut extends SubmoduleOut {
  submodules: SubmoduleOut[];
}

const listPermissions = async (req: Request, res: Response) => {
  Logger.info('List Permissions request');

  const scope =
    (req.query.scope as string)?.toUpperCase() === 'SYSTEM' ? 'SYSTEM' : 'ORG';
  const includeInactive =
    (req.query.includeInactive as string)?.toLowerCase() === 'true';
  const roleId = (req.query.roleId as string) || null;

  try {
    const where: Record<string, unknown> = { scope };
    if (!includeInactive) where.status = 1;

    const all = await AppDataSource.getRepository(Permission).find({
      where,
      order: { sequence: 'ASC' },
    });

    // Optional: load this role's mappings to annotate each leaf with
    // its current level.
    let levelByPermId = new Map<string, number>();
    if (roleId) {
      const mappings = await AppDataSource.getRepository(
        RolePermissionMapping,
      ).find({
        where: { roleId },
      });
      levelByPermId = new Map(mappings.map(m => [m.permissionId, m.level]));
    }

    // Build module → submodules hierarchy.
    const modules = all.filter(p => p.parentId === null);
    const submodulesByParent = new Map<string, Permission[]>();
    for (const p of all) {
      if (p.parentId) {
        const list = submodulesByParent.get(p.parentId) ?? [];
        list.push(p);
        submodulesByParent.set(p.parentId, list);
      }
    }

    const toOut = (p: Permission, levelOptional = true): SubmoduleOut => {
      const out: SubmoduleOut = {
        id: p.id,
        name: p.name,
        value: p.value,
        status: p.status,
        icon: p.icon ?? null,
        sequence: p.sequence,
        scope: p.scope,
        isMandatory: p.isMandatory,
      };
      if (roleId && levelOptional) {
        // Mandatory permissions are implicit — they always behave as
        // granted regardless of the role's mapping rows. Report level
        // READ (1) so the FE can render them as locked and visually
        // distinct from "not granted".
        out.level = p.isMandatory ? 1 : levelByPermId.get(p.id) ?? 0;
      }
      return out;
    };

    const out: ModuleOut[] = modules.map(m => {
      const submodules = (submodulesByParent.get(m.id) ?? []).map(c =>
        toOut(c),
      );
      const module: ModuleOut = {
        ...toOut(m, false), // module row itself doesn't carry level unless leaf-only
        submodules,
      };
      // Leaf-only module (no children in the catalog) — surface its own
      // level so the FE can render it as a single grantable row.
      if (roleId && submodules.length === 0) {
        module.level = levelByPermId.get(m.id) ?? 0;
      }
      return module;
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
