import {
  BaseEntity,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

/**
 * Product Browser — tenant-scoped product reference data ingested from
 * external pharmacovigilance sources (AEMS/FAERS, EVDAS, VigiBase, UAN).
 * Rows are written by the ETL pipeline; the application reads them to
 * power the Product Browser used by Product Group, Alert Config, etc.
 *
 * `productId`, `ingredientId`, `familyId`, `licenseId`, `countryId` are
 * preserved as the source-system numeric identifiers so re-ingestion is
 * idempotent. `id` is the UltraSignal UUID surrogate key used by joins.
 */
@Entity()
@Index(['clientId', 'enterpriseId'])
@Index(['clientId', 'status'])
export class ProductBrowser extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  clientId: string;

  @Column({ nullable: false })
  clientName: string;

  @Column({ nullable: true })
  enterpriseId: string;

  @Column({ nullable: true })
  ingredientId: string;

  @Column({ nullable: true })
  ingredient: string;

  @Column({ nullable: true })
  familyId: string;

  @Column({ nullable: true })
  familyName: string;

  @Column({ nullable: true })
  productId: string;

  @Column({ type: 'text', nullable: true })
  prodNameUse: string;

  @Column({ nullable: true })
  prodNameDisplay: string;

  @Column({ nullable: true })
  licenseId: string;

  @Column({ type: 'text', nullable: true })
  tradeNameUse: string;

  @Column({ nullable: true })
  tradeNameDisplay: string;

  @Column({ nullable: true })
  countryId: string;

  @Column({ nullable: true })
  country: string;

  @Column({ type: 'varchar', length: 10, default: 'en' })
  language: string;

  // Source identifier — which external dataset this row came from
  // (1=AEMS/FAERS, 2=EVDAS, 3=VigiBase, 4=UAN, etc.). Used by the
  // browser UI to let analysts filter by source.
  @Column({ type: 'int', nullable: true })
  sourceId: number;

  @Column({ type: 'timestamptz', nullable: true })
  tgtInsertDateTime: Date | null;

  @Column({
    type: 'enum',
    enum: [0, 1],
    default: 1,
  })
  status!: number;

  @VersionColumn({ select: false })
  version: number;

  @CreateDateColumn({ nullable: true })
  createdOn?: Date;

  @Column({ nullable: true, select: false })
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
