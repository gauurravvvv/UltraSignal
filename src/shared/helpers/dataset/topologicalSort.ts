/**
 * topologicalSort — orders custom dataset fields so each field is computed after any
 * other custom fields it depends on.
 *
 * Uses Kahn's algorithm (BFS, in-degree reduction). `columnToUse` is the stable key
 * rather than `name` because name can be renamed without changing the formula
 * references — using `columnToUse` keeps the dependency graph stable across renames.
 *
 * Only cross-field dependencies on OTHER custom fields are counted — references to
 * base dataset columns are ignored because those are always available.
 *
 * If a circular dependency is detected (result length < input length), the original
 * order is returned as a fallback. The circular fields may compute incorrectly but
 * this is better than crashing — the admin can fix the formula definition.
 */
import { DatasetField } from '../../db/entities/datasetField.entity';
import { FormulaCompiler } from '../visualisations/calculatedFields';

export const topologicalSort = (
  customFields: DatasetField[],
): DatasetField[] => {
  const fieldNames = new Set(customFields.map(f => f.columnToUse));

  const dependencies = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  customFields.forEach(field => {
    dependencies.set(field.columnToUse, new Set());
    inDegree.set(field.columnToUse, 0);
  });

  customFields.forEach(field => {
    if (field.customLogic) {
      const references = FormulaCompiler.extractFieldReferences(
        field.customLogic,
      );
      references.forEach(ref => {
        // Only count references to OTHER custom fields
        if (fieldNames.has(ref) && ref !== field.columnToUse) {
          dependencies.get(ref)?.add(field.columnToUse);
          inDegree.set(
            field.columnToUse,
            (inDegree.get(field.columnToUse) || 0) + 1,
          );
        }
      });
    }
  });

  const queue: string[] = [];
  const result: DatasetField[] = [];

  inDegree.forEach((degree, fieldName) => {
    if (degree === 0) {
      queue.push(fieldName);
    }
  });

  while (queue.length > 0) {
    const current = queue.shift()!;
    const field = customFields.find(f => f.columnToUse === current);
    if (field) {
      result.push(field);
    }

    dependencies.get(current)?.forEach(dependent => {
      const newDegree = (inDegree.get(dependent) || 1) - 1;
      inDegree.set(dependent, newDegree);
      if (newDegree === 0) {
        queue.push(dependent);
      }
    });
  }

  if (result.length !== customFields.length) {
    return customFields;
  }

  return result;
};
