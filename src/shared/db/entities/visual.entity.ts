import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Analyses } from './analyses.entity';
import { VisualConfig } from './visual_config.entity';

@Entity()
@Index(['analysisId'])
@Index(['clientId', 'datasourceId'])
export class Visual {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  title: string;

  @Column({ nullable: false, default: '0' })
  widthRatio: string;

  @Column({ nullable: false, default: '0' })
  heightRatio: string;

  @Column({ nullable: false, default: '0' })
  xRatio: string;

  @Column({ nullable: false, default: '0' })
  yRatio: string;

  @Column({ nullable: false })
  clientId: string;

  @Column({ nullable: false })
  clientName: string;

  @Column({ nullable: false })
  datasourceId: string;

  @Column({ nullable: false })
  datasetId: string;

  @Column({ nullable: false })
  analysisId: string;

  @ManyToOne(() => Analyses, analyses => analyses.visuals)
  @JoinColumn({ name: 'analysisId' })
  analysis: Analyses;

  @OneToOne(() => VisualConfig, visualConfig => visualConfig.visual)
  visualConfig: VisualConfig;

  // Stable ordering across analysis versions. Without this, the
  // insertion order from a deep-copy clone is the only ordering
  // signal and Postgres makes no guarantee about it; visuals would
  // re-shuffle between A1 and A2 even when the user changed nothing
  // about them. Sequence is assigned at clone-time from the source
  // version's ordering and bumped only when the user explicitly
  // reorders.
  @Column({ type: 'int', nullable: false, default: 0 })
  sequence: number;
}
