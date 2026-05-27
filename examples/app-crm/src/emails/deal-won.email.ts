// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Example email template — sent when a deal is marked Closed Won.
 *
 * Email templates are not yet a top-level defineStack key; this is
 * re-exported via the `referenceMetadata` object in objectstack.config.ts
 * so the Studio metadata-admin UI can use it as a sample.
 */
export const DealWonEmail = {
  id: 'crm_deal_won',
  subject: 'Congratulations — {{opportunity.name}} closed!',
  bodyType: 'html' as const,
  body: `
    <h1>Great news!</h1>
    <p>Hi {{user.name}},</p>
    <p>
      The opportunity <strong>{{opportunity.name}}</strong>
      for {{account.name}} just closed at
      <strong>\${{opportunity.amount}}</strong>.
    </p>
    <p>Nice work!</p>
  `,
  variables: [
    { name: 'user.name', type: 'string' as const },
    { name: 'opportunity.name', type: 'string' as const },
    { name: 'opportunity.amount', type: 'number' as const },
    { name: 'account.name', type: 'string' as const },
  ],
};
