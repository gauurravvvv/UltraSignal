import {
  BaseEntity,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { EventGroupMapping } from './eventGroupMapping.entity';

/**
 * Event Group — a tenant-scoped, user-curated bundle of MedDRA terms
 * selected at any level of the hierarchy (SOC / HLGT / HLT / PT / LLT)
 * or by SMQ. Reused across Alert Configs.
 *
 * Edit access follows the same record-level ownership rule as Product
 * Group: only the creator (and admins with explicit override) can
 * update an existing group.
 */
@Entity()
@Index(['clientId', 'status'])
@Index(['name', 'clientId'], { unique: true })
export class EventGroup extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: false })
  clientId: string;

  @Column({ nullable: false })
  clientName: string;

  // Optional — if the group is built off a specific MedDRA version or
  // a specific source's coding, capture it here for reproducibility.
  @Column({ type: 'int', nullable: true })
  sourceId: number;

  @OneToMany(() => EventGroupMapping, mapping => mapping.eventGroup)
  members: EventGroupMapping[];

  @Column({
    type: 'enum',
    enum: [0, 1],
    default: 1,
  })
  status!: number;

  @Column({
    type: 'enum',
    enum: [0, 1],
    default: 0,
  })
  isDefault!: number;

  @VersionColumn({ select: false })
  version: number;

  @CreateDateColumn({ nullable: true })
  createdOn?: Date;

  @Column({ nullable: true })
  createdBy?: string;

  @UpdateDateColumn({ nullable: true, select: false })
  updatedOn?: Date;

  @Column({ nullable: true, select: false })
  updatedBy?: string;

  @DeleteDateColumn({ nullable: true, select: false })
  deletedOn?: Date;

  @Column({ nullable: true, select: false })
  deletedBy?: string;
}
