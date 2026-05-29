// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * ai_eval_cases — Golden test cases for AI agent quality evaluation
 *
 * A case captures a single repeatable scenario: which agent to invoke,
 * what to send it, and how to decide whether the response is correct.
 * Cases are persisted so they can be re-run after prompt edits, model
 * upgrades, or skill changes — turning AI regression-checking into a
 * first-class operational workflow.
 *
 * Scoring strategy is implicit:
 *  - If `expected_regex` is set, the runner uses a regex match (binary).
 *  - Else if `expected_contains` is set, simple substring match (binary).
 *  - Else, a judge model is asked to score 0–100 with reasoning.
 *
 * @namespace ai
 */
export const AiEvalCaseObject = ObjectSchema.create({
  name: 'ai_eval_cases',
  label: 'AI Eval Case',
  pluralLabel: 'AI Eval Cases',
  icon: 'flask-conical',
  isSystem: true,
  description: 'Golden test cases that pin down expected AI behavior',

  fields: {
    id: Field.text({
      label: 'Case ID',
      required: true,
      readonly: true,
    }),

    name: Field.text({
      label: 'Name',
      required: true,
      maxLength: 255,
      description: 'Human-readable case name',
    }),

    agent_id: Field.text({
      label: 'Agent ID',
      required: true,
      maxLength: 255,
      description: 'Target agent to invoke (resolved via ai_agents)',
    }),

    description: Field.textarea({
      label: 'Description',
      required: false,
      description: 'What this case validates and why it matters',
    }),

    input: Field.textarea({
      label: 'Input Messages',
      required: true,
      description: 'JSON-serialized ModelMessage[] (the user prompt(s) to feed the agent)',
    }),

    expected_contains: Field.text({
      label: 'Expected Substring',
      required: false,
      maxLength: 1024,
      description: 'If set, response must contain this substring (case-sensitive). Skipped when expected_regex is set.',
    }),

    expected_regex: Field.text({
      label: 'Expected Regex',
      required: false,
      maxLength: 1024,
      description: 'If set, response must match this JavaScript regex. Takes precedence over expected_contains.',
    }),

    judge_instructions: Field.textarea({
      label: 'Judge Instructions',
      required: false,
      description: 'Extra rubric passed to the judge model when no expected_* is set',
    }),

    enabled: Field.boolean({
      label: 'Enabled',
      required: false,
      defaultValue: true,
      description: 'Disabled cases are skipped by batch runs',
    }),

    created_at: Field.datetime({
      label: 'Created At',
      required: true,
      defaultValue: 'NOW()',
      readonly: true,
    }),

    updated_at: Field.datetime({
      label: 'Updated At',
      required: false,
    }),
  },

  indexes: [
    { fields: ['agent_id'] },
    { fields: ['enabled'] },
  ],

  enable: {
    trackHistory: true,
    searchable: true,
    apiEnabled: true,
    trash: true,
    mru: true,
  },
});
