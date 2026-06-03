/**
 * enrichDataWithCustomFields — appends computed custom field values to every data row.
 *
 * Custom fields are processed in topological order (dependencies first) so a field
 * that references another custom field sees the already-computed value rather than
 * the raw source value. Processing one field at a time across all rows (rather than
 * all fields per row) is required for aggregate functions that need the full column
 * of a prior custom field to compute (e.g. `SUM` of a calculated field).
 *
 * Errors in a single field's formula set that field to `null` for the affected row
 * rather than throwing — a broken formula should not prevent the rest of the dataset
 * from rendering.
 */
import { DatasetField } from '../../db/entities/datasetField.entity';
import { FormulaCompiler } from '../visualisations/calculatedFields';
import { topologicalSort } from './topologicalSort';

export const enrichDataWithCustomFields = (
  dataRows: any[],
  customFields: DatasetField[],
): any[] => {
  if (!customFields || customFields.length === 0) {
    return dataRows;
  }

  const sortedFields = topologicalSort(customFields);

  let enrichedData = dataRows.map(row => ({ ...row }));

  sortedFields.forEach(field => {
    if (field.customLogic) {
      const compiledFormula = FormulaCompiler.compile(field.customLogic);

      enrichedData = enrichedData.map((row, index) => {
        try {
          const computedValue = compiledFormula(row, enrichedData, index);
          return { ...row, [field.columnToUse]: computedValue };
        } catch (error) {
          return { ...row, [field.columnToUse]: null };
        }
      });
    }
  });

  return enrichedData;
};
