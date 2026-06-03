/**
 * getDbStats — aggregates schema, table, and summary statistics from the connected
 * datasource using three SQL queries from `queries.ts`.
 *
 * Tables are de-duplicated into a `schemaTableMap` before building the response — the
 * multi-join in `TABLE_STATS` can produce duplicate rows for tables with multiple indexes
 * or column entries, so first-occurrence-wins deduplication is applied before returning.
 *
 * All queries filter out `pg_catalog`, `information_schema`, `pg_%`, `typeorm_%`, and
 * `dbexec_%` to show only the user's own data. Each query additionally gates results
 * through `has_schema_privilege` / `has_table_privilege` so a restricted database user
 * only sees what they have access to.
 */
import { DatasourceQueryConnection } from './openDatasourceConnection';
import { getErrorMessage } from '../../utility/getErrorMessage';
import Logger from '../../utility/logger/logger';
import { DB_SUMMARY, SCHEMA_STATS, TABLE_STATS } from './queries';

interface DatasourceStats {
  totalSchemas: number;
  totalTables: number;
  totalIndexes: number;
  totalViews: number;
  totalTriggers: number;
  databaseSizeMB: number;
  schemaStats: Array<{
    name: string;
    tableCount: number;
    viewCount: number;
    functionCount: number;
    totalSizeMB: number;
  }>;
  schemas: Array<{
    name: string;
    tables: Array<{
      name: string;
      rowCount: number;
      totalColumns: number;
      totalIndexes: number;
      columns: Array<{
        name: string;
        type: string;
        nullable: boolean;
      }>;
      sizeMB: {
        data: number;
        index: number;
        unused: number;
        total: number;
      };
    }>;
  }>;
}

export const getDatasourceStats = async (
  dbConnection: DatasourceQueryConnection,
): Promise<DatasourceStats> => {
  try {
    const schemaStats = await dbConnection.query(SCHEMA_STATS);

    const tableStats = await dbConnection.query(`
      WITH table_stats AS (${TABLE_STATS}),
      column_counts AS (
        SELECT 
          table_schema,
          table_name,
          COUNT(*) as column_count
        FROM information_schema.columns 
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        AND has_schema_privilege(current_user, table_schema, 'USAGE')
        AND has_table_privilege(current_user, quote_ident(table_schema) || '.' || quote_ident(table_name), 'SELECT')
        GROUP BY table_schema, table_name
      ),
      column_details AS (
        SELECT 
          table_schema as schema_name,
          table_name,
          json_agg(
            json_build_object(
              'name', column_name,
              'type', data_type,
              'nullable', is_nullable = 'YES'
            ) ORDER BY ordinal_position
          ) as columns
        FROM information_schema.columns 
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        AND has_schema_privilege(current_user, table_schema, 'USAGE')
        AND has_table_privilege(current_user, quote_ident(table_schema) || '.' || quote_ident(table_name), 'SELECT')
        GROUP BY table_schema, table_name
      )
      SELECT 
        t.*,
        cc.column_count,
        cd.columns
      FROM table_stats t
      LEFT JOIN column_counts cc 
        ON t."SchemaName" = cc.table_schema 
        AND t."TableName" = cc.table_name
      LEFT JOIN column_details cd
        ON t."SchemaName" = cd.schema_name 
        AND t."TableName" = cd.table_name
      ORDER BY t."SchemaName" DESC, t."TotalSpaceMB" DESC NULLS LAST
    `);

    const dbSummary = await dbConnection.query(DB_SUMMARY);

    const schemaTableMap = tableStats.reduce(
      (acc: { [key: string]: { [key: string]: any } }, table: any) => {
        const schemaName = table.SchemaName;
        const tableName = table.TableName;

        if (!acc[schemaName]) {
          acc[schemaName] = {};
        }

        if (!acc[schemaName][tableName]) {
          acc[schemaName][tableName] = {
            name: tableName,
            rowCount: parseInt(table.RowCounts || 0),
            totalColumns: parseInt(table.column_count || 0),
            totalIndexes: parseInt(table.TotalIndexes || 0),
            columns: table.columns || [],
            sizeMB: {
              total: parseFloat(table.TotalSpaceMB || 0),
              data: parseFloat(table.UsedSpaceMB || 0),
              unused: parseFloat(table.UnusedSpaceMB || 0),
              index:
                parseFloat(table.TotalSpaceMB || 0) -
                parseFloat(table.UsedSpaceMB || 0),
            },
          };
        }

        return acc;
      },
      {},
    );

    const stats: DatasourceStats = {
      totalSchemas: parseInt(dbSummary[0].TotalSchemas),
      totalTables: parseInt(dbSummary[0].TotalTables),
      totalIndexes: parseInt(dbSummary[0].TotalIndexes),
      totalViews: parseInt(dbSummary[0].TotalViews),
      totalTriggers: parseInt(dbSummary[0].TotalTriggers),
      databaseSizeMB: parseFloat(dbSummary[0].DatasourceSizeMB),
      schemaStats: schemaStats
        .map((schema: any) => ({
          name: schema.SchemaName,
          tableCount: parseInt(schema.TableCount) || 0,
          viewCount: parseInt(schema.ViewCount),
          functionCount: parseInt(schema.FunctionCount),
          totalSizeMB: parseFloat(schema.TotalSizeMB),
        }))
        .sort((a: any, b: any) => b.totalSizeMB - a.totalSizeMB),
      schemas: Object.entries(schemaTableMap)
        .map(([schemaName, tables]) => ({
          name: schemaName,
          tables: Object.values(tables as Record<string, any>).sort(
            (a: any, b: any) => b.sizeMB.total - a.sizeMB.total,
          ),
        }))
        .sort((a, b) => {
          const totalSizeA = (a.tables as any[]).reduce(
            (sum: number, table: any) => sum + table.sizeMB.total,
            0,
          );
          const totalSizeB = (b.tables as any[]).reduce(
            (sum: number, table: any) => sum + table.sizeMB.total,
            0,
          );
          return totalSizeB - totalSizeA;
        }),
    };

    return stats;
  } catch (error) {
    Logger.error(
      `Error getting database statistics: ${getErrorMessage(error)}`,
    );
    throw error;
  }
};
