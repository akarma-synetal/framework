// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Logger } from '@objectstack/spec/contracts';
import type { EvalRunner } from '../eval/index.js';
import type { RouteDefinition } from './ai-routes.js';

/**
 * Build AI evaluation REST routes.
 *
 * | Method | Path                                | Description |
 * |:---|:---|:---|
 * | POST   | /api/v1/ai/evals/runs               | Execute one eval case and persist the result |
 *
 * Listing/inspecting historical runs and case definitions is handled by
 * the standard auto-generated CRUD endpoints for `ai_eval_runs` and
 * `ai_eval_cases` — no bespoke route is needed there.
 *
 * Auth: requires `ai:admin` permission since running an eval may make
 * paid LLM calls.
 */
export function buildEvalRoutes(
  evalRunner: EvalRunner,
  logger: Logger,
): RouteDefinition[] {
  return [
    {
      method: 'POST',
      path: '/api/v1/ai/evals/runs',
      description: 'Execute an AI eval case and persist the run record',
      auth: true,
      permissions: ['ai:admin'],
      handler: async (req) => {
        const body = (req.body ?? {}) as {
          caseId?: string;
          agentId?: string;
          model?: string;
          judgeModel?: string;
          persist?: boolean;
        };
        if (!body.caseId || typeof body.caseId !== 'string') {
          return { status: 400, body: { error: 'caseId is required' } };
        }
        try {
          const result = await evalRunner.run({
            caseId: body.caseId,
            agentId: body.agentId,
            model: body.model,
            judgeModel: body.judgeModel,
            persist: body.persist,
          });
          return { status: 200, body: result };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error('[AI Route] /ai/evals/runs error', err instanceof Error ? err : undefined);
          return { status: 500, body: { error: message } };
        }
      },
    },
  ];
}
