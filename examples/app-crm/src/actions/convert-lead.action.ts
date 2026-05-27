// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Action } from '@objectstack/spec/ui';

/**
 * Action — "Convert to Opportunity" object action on Contact. Exercises
 * the Action form (type, target, parameters, button placement).
 */
export const ConvertLeadAction: Action = {
  name: 'convert_to_opportunity',
  label: 'Convert to Opportunity',
  description: 'Promote a contact to a tracked opportunity.',
  type: 'flow',
  object: 'crm_contact',
  target: 'opportunity_won_notification',
  icon: 'arrow-right-circle',
};
