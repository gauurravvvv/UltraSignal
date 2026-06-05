import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * MedDRA Browser — the global Medical Dictionary for Regulatory
 * Activities hierarchy used to classify adverse events.
 *
 * Unlike ProductBrowser, MedDRA is NOT tenant-scoped: the dictionary is
 * licensed centrally and identical for every client. Rows are loaded by
 * the platform ETL on MedDRA version upgrades.
 *
 * Hierarchy levels (top → bottom):
 *   SOC  — System Organ Class
 *   HLGT — High Level Group Term
 *   HLT  — High Level Term
 *   PT   — Preferred Term
 *   LLT  — Lowest Level Term
 *
 * SMQ (Standardised MedDRA Queries) are curated event groupings that
 * cut across the hierarchy. `termScope` distinguishes narrow vs broad
 * SMQ membership.
 */
@Entity()
@Index(['pt_code'])
@Index(['soc_code'])
export class MeddraBrowser extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  smq_code: string;

  @Column({ type: 'text', nullable: true })
  smq_name: string;

  @Column({ type: 'text', nullable: true })
  term_scope: string;

  @Column({ nullable: true })
  soc_code: string;

  @Column({ nullable: true })
  soc_name: string;

  @Column({ nullable: true })
  hlgt_code: string;

  @Column({ nullable: true })
  hlgt_name: string;

  @Column({ nullable: true })
  hlt_code: string;

  @Column({ nullable: true })
  hlt_name: string;

  @Column({ nullable: true })
  pt_code: string;

  @Column({ nullable: true })
  pt_name: string;

  @Column({ nullable: true })
  llt_code: string;

  @Column({ nullable: true })
  llt_name: string;

  @Column({ nullable: true })
  primary_path: string;

  @Column({ type: 'varchar', length: 10, default: 'en' })
  language: string;

  @Column({ type: 'timestamptz', nullable: true })
  tgt_insert_date_time: Date | null;
}
