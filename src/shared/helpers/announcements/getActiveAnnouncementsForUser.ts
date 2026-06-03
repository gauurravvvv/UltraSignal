/**
 * getActiveAnnouncementsForUser — pure helper that returns the
 * announcements visible to a given user in the connected org DB.
 *
 * Originally lived inline in `getAnnouncement` (the GET /announcements/
 * current controller). Lifted here so login can return the same list
 * in the login response and the FE can avoid an extra round-trip plus
 * the 60s polling timer.
 *
 * Visibility rules (all must hold):
 *  1. status = 1 (active)
 *  2. startTime is null OR startTime ≤ now
 *  3. endTime   is null OR endTime   ≥ now
 *  4. targetGroupId is one of the user's groups
 *  5. user has NOT previously dismissed it
 *
 * Returns `[]` (not null) when the user has no groups or no matches —
 * callers can splat into JSON without a null guard.
 */
import { DataSource } from 'typeorm';
import { AnnouncementDismissal } from '../../db/entities/announcement-dismissal.entity';
import { Announcement } from '../../db/entities/announcement.entity';
import { UserGroupMapping } from '../../db/entities/user-group-mapping.entity';

export interface VisibleAnnouncement {
  id: string;
  name: string;
  description: string;
  bgColor: string;
  textColor: string;
  startTime: Date | null;
  endTime: Date | null;
  targetGroup: { id: string; name: string } | null;
}

export const getActiveAnnouncementsForUser = async (
  connection: DataSource,
  orgId: string,
  userId: string,
): Promise<VisibleAnnouncement[]> => {
  const userGroups = await connection
    .getRepository(UserGroupMapping)
    .find({ where: { userId }, select: ['groupId'] });

  if (!userGroups.length) return [];

  const groupIds = userGroups.map((g: any) => g.groupId);

  const dismissals = await connection
    .getRepository(AnnouncementDismissal)
    .find({ where: { userId }, select: ['announcementId'] });
  const dismissedIds = dismissals.map((d: any) => d.announcementId);

  const currentDate = new Date();

  const qb = connection
    .getRepository(Announcement)
    .createQueryBuilder('a')
    .leftJoinAndSelect('a.targetGroup', 'g')
    .where('a.organisationId = :orgId', { orgId })
    .andWhere('a.status = :status', { status: 1 })
    .andWhere('a.targetGroupId IN (:...groupIds)', { groupIds })
    .andWhere('(a.startTime IS NULL OR a.startTime <= :currentDate)', {
      currentDate,
    })
    .andWhere('(a.endTime IS NULL OR a.endTime >= :currentDate)', {
      currentDate,
    })
    .orderBy('a.createdOn', 'DESC');

  if (dismissedIds.length > 0) {
    qb.andWhere('a.id NOT IN (:...dismissedIds)', { dismissedIds });
  }

  const rows = await qb.getMany();
  return rows.map((a: any) => ({
    ...a,
    targetGroup: a.targetGroup
      ? { id: a.targetGroup.id, name: a.targetGroup.name }
      : null,
  }));
};
