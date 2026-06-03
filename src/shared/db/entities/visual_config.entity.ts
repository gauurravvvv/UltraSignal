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
import { Visual } from './visual.entity';

@Entity()
@Index(['visualId'])
@Index(['analysisId'])
@Index(['clientId', 'datasourceId'])
export class VisualConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  chartType: string;

  @Column({ nullable: true })
  xAxisColumn: string;

  @Column({ nullable: true })
  yAxisColumn: string;

  @Column({ type: 'jsonb', nullable: false })
  config: any;

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

  @Column({ nullable: false })
  visualId: string;

  @OneToOne(() => Visual, visual => visual.visualConfig)
  @JoinColumn({ name: 'visualId' })
  visual: Visual;
}
