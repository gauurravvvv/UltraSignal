import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Catalog of data source types — the set of upstream systems UltraSignal
 * knows how to ingest from (AEMS, UAN, ...). System-wide reference data,
 * not per-client. Used to populate the type dropdown on the per-client
 * Data Source creation screen.
 *
 *   id        — UUID primary key, used as the FK target from `data_source`.
 *   sourceId  — Stable unique integer (1, 2, ...). Friendly numeric
 *               identifier shown in the UI / referenced by connectors.
 *               Never renumber after seeding; rows that reference it by
 *               code rely on stability.
 *   name      — Human-readable label shown in the dropdown.
 *   scope     — Always 'SYSTEM' for now (platform-defined). Enum column
 *               kept open so a future 'ORG'-scope type (per-client
 *               custom source) can be added without a schema change.
 *
 * Display order is `sourceId ASC` — seed assigns sourceId monotonically,
 * so no separate sequence column is needed.
 */
@Entity('data_source_type')
export class DataSourceType extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', unique: true })
  sourceId: number;

  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Column({
    type: 'enum',
    enum: ['SYSTEM', 'ORG'],
    default: 'SYSTEM',
  })
  scope: 'SYSTEM' | 'ORG';

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
