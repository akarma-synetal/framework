// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { FieldPermission } from '@objectstack/spec/security';

/**
 * FieldMasker
 * 
 * Applies field-level security by stripping restricted fields from query results.
 */
export class FieldMasker {
  /**
   * Mask fields in query results based on field permissions.
   * Removes fields that the user does not have read access to.
   */
  maskResults(
    results: any | any[],
    fieldPermissions: Record<string, FieldPermission>,
    _objectName: string
  ): any | any[] {
    // If no field permissions defined, return results as-is
    if (Object.keys(fieldPermissions).length === 0) return results;

    // Get list of non-readable fields
    const hiddenFields = Object.entries(fieldPermissions)
      .filter(([, perm]) => !perm.readable)
      .map(([field]) => field);

    if (hiddenFields.length === 0) return results;

    if (Array.isArray(results)) {
      return results.map(record => this.maskRecord(record, hiddenFields));
    }

    return this.maskRecord(results, hiddenFields);
  }

  /**
   * Get non-editable fields for use in write operations.
   * Returns a list of field names that should be stripped from incoming data.
   */
  getNonEditableFields(
    fieldPermissions: Record<string, FieldPermission>
  ): string[] {
    return Object.entries(fieldPermissions)
      .filter(([, perm]) => !perm.editable)
      .map(([field]) => field);
  }

  /**
   * Strip non-editable fields from write data.
   */
  stripNonEditableFields(
    data: Record<string, any>,
    fieldPermissions: Record<string, FieldPermission>
  ): Record<string, any> {
    const nonEditable = this.getNonEditableFields(fieldPermissions);
    if (nonEditable.length === 0) return data;

    const result = { ...data };
    for (const field of nonEditable) {
      delete result[field];
    }
    return result;
  }

  /**
   * Detect which fields in the caller's write payload would touch a
   * field they are not allowed to edit. Returns the set of offending
   * field names (no duplicates, sorted for stable error messages).
   *
   * Used by the security middleware on insert/update to fail-closed
   * with an explicit 403 rather than silently dropping fields — a
   * silent drop hides the security boundary from honest clients
   * (their update partially "doesn't save") and gives an attacker no
   * negative signal that the field exists. Throwing makes the
   * boundary observable in both directions.
   *
   * `data` may be a single record or an array of records (bulk insert);
   * either way the returned list is the union across all rows.
   *
   * Fields without a permission entry pass through — permission sets
   * are an allow-list at the field level only for fields they
   * explicitly enumerate. Most objects do not declare per-field rules
   * and remain fully editable.
   */
  detectForbiddenWrites(
    data: Record<string, any> | Record<string, any>[],
    fieldPermissions: Record<string, FieldPermission>
  ): string[] {
    if (Object.keys(fieldPermissions).length === 0) return [];
    const nonEditable = new Set(this.getNonEditableFields(fieldPermissions));
    if (nonEditable.size === 0) return [];

    const offenders = new Set<string>();
    const rows = Array.isArray(data) ? data : [data];
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      for (const field of Object.keys(row)) {
        if (nonEditable.has(field)) offenders.add(field);
      }
    }
    return Array.from(offenders).sort();
  }

  private maskRecord(record: any, hiddenFields: string[]): any {
    if (!record || typeof record !== 'object') return record;

    const result = { ...record };
    for (const field of hiddenFields) {
      delete result[field];
    }
    return result;
  }
}
