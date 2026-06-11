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
 *   sourceId  — stable short code ("AEMS", "UAN"). Never rename after
 *               seeding; the FE / connectors reference it by code.
 *   name      — human-readable label shown in the dropdown.
 *   scope     — always 'SYSTEM' for now (platform-defined). Kept as an
 *               enum column so a future 'ORG'-scope type (per-client
 *               custom source) can be added without a schema change.
 */
@Entity('data_source_type')
export class DataSourceType extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  sourceId: string;

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

  @Column({ type: 'smallint', default: 0 })
  sequence: number;

  @CreateDateColumn({ nullable: true })
  createdOn?: Date;

  @UpdateDateColumn({ nullable: true, select: false })
  updatedOn?: Date;
}
