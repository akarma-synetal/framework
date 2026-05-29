// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

/**
 * ai_eval_runs — Result of executing one AI eval case against one model
 *
 * Each row records:
 *  - which case was executed and against which model
 *  - the full assistant response
 *  - pass/fail status + numeric score (0–100)
 *  - cost and latency observability (mirrors ai_messages columns)
 *  - judge model reasoning when a judge was used
 *
 * Querying this table gives you A/B comparisons across models, regression
 * detection over time, and a leaderboard per agent.
 *
 * @namespace ai
 */
export const AiEvalRunObject = ObjectSchema.create({
  name: 'ai_eval_runs',
  label: 'AI Eval Run',
  pluralLabel: 'AI Eval Runs',
  icon: 'gauge',
  isSystem: true,
  description: 'One execution of an eval case (used for regression tracking and model A/B comparisons)',

  fields: {
    id: Field.text({
      label: 'Run ID',
      required: true,
      readonly: true,
    }),

    case_id: Field.lookup('ai_eval_cases', {
      label: 'Case',
      required: true,
    }),

    agent_id: Field.text({
      label: 'Agent ID',
      required: true,
      maxLength: 255,
      description: 'Agent that was invoked (denormalized for fast filtering)',
    }),

    model: Field.text({
      label: 'Model',
      required: true,
      maxLength: 128,
      description: 'Model id used for the eval (denormalized for A/B comparison)',
    }),

    status: Field.select({
      label: 'Status',
      required: true,
      options: [
        { label: 'Pass', value: 'pass' },
        { label: 'Fail', value: 'fail' },
        { label: 'Error', value: 'error' },
      ],
    }),

    score: Field.number({
      label: 'Score (0–100)',
      required: false,
      description: '100 for pass, 0 for fail when using substring/regex check; judge score otherwise',
    }),

    response: Field.textarea({
      label: 'Response',
      required: false,
      description: 'The assistant response that was scored',
    }),

    error: Field.textarea({
      label: 'Error',
      required: false,
      description: 'Adapter error stack when status=error',
    }),

    judge_model: Field.text({
      label: 'Judge Model',
      required: false,
      maxLength: 128,
      description: 'Model id of the judge (null if check was rule-based)',
    }),

    judge_reasoning: Field.textarea({
      label: 'Judge Reasoning',
      required: false,
      description: 'Free-form explanation from the judge model',
    }),

    prompt_tokens: Field.number({
      label: 'Prompt Tokens',
      required: false,
    }),

    completion_tokens: Field.number({
      label: 'Completion Tokens',
      required: false,
    }),

    total_tokens: Field.number({
      label: 'Total Tokens',
      required: false,
    }),

    latency_ms: Field.number({
      label: 'Latency (ms)',
      required: false,
    }),

    run_at: Field.datetime({
      label: 'Run At',
      required: true,
      defaultValue: 'NOW()',
      readonly: true,
    }),
  },

  indexes: [
    { fields: ['case_id'] },
    { fields: ['model'] },
    { fields: ['status'] },
    { fields: ['case_id', 'run_at'] },
    { fields: ['agent_id', 'model'] },
  ],

  enable: {
    trackHistory: false,
    searchable: false,
    apiEnabled: true,
    trash: false,
    mru: false,
  },
});
