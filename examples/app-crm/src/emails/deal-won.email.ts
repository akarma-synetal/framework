// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { EmailTemplateDefinition } from '@objectstack/spec/system';

/**
 * Email template — celebration email sent when a deal is closed-won.
 * Exercises the Email Template form (Monaco HTML body, subject, variables).
 */
export const DealWonEmail: EmailTemplateDefinition = {
  id: 'opportunity_won_email',
  name: 'opportunity_won_email',
  category: 'transactional',
  subject: '🎉 Opportunity Won: {{record.name}}',
  bodyType: 'html',
  body: `<!doctype html>
<html>
  <body style="font-family: system-ui, sans-serif;">
    <h1>Congratulations, {{record.owner.name}}!</h1>
    <p>You just closed <strong>{{record.name}}</strong> for
       \${{record.amount}}.</p>
    <p>Stage: <em>{{record.stage}}</em></p>
    <p style="color:#888">Sent automatically by the CRM win workflow.</p>
  </body>
</html>`,
  variables: [
    { name: 'record.name', label: 'Opportunity Name', type: 'string' },
    { name: 'record.amount', label: 'Amount', type: 'number' },
    { name: 'record.owner.name', label: 'Owner Name', type: 'string' },
    { name: 'record.stage', label: 'Stage', type: 'string' },
  ],
};
