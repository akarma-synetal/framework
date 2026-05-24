// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Flow } from '@objectstack/spec/automation';

/**
 * Auto-launched flow that fires when an opportunity transitions to
 * Closed Won. Demonstrates a record-triggered flow shape.
 */
export const OpportunityWonFlow: Flow = {
  name: 'opportunity_won_notification',
  label: 'Notify on Opportunity Won',
  description: 'Sends a celebration email when an opportunity is closed-won.',
  type: 'autolaunched',

  nodes: [
    {
      id: 'start',
      type: 'start',
      label: 'On Opportunity Update',
      config: {
        objectName: 'crm_opportunity',
        triggerType: 'record-after-update',
        condition: 'stage == "closed_won" && previous.stage != "closed_won"',
      },
    },
    {
      id: 'send_email',
      type: 'script',
      label: 'Send Win Notification',
      config: {
        actionType: 'email',
        inputs: {
          to: '{record.owner.email}',
          subject: '🎉 Opportunity Won: {record.name}',
          template: 'opportunity_won_email',
        },
      },
    },
    { id: 'end', type: 'end', label: 'End' },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'send_email' },
    { id: 'e2', source: 'send_email', target: 'end' },
  ],
};
