import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
@Index(['organisationId', 'userId'])
@Index(['datasourceId'])
@Index(['createdOn'])
export class QueryExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  userId: string;

  @Column({ nullable: false })
  organisationId: string;

  @Column({ nullable: false })
  datasourceId: string;

  @Column({ nullable: false })
  scriptName: string;

  @Column({ type: 'json', nullable: true })
  queries: string[];

  @Column({ nullable: false })
  tabOrder: number;

  @CreateDateColumn()
  createdOn: Date;

  @UpdateDateColumn()
  updatedOn: Date;

  @Column({ nullable: true })
  createdBy?: string;

  @Column({ nullable: true })
  updatedBy?: string;
}
