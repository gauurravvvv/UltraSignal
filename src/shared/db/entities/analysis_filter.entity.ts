import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Analyses } from './analyses.entity';

@Entity()
@Index(['analysisId'])
@Index(['organisationId', 'datasourceId'])
export class AnalysisFilter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  analysisId: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  filterType: string;
  // 'category' | 'numeric_equality' | 'numeric_range' | 'time_equality' | 'time_range'

  @Column({ type: 'varchar', length: 255, nullable: false })
  columnName: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  controlType: string;
  // 'dropdown' | 'list' | 'slider' | 'text' | 'textarea' | 'datepicker'

  @Column({ type: 'jsonb', nullable: true })
  config: {
    // Category
    matchOperator?: string;
    // TODO: categoryValues is declared but no FE flow currently
    // writes it. It was meant as a curated allow-list of dropdown
    // values (a subset of the column's DISTINCT). The dialog
    // instead persists the user's picks as `defaultValue`. Either
    // wire the dialog to write this field — and run it through
    // validateFilterDefaults at save + initializeCategoryDefault at
    // load — or remove it from the type. Leaving it as-is risks a
    // future FE consumer persisting values that get no staleness
    // checks.
    categoryValues?: string[];
    // Numeric
    numericValue?: number;
    rangeMin?: number;
    rangeMax?: number;
    includeMin?: boolean;
    includeMax?: boolean;
    aggregation?: string;
    // Date
    dateValue?: string;
    dateRangeStart?: string;
    dateRangeEnd?: string;
    timeGranularity?: string;
    // Control
    multiSelect?: boolean;
    showSearch?: boolean;
    showApplyButton?: boolean;
    placeholder?: string;
    defaultValue?: any;
  };

  @Column({ type: 'varchar', length: 20, default: 'ALL_VALUES' })
  nullOption: string;

  @Column({ default: true })
  isEnabled: boolean;

  @Column({ default: false })
  isMandatory: boolean;

  @Column({ default: 0 })
  sequence: number;

  // ── Denormalized fields (match Visual/VisualConfig pattern) ──

  @Column({ nullable: false })
  organisationId: string;

  @Column({ nullable: false })
  organisationName: string;

  @Column({ nullable: false })
  datasourceId: string;

  @Column({ nullable: false })
  datasetId: string;

  // ── Audit fields ──

  @CreateDateColumn({ nullable: true })
  createdOn?: Date;

  @Column({ nullable: true, select: false })
  createdBy?: string;

  @UpdateDateColumn({ nullable: true, select: false })
  updatedOn?: Date;

  @Column({ nullable: true, select: false })
  updatedBy?: string;

  // ── Relations ──

  @ManyToOne(() => Analyses)
  @JoinColumn({ name: 'analysisId' })
  analysis: Analyses;
}
