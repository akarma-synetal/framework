/**
 * Form layout for the Report metadata editor.
 *
 * Bound to {@link ReportSchema} via `data.provider = 'schema'`. The
 * `@object-ui/plugin-form` renderer resolves field metadata from the
 * Zod-derived JSON Schema served by `/api/v1/meta` and applies the
 * widget/visibility hints declared here.
 */

import { defineForm } from './view.zod';

export const reportForm = defineForm({
  schemaId: 'report',
  type: 'tabbed',
  sections: [
    {
      label: 'Basics',
      columns: 2,
      fields: [
        { field: 'name', type: 'text', colSpan: 1, required: true, helpText: 'snake_case unique identifier' },
        { field: 'label', type: 'text', colSpan: 1, required: true },
        { field: 'description', type: 'textarea', colSpan: 2 },
        { field: 'objectName', widget: 'ref:object', colSpan: 1, helpText: 'Data source object' },
        { field: 'type', colSpan: 1, helpText: 'Report type: tabular/summary/matrix/joined' },
      ],
    },
    {
      label: 'Columns',
      fields: [
        { field: 'columns', widget: 'master-detail', helpText: 'Columns to display in the report' },
      ],
    },
    {
      label: 'Groupings',
      fields: [
        { field: 'groupingsDown', widget: 'master-detail', helpText: 'Row grouping levels' },
        // CEL visibility — only Matrix reports use column groupings.
        { field: 'groupingsAcross', widget: 'master-detail', visibleOn: "data.type == 'matrix'", helpText: 'Column grouping levels (matrix only)' },
      ],
    },
    {
      label: 'Joined blocks',
      // Show only when this is a joined report. Section-level visibility is
      // not yet first-class so we mirror it on every field for now.
      fields: [
        { field: 'blocks', widget: 'master-detail', visibleOn: "data.type == 'joined'", helpText: 'Join multiple objects (joined report only)' },
      ],
    },
    {
      label: 'Filter & chart',
      collapsible: true,
      collapsed: true,
      fields: [
        { field: 'filter', widget: 'master-detail', helpText: 'Report-level filters' },
        { field: 'chart', widget: 'json', helpText: 'Chart config (type, legend, colors)' },
      ],
    },
    {
      label: 'Advanced',
      collapsible: true,
      collapsed: true,
      fields: [
        { field: 'aria', widget: 'json', helpText: 'Accessibility labels' },
        { field: 'performance', widget: 'json', helpText: 'Caching and optimization' },
      ],
    },
  ],
});
