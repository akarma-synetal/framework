// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineAgent, defineTool, defineSkill } from '@objectstack/spec';

/**
 * Tool — looks up a contact by email. Tiny example exercising the
 * AI tool form (parameters schema, requiresConfirmation, builtIn).
 */
export const LookupContactTool = defineTool({
  name: 'lookup_contact',
  label: 'Lookup Contact',
  description: 'Find a CRM contact by email address.',
  parameters: {
    type: 'object',
    properties: {
      email: { type: 'string', description: 'Email to search for' },
    },
    required: ['email'],
  },
  requiresConfirmation: false,
  active: true,
  builtIn: false,
});

/**
 * Skill — bundles deal-management tools together.
 */
export const DealManagementSkill = defineSkill({
  name: 'deal_management',
  label: 'Deal Management',
  description: 'Skills for managing opportunities and pipelines.',
  tools: ['lookup_contact'],
  active: true,
});

/**
 * Agent — Sales Assistant copilot. Demonstrates the full Agent form
 * (role, instructions, model config, knowledge, guardrails).
 */
export const SalesAssistantAgent = defineAgent({
  name: 'sales_assistant',
  label: 'Sales Assistant',
  description: 'AI assistant for the CRM sales team.',
  role: 'A friendly sales co-pilot for CRM users.',
  instructions:
    'You help sales reps manage opportunities, look up contacts, and answer questions about deals. Be concise and proactive.',
  active: true,
  visibility: 'public',
  skills: ['deal_management'],
});
