import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Read-only reference catalog: ingredient → family → product → trade
 * hierarchy plus the system the row was ingested from. Populated by
 * upstream ETL pipelines; the BE exposes a search endpoint over it.
 *
 * `country_id`, `country`, and `language` are intentionally omitted from
 * this version of the table (the FE doesn't surface country localisation
 * for this codebase).
 *
 * Functional index on `LOWER(ingredient_name)` from the original DDL
 * isn't expressed by TypeORM decorators — the search controller uses
 * `ILIKE` which Postgres can still optimise via the plain `ingredient_name`
 * index on Postgres 13+. If you need the exact functional index for
 * performance, create it via raw SQL:
 *
 *   CREATE INDEX IF NOT EXISTS ix_pb_ingredient
 *     ON product_browser USING btree (LOWER(ingredient_name));
 */
@Entity('product_browser')
@Index('ix_pb_source', ['sourceSystem'])
export class ProductBrowser extends BaseEntity {
  // pg-node returns `bigint` as a string by default — keep the JS type
  // aligned so callers don't trip over silent precision loss.
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'text', name: 'source_system' })
  sourceSystem: string;

  @Column({ type: 'text', name: 'client_id', nullable: true })
  clientId?: string | null;

  @Column({ type: 'text', name: 'enterprise_id', nullable: true })
  enterpriseId?: string | null;

  @Column({ type: 'text', name: 'ingredient_id', nullable: true })
  ingredientId?: string | null;

  @Column({ type: 'text', name: 'ingredient_name', nullable: true })
  ingredientName?: string | null;

  @Column({ type: 'text', name: 'family_id', nullable: true })
  familyId?: string | null;

  @Column({ type: 'text', name: 'family_name', nullable: true })
  familyName?: string | null;

  @Column({ type: 'text', name: 'product_id', nullable: true })
  productId?: string | null;

  @Column({ type: 'text', name: 'product_name', nullable: true })
  productName?: string | null;

  @Column({ type: 'text', name: 'product_name_display', nullable: true })
  productNameDisplay?: string | null;

  @Column({ type: 'text', name: 'trade_id', nullable: true })
  tradeId?: string | null;

  @Column({ type: 'text', name: 'trade_name', nullable: true })
  tradeName?: string | null;

  @Column({ type: 'text', name: 'trade_name_display', nullable: true })
  tradeNameDisplay?: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'tgt_insert_date_time' })
  tgtInsertDateTime?: Date;
}
