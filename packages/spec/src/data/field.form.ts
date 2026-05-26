// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { FormLayout } from '../ui/view.zod';

/**
 * Form Layout for Field Metadata Type
 * 
 * Defines the structured form for creating/editing field definitions.
 * Aligns with Salesforce Custom Field setup UI.
 */
export const FieldFormLayout: FormLayout = {
  tabs: [
    {
      label: 'Basics',
      description: 'Identity, type, and display settings.',
      sections: [
        {
          label: 'Identity',
          fields: [
            { field: 'name', required: true, helpText: 'snake_case unique identifier' },
            { field: 'label', required: true, helpText: 'Human-readable label' },
            { field: 'type', required: true, widget: 'combobox', helpText: 'Field data type' },
          ],
        },
        {
          label: 'Description',
          fields: [
            { field: 'description', widget: 'textarea', helpText: 'Help text for users' },
            { field: 'helpText', widget: 'textarea', helpText: 'Tooltip or inline guidance' },
          ],
        },
      ],
    },
    {
      label: 'Type Settings',
      description: 'Type-specific configuration.',
      sections: [
        {
          label: 'Text Settings',
          visibleOn: "data.type == 'text' || data.type == 'textarea' || data.type == 'email' || data.type == 'url'",
          fields: [
            { field: 'minLength', type: 'number', helpText: 'Minimum character length' },
            { field: 'maxLength', type: 'number', helpText: 'Maximum character length' },
            { field: 'pattern', helpText: 'Regex validation pattern' },
          ],
        },
        {
          label: 'Number Settings',
          visibleOn: "data.type == 'number' || data.type == 'currency' || data.type == 'percent'",
          fields: [
            { field: 'min', type: 'number', helpText: 'Minimum value' },
            { field: 'max', type: 'number', helpText: 'Maximum value' },
            { field: 'precision', type: 'number', helpText: 'Decimal places' },
          ],
        },
        {
          label: 'Select/Lookup Settings',
          visibleOn: "data.type == 'select' || data.type == 'lookup' || data.type == 'reference'",
          fields: [
            { field: 'options', widget: 'master-detail', helpText: 'Select options (label/value pairs)' },
            { field: 'reference', helpText: 'Referenced object name for lookups' },
            { field: 'referenceFilters', widget: 'master-detail', helpText: 'Filter criteria for lookup records' },
          ],
        },
        {
          label: 'File Upload Settings',
          visibleOn: "data.type == 'file' || data.type == 'image'",
          fields: [
            { field: 'fileUploadOptions', widget: 'object-fields', helpText: 'File type, size limits, storage config' },
          ],
        },
      ],
    },
    {
      label: 'Validation',
      description: 'Required, unique, and custom rules.',
      sections: [
        {
          label: 'Basic Validation',
          fields: [
            { field: 'required', helpText: 'Field is required for create/update' },
            { field: 'unique', helpText: 'Enforce unique values' },
            { field: 'indexed', helpText: 'Create database index for performance' },
          ],
        },
        {
          label: 'Advanced Validation',
          collapsible: true,
          collapsed: true,
          fields: [
            { field: 'formula', helpText: 'CEL expression for computed values' },
            { field: 'defaultValue', helpText: 'Default value for new records' },
            { field: 'dataQualityRules', widget: 'object-fields', helpText: 'Completeness, uniqueness, accuracy rules' },
          ],
        },
      ],
    },
    {
      label: 'Behavior',
      description: 'Visibility, read-only, and lifecycle.',
      sections: [
        {
          label: 'Visibility',
          fields: [
            { field: 'visibleOn', helpText: 'CEL expression for conditional visibility' },
            { field: 'readOnly', helpText: 'Field is read-only' },
            { field: 'hidden', helpText: 'Hide field from UI' },
          ],
        },
        {
          label: 'Lifecycle',
          collapsible: true,
          collapsed: true,
          fields: [
            { field: 'deprecated', helpText: 'Field is deprecated (show warning)' },
            { field: 'immutable', helpText: 'Cannot be modified after creation' },
          ],
        },
      ],
    },
    {
      label: 'Display',
      description: 'UI presentation hints.',
      sections: [
        {
          label: 'Presentation',
          fields: [
            { field: 'group', helpText: 'Field group key for form sections' },
            { field: 'placeholder', helpText: 'Input placeholder text' },
            { field: 'prefix', helpText: 'Input prefix (e.g. "$" for currency)' },
            { field: 'suffix', helpText: 'Input suffix (e.g. "%" for percent)' },
          ],
        },
      ],
    },
    {
      label: 'Advanced',
      description: 'Encryption, caching, and metadata.',
      sections: [
        {
          label: 'Security',
          collapsible: true,
          collapsed: true,
          fields: [
            { field: 'encrypted', helpText: 'Encrypt field at rest' },
            { field: 'masked', helpText: 'Mask sensitive values in UI' },
            { field: 'pii', helpText: 'Mark as personally identifiable information' },
          ],
        },
        {
          label: 'Performance',
          collapsible: true,
          collapsed: true,
          fields: [
            { field: 'computedFieldCache', widget: 'object-fields', helpText: 'Cache config for formula fields' },
          ],
        },
        {
          label: 'Metadata',
          collapsible: true,
          collapsed: true,
          fields: [
            { field: 'tags', widget: 'string-tags', helpText: 'Categorization tags' },
            { field: 'system', helpText: 'System field (protected)' },
          ],
        },
      ],
    },
  ],
};
