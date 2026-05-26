// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { FormLayout } from '../ui/view.zod';

/**
 * Form Layout for Approval Metadata Type
 */
export const ApprovalFormLayout: FormLayout = {
  tabs: [
    {
      label: 'Basics',
      sections: [
        {
          label: 'Identity',
          fields: [
            { field: 'name', required: true, helpText: 'snake_case unique identifier' },
            { field: 'label', required: true, helpText: 'Approval process display name' },
            { field: 'description', widget: 'textarea', helpText: 'Process description' },
          ],
        },
      ],
    },
    {
      label: 'Steps',
      sections: [
        {
          label: 'Approval Steps',
          fields: [
            { field: 'steps', widget: 'master-detail', required: true, helpText: 'Sequential or parallel approval steps' },
          ],
        },
      ],
    },
    {
      label: 'Actions',
      sections: [
        {
          label: 'On Approve/Reject',
          fields: [
            { field: 'onApprove', widget: 'master-detail', helpText: 'Actions to execute on approval' },
            { field: 'onReject', widget: 'master-detail', helpText: 'Actions to execute on rejection' },
          ],
        },
      ],
    },
  ],
};
