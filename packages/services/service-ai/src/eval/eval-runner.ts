// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type {
  IDataEngine,
  IMetadataService,
  ModelMessage,
  AIToolDefinition,
} from '@objectstack/spec/contracts';
import type { AIService } from '../ai-service.js';
import type { AgentRuntime, AgentChatContext } from '../agent-runtime.js';

const EVAL_CASES_OBJECT = 'ai_eval_cases';
const EVAL_RUNS_OBJECT = 'ai_eval_runs';

/** Row shape (subset) for an ai_eval_cases record. */
interface EvalCaseRow {
  id: string;
  name: string;
  agent_id: string;
  description?: string | null;
  input: string;
  expected_contains?: string | null;
  expected_regex?: string | null;
  judge_instructions?: string | null;
  enabled?: boolean | null;
}

/** Outcome of executing a single case. */
export interface EvalRunResult {
  id: string;
  caseId: string;
  agentId: string;
  model: string;
  status: 'pass' | 'fail' | 'error';
  score: number | null;
  response: string;
  error: string | null;
  judgeModel: string | null;
  judgeReasoning: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  latencyMs: number;
}

/** Options for {@link EvalRunner.run}. */
export interface RunEvalOptions {
  /** ID of an existing ai_eval_cases row. */
  caseId: string;
  /** Override the agent declared on the case (rarely useful). */
  agentId?: string;
  /** Model override — when omitted, the agent's configured model is used. */
  model?: string;
  /**
   * Optional judge model id. When omitted and a judge is required (i.e. no
   * `expected_contains` / `expected_regex` on the case), the runner falls
   * back to the same model used for the candidate response. This avoids
   * an extra config knob at the cost of a weaker baseline judge — set
   * explicitly to a known-strong model for production scoring.
   */
  judgeModel?: string;
  /**
   * Persist the result row. Defaults to `true`. Set to `false` for ad-hoc
   * dry runs from Studio without polluting the run history.
   */
  persist?: boolean;
  /** Optional agent chat context (object/record/view hints). */
  agentContext?: AgentChatContext;
}

const JudgeOutputSchema = z.object({
  score: z.number().min(0).max(100),
  reasoning: z.string().min(1),
});

/**
 * EvalRunner — executes an AI eval case against an agent and grades it.
 *
 * The runner is pure orchestration; the agent runtime, AI service, and
 * data engine are passed in so the same code can be invoked from a CLI,
 * an action handler, or a scheduled job.
 *
 * Scoring rules (first match wins):
 *  1. `expected_regex` → binary pass/fail via `RegExp.test`.
 *  2. `expected_contains` → binary pass/fail via `String.includes`.
 *  3. otherwise → ask `judgeModel` for `{score: 0..100, reasoning}` and
 *     consider score ≥ 70 a pass.
 *
 * On adapter or tool errors the run is recorded with `status: 'error'`
 * so failures are visible in the eval log even when the run blew up.
 */
export class EvalRunner {
  constructor(
    private readonly metadataService: IMetadataService,
    private readonly dataEngine: IDataEngine,
    private readonly aiService: AIService,
    private readonly agentRuntime: AgentRuntime,
  ) {}

  async run(options: RunEvalOptions): Promise<EvalRunResult> {
    const caseRow = await this.loadCase(options.caseId);
    const agentId = options.agentId ?? caseRow.agent_id;
    const agent = await this.agentRuntime.loadAgent(agentId);
    if (!agent) {
      throw new Error(`EvalRunner: agent "${agentId}" not found`);
    }

    const userMessages = this.parseInput(caseRow.input);
    const activeSkills = await this.agentRuntime.resolveActiveSkills(
      agent,
      options.agentContext,
    );
    const systemMessages = this.agentRuntime.buildSystemMessages(
      agent,
      options.agentContext,
      activeSkills,
    );

    const toolDefs: readonly AIToolDefinition[] = this.aiService.toolRegistry.getAll();
    const agentOptions = this.agentRuntime.buildRequestOptions(
      agent,
      toolDefs,
      activeSkills,
    );

    const fullMessages: ModelMessage[] = [...systemMessages, ...userMessages];
    const effectiveModel = options.model ?? agentOptions.model ?? '(adapter default)';

    const startedAt = Date.now();
    let responseText = '';
    let errorMessage: string | null = null;
    let promptTokens: number | null = null;
    let completionTokens: number | null = null;
    let totalTokens: number | null = null;

    try {
      const result = await this.aiService.chatWithTools(fullMessages, {
        ...agentOptions,
        model: options.model ?? agentOptions.model,
        maxIterations: agent.planning?.maxIterations,
      });
      responseText = result.content ?? '';
      const usage = (result as { usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } }).usage;
      if (usage) {
        promptTokens = usage.promptTokens ?? null;
        completionTokens = usage.completionTokens ?? null;
        totalTokens = usage.totalTokens ?? null;
      }
    } catch (err) {
      errorMessage = err instanceof Error ? (err.stack ?? err.message) : String(err);
    }

    const latencyMs = Date.now() - startedAt;

