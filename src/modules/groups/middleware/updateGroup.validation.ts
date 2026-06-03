/**
 * UpdateGroupValidation — enforces three intersecting invariants before the
 * controller runs.
 *
 *   1. Default groups (`group.isDefault === 1`) keep their metadata frozen
 *      (name / description / status / roleId) but allow membership edits.
 *      Admins legitimately need to add a new hire to the Administrators
 *      group; what they must NOT be able to do is rename Administrators to
 *      something else and lose the system's reference to it.
 *
 *   2. The bootstrap default admin (`user.isDefault === 1`) has a fixed
 *      group membership: always in the default Administrators group,
 *      never in any non-default group. Concretely:
 *        - If the request targets the default group, the default admin
 *          MUST be in the incoming `users[]`. Removing them would orphan
 *          their only Administrator binding and brick the org.
 *        - If the request targets a non-default group, the default admin
 *          MUST NOT be in `users[]`. Scattering them across custom groups
 *          creates cleanup churn if those groups are later deleted.
 *
 *   3. Role is immutable after creation because changing a group's role
 *      would silently cascade permission changes to all members — an
 *      operation that needs an explicit reassign flow rather than an
 *      in-place edit.
 *
 * User membership validation uses the same count-mismatch guard as addGroup
 * to prevent cross-org user probing.
 */
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { In, Not } from 'typeorm';
import { CODE, IS_DEFAULT } from '../../../../config/config';
import {
  GENERIC,
  GROUP as GROUP_MSG,
} from '../../../shared/constants/response.messages';
import { Group } from '../../../shared/db/entities/group.entity';
import { User } from '../../../shared/db/entities/user.entity';
import { getErrorMessage } from '../../../shared/utility/getErrorMessage';
import { fields } from '../../../shared/utility/joi.schemas';
import Logger from '../../../shared/utility/logger/logger';
import sendResponse from '../../../shared/utility/response';
import { validateSchema } from '../../../shared/utility/validate.middleware';
import { AppDataSource } from '../../../shared/db';

const schema = Joi.object({
  id: fields.id.required(),
  name: fields.groupName.required(),
  description: fields.description.optional().allow('', null),
  roleId: fields.id.required(),
  users: Joi.array().items(Joi.string().trim()).min(0).required().messages({
    'array.base': 'Users must be an array',
    'any.required': 'Users are required',
  }),
  status: fields.status.optional(),
  justification: fields.justification.optional(),
});

const UpdateGroupValidation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { orgData } = res.locals;
    const orgId = orgData.id;

    const { error, value } = validateSchema(schema, req.body);
    if (error) {
      return sendResponse(res, false, CODE.BAD_REQUEST, error);
    }
    req.body = value;

    const { id } = value;

    // Check if group exists. `orgId` is sourced from res.locals (set
    // by AuthMiddleware via the JWT and VerifyResourceMiddleware) —
    // never from req.body, which SanitizeOrgInputMiddleware strips.
    const group = await AppDataSource.getRepository(Group).findOne({
      where: { id, organisationId: orgId },
    });

    if (!group) {
      return sendResponse(res, false, CODE.NOT_FOUND, GROUP_MSG.NOT_FOUND);
    }

    // Default groups: metadata (name / description / status) is frozen.
    // Members are still editable — see file header.
    if (group.isDefault === IS_DEFAULT.YES) {
      if (
        value.name !== group.name ||
        (value.description || '') !== (group.description || '') ||
        (value.status !== undefined && value.status !== group.status)
      ) {
        return sendResponse(
          res,
          false,
          CODE.UNAUTHORIZED,
          GROUP_MSG.CANNOT_MODIFY_DEFAULT,
        );
      }
    }

    // Role is immutable once group is created
    if (group.roleId && group.roleId !== value.roleId) {
      return sendResponse(
        res,
        false,
        CODE.BAD_REQUEST,
        'Role cannot be changed for an existing group',
      );
    }

    // Duplicate-name check is meaningful only when the name is
    // changing. Default groups can't rename (blocked above), so the
    // lookup is skipped for them.
    if (group.isDefault !== IS_DEFAULT.YES) {
      const ifExistsByName = await AppDataSource
        .getRepository(Group)
        .findOne({
          where: {
            id: Not(id),
            name: value.name,
            organisationId: orgId,
          },
        });

      if (ifExistsByName) {
        return sendResponse(
          res,
          false,
          CODE.ALREADY_EXISTS,
          GROUP_MSG.ALREADY_EXISTS,
        );
      }
    }

    // Validate user membership rules.
    //
    //   - All listed users must belong to this org (count-mismatch
    //     guard — same as addGroup).
    //   - Default admin is pinned to the default group:
    //       * In a default group, the default admin MUST appear in
    //         users[]; removing them would orphan the only
    //         Administrator binding the org has.
    //       * In any non-default group, the default admin MUST NOT
    //         appear in users[].
    if (value.users?.length || group.isDefault === IS_DEFAULT.YES) {
      const foundUsers = value.users?.length
        ? await AppDataSource.getRepository(User).find({
            where: {
              id: In(value.users),
              organisationId: orgId,
            },
            select: ['id', 'isDefault'],
          })
        : [];

      if (foundUsers.length !== (value.users?.length || 0)) {
        return sendResponse(
          res,
          false,
          CODE.BAD_REQUEST,
          'One or more users not found in this organisation',
        );
      }

      const incomingDefaultUserIds = foundUsers
        .filter((u: User) => u.isDefault === IS_DEFAULT.YES)
        .map((u: User) => u.id);

      if (group.isDefault === IS_DEFAULT.YES) {
        // Default group → default admin must remain a member. Look up
        // the org's default user(s) (typically one) and check that
        // every one is present in the incoming payload.
        const defaultUsers = await AppDataSource
          .getRepository(User)
          .find({
            where: {
              organisationId: orgId,
              isDefault: IS_DEFAULT.YES,
            },
            select: ['id'],
          });
        const missing = defaultUsers.some(
          (du: User) => !incomingDefaultUserIds.includes(du.id),
        );
        if (missing) {
          return sendResponse(
            res,
            false,
            CODE.UNAUTHORIZED,
            GROUP_MSG.CANNOT_REMOVE_DEFAULT_USER,
          );
        }
      } else {
        // Non-default group → default admin must NOT be in users[].
        if (incomingDefaultUserIds.length > 0) {
          return sendResponse(
            res,
            false,
            CODE.UNAUTHORIZED,
            GROUP_MSG.CANNOT_INCLUDE_DEFAULT_USER,
          );
        }
      }
    }

    res.locals.group = group;

    next();
  } catch (error) {
    Logger.error(`Validation error: ${getErrorMessage(error)}`);
    return sendResponse(res, false, CODE.SERVER_ERROR, GENERIC.SERVER_ERROR);
  }
};

export default UpdateGroupValidation;
