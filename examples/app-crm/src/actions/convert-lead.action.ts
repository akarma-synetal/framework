// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { UI } from '@objectstack/spec';

/**
 * Example global action — runs an existing flow to convert a lead-style
 * contact into a fully-fledged opportunity record.
 */
export const ConvertLeadAction: UI.Action = {
  name: 'crm_convert_lead',
  label: 'Convert Lead',
  description: 'Convert a contact into an opportunity using a flow.',
  objectName: 'crm_contact',
  type: 'flow',
  target: 'opportunity_won_notification',
};
