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
        { field: 'name', colSpan: 1 },
        { field: 'label', colSpan: 1 },
        { field: 'description', colSpan: 2 },
        { field: 'objectName', widget: 'ref:object', colSpan: 1 },
        { field: 'type', colSpan: 1 },
      ],
    },
    {
      label: 'Columns',
      fields: [
        { field: 'columns', widget: 'master-detail' },
      ],
    },
    {
      label: 'Groupings',
      fields: [
        { field: 'groupingsDown', widget: 'master-detail' },
        // CEL visibility — only Matrix reports use column groupings.
        { field: 'groupingsAcross', widget: 'master-detail', visibleOn: "data.type == 'matrix'" },
      ],
    },
    {
      label: 'Joined blocks',
      // Show only when this is a joined report. Section-level visibility is
      // not yet first-class so we mirror it on every field for now.
      fields: [
        { field: 'blocks', widget: 'master-detail', visibleOn: "data.type == 'joined'" },
      ],
    },
    {
      label: 'Filter & chart',
      collapsible: true,
      collapsed: true,
      fields: [
        { field: 'filter', widget: 'master-detail' },
        { field: 'chart', widget: 'object-fields' },
      ],
    },
    {
      label: 'Advanced',
      collapsible: true,
      collapsed: true,
      fields: [
        { field: 'aria', widget: 'object-fields' },
        { field: 'performance', widget: 'object-fields' },
      ],
    },
  ],
});
