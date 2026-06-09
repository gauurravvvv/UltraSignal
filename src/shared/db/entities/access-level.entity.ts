import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Catalog of access levels — the values that go into
 * `role_permission_mapping.level`.
 *
 *   value=0  code='NONE'   →  screen hidden / route 401
 *   value=1  code='READ'   →  list & view only (GET)
 *   value=2  code='WRITE'  →  create + edit (POST / PUT) — implies READ
 *   value=3  code='FULL'   →  delete + admin actions  — implies WRITE
 *
 * Stored in the DB (rather than only as a code constant) so:
 *   - the FE role editor can fetch the level catalog from /api/v1/access-levels
 *     instead of duplicating it in the FE code
 *   - labels / descriptions can be edited without a backend redeploy
 *   - a future fifth level (e.g. APPROVE) is an INSERT, not a code change
 *
 * The numeric `value` is the source of truth — `level >= requiredLevel`
 * comparisons in `VerifyPermissionMiddleware` work because higher numbers
 * imply lower ones.
 */
@Entity('access_level')
export class AccessLevel extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Numeric value — used for the actual comparison in middleware
   * (`userLevel >= requiredLevel`). Unique.
   */
  @Column({ type: 'smallint', unique: true })
  value: number;

  /**
   * Stable machine-readable code — referenced by code constants
   * (`ACCESS.READ`). Never rename after seeding.
   */
  @Column({ type: 'varchar', length: 16, unique: true })
  code: string;

  /**
   * Human-readable label for the role-editor UI ("None", "Read", "Write", "Full").
   */
  @Column({ type: 'varchar', length: 32 })
  label: string;

  /**
   * One-line tooltip / helper text shown in the role editor.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  /**
   * Display order in the role editor (0=None first, 3=Full last).
   */
  @Column({ type: 'smallint', default: 0 })
  sequence: number;

  @Column({
    type: 'enum',
    enum: [0, 1],
    default: 1,
  })
  status: number;

  @CreateDateColumn({ nullable: true })
  createdOn?: Date;

  @UpdateDateColumn({ nullable: true, select: false })
  updatedOn?: Date;
}
