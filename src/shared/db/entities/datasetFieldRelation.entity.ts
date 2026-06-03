import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DatasetField } from './datasetField.entity';

@Entity()
@Index(['fieldId'])
@Index(['referencedFieldId'])
export class DatasetFieldRelation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  fieldId: string;

  @Column({ nullable: false })
  referencedFieldId: string;

  @ManyToOne(() => DatasetField, field => field.fieldRelations)
  @JoinColumn({ name: 'fieldId' })
  field: DatasetField;

  @ManyToOne(() => DatasetField, field => field.referencedInRelations)
  @JoinColumn({ name: 'referencedFieldId' })
  referencedField: DatasetField;
}