    // ── Scoring ──
    let status: 'pass' | 'fail' | 'error' = 'error';
    let score: number | null = null;
    let judgeModel: string | null = null;
    let judgeReasoning: string | null = null;

    if (errorMessage) {
      status = 'error';
    } else if (caseRow.expected_regex) {
      let regex: RegExp | null = null;
      try {
        regex = new RegExp(caseRow.expected_regex);
      } catch (re) {
        status = 'error';
        errorMessage = `Invalid expected_regex: ${re instanceof Error ? re.message : String(re)}`;
      }
      if (regex) {
        const matched = regex.test(responseText);
        status = matched ? 'pass' : 'fail';
        score = matched ? 100 : 0;
      }
    } else if (caseRow.expected_contains) {
      const matched = responseText.includes(caseRow.expected_contains);
      status = matched ? 'pass' : 'fail';
      score = matched ? 100 : 0;
    } else {
      judgeModel = options.judgeModel ?? options.model ?? agentOptions.model ?? null;
      try {
        const judgement = await this.runJudge({
          model: judgeModel,
          caseRow,
          response: responseText,
        });
        score = judgement.score;
        judgeReasoning = judgement.reasoning;
        status = judgement.score >= 70 ? 'pass' : 'fail';
      } catch (je) {
        status = 'error';
        errorMessage = je instanceof Error ? (je.stack ?? je.message) : String(je);
      }
    }

    const result: EvalRunResult = {
      id: randomUUID(),
      caseId: caseRow.id,
      agentId,
      model: effectiveModel,
      status,
      score,
      response: responseText,
      error: errorMessage,
      judgeModel,
      judgeReasoning,
      promptTokens,
      completionTokens,
      totalTokens,
      latencyMs,
    };

    if (options.persist !== false) {
      await this.persist(result);
    }
    return result;
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private async loadCase(caseId: string): Promise<EvalCaseRow> {
    const row = (await this.dataEngine.findOne(EVAL_CASES_OBJECT, {
      where: { id: caseId },
    })) as EvalCaseRow | null | undefined;
    if (!row) {
      throw new Error(`EvalRunner: case "${caseId}" not found`);
    }
    if (row.enabled === false) {
      throw new Error(`EvalRunner: case "${caseId}" is disabled`);
    }
    return row;
  }

  private parseInput(input: string): ModelMessage[] {
    const trimmed = input.trim();
    if (!trimmed.startsWith('[') && !trimmed.startsWith('{') && !trimmed.startsWith('"')) {
      return [{ role: 'user', content: input }];
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return [{ role: 'user', content: input }];
    }
    if (Array.isArray(parsed)) {
      return parsed as ModelMessage[];
    }
    if (typeof parsed === 'string') {
      return [{ role: 'user', content: parsed }];
    }
    if (parsed && typeof parsed === 'object' && 'role' in (parsed as object)) {
      return [parsed as ModelMessage];
    }
    throw new Error('input must be a string, ModelMessage, or ModelMessage[]');
  }

  private async runJudge(args: {
    model: string | null;
    caseRow: EvalCaseRow;
    response: string;
  }): Promise<{ score: number; reasoning: string }> {
    const rubric = args.caseRow.judge_instructions?.trim()
      || 'Decide whether the assistant response correctly and helpfully answers the user request.';

    const judgeMessages: ModelMessage[] = [
      {
        role: 'system',
        content:
          'You are an impartial grader for an AI evaluation harness. Score the candidate response from 0 to 100 ' +
          'where 100 means it fully and correctly satisfies the rubric and 0 means it does not. ' +
          'Reply with structured JSON only.',
      },
      {
        role: 'user',
        content: [
          `# Rubric\n${rubric}`,
          `# Case name\n${args.caseRow.name}`,
          args.caseRow.description ? `# Case description\n${args.caseRow.description}` : '',
          `# Original user input\n${args.caseRow.input}`,
          `# Candidate response\n${args.response || '(empty)'}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
      },
    ];

    if (typeof this.aiService.generateObject === 'function') {
      const out = await this.aiService.generateObject(judgeMessages, JudgeOutputSchema, {
        model: args.model ?? undefined,
      });
      return JudgeOutputSchema.parse(out.object);
    }

    const judged = await this.aiService.chatWithTools(judgeMessages, {
      model: args.model ?? undefined,
    });
    const text = judged.content ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error(`Judge response did not contain JSON: ${text.slice(0, 200)}`);
    }
    return JudgeOutputSchema.parse(JSON.parse(match[0]));
  }

  private async persist(run: EvalRunResult): Promise<void> {
    await this.dataEngine.insert(EVAL_RUNS_OBJECT, {
      id: run.id,
      case_id: run.caseId,
      agent_id: run.agentId,
      model: run.model,
      status: run.status,
      score: run.score,
      response: run.response,
      error: run.error,
      judge_model: run.judgeModel,
      judge_reasoning: run.judgeReasoning,
      prompt_tokens: run.promptTokens,
      completion_tokens: run.completionTokens,
      total_tokens: run.totalTokens,
      latency_ms: run.latencyMs,
      run_at: new Date().toISOString(),
    });
  }
}
