// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import type {
  ModelMessage,
  AIRequestOptions,
  AIResult,
  AIObjectResult,
  GenerateObjectOptions,
  TextStreamPart,
  ToolSet,
} from '@objectstack/spec/contracts';
import type { LLMAdapter } from '@objectstack/spec/contracts';

/**
 * MemoryLLMAdapter — deterministic in-memory adapter for testing & development.
 *
 * Always echoes back the last user message prefixed with "[memory] ".
 * Useful for unit tests, CI pipelines, and local dev without an LLM key.
 */
export class MemoryLLMAdapter implements LLMAdapter {
  readonly name = 'memory';

  async chat(messages: ModelMessage[], options?: AIRequestOptions): Promise<AIResult> {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    const userContent = lastUserMessage?.content;
    const userText = typeof userContent === 'string' ? userContent : '(complex content)';

    // ── Heuristic tool-calling support ──────────────────────────────────────
    // When `chatWithTools` injects available tools and the conversation has
    // not yet executed `query_data`, request a single call to it with the
    // user's natural-language request. Once a `role: 'tool'` message comes
    // back, summarise its records and stop. This lets demos/tests drive the
    // agent end-to-end without a real LLM provider.
    const tools = options?.tools as Array<{ name: string }> | undefined;
    const hasQueryDataTool = Array.isArray(tools) && tools.some(t => t?.name === 'query_data');
    const alreadyCalledQueryData = messages.some(
      m =>
        m.role === 'tool' &&
        Array.isArray(m.content) &&
        (m.content as Array<{ toolName?: string }>).some(c => c?.toolName === 'query_data'),
    );

    if (hasQueryDataTool && !alreadyCalledQueryData && lastUserMessage) {
      const toolCallId = `memory_tc_${Date.now().toString(36)}`;
      return {
        content: '',
        model: options?.model ?? 'memory',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        toolCalls: [
          {
            type: 'tool-call',
            toolCallId,
            toolName: 'query_data',
            input: { request: userText },
          } as unknown as NonNullable<AIResult['toolCalls']>[number],
        ],
      };
    }

    // If a query_data result is already in the conversation, summarise it.
    if (alreadyCalledQueryData) {
      const lastTool = [...messages].reverse().find(m => m.role === 'tool');
      const part = Array.isArray(lastTool?.content)
        ? (lastTool!.content as Array<{
            toolName?: string;
            output?: { type?: string; value?: unknown };
            result?: unknown;
          }>).find(c => c?.toolName === 'query_data')
        : undefined;
      let payload: { records?: unknown[]; count?: number; error?: string } = {};
      const raw =
        part?.output && typeof part.output === 'object' && 'value' in part.output
          ? part.output.value
          : part?.result;
      if (typeof raw === 'string') {
        try {
          payload = JSON.parse(raw);
        } catch {
          payload = {};
        }
      } else if (raw && typeof raw === 'object') {
        payload = raw as typeof payload;
      }
      if (payload.error) {
        return {
          content: `[memory] query_data failed: ${payload.error}`,
          model: options?.model ?? 'memory',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        };
      }
      const records = payload.records ?? [];
      const count = payload.count ?? records.length;
      return {
        content: `[memory] Found ${count} record${count === 1 ? '' : 's'} for "${userText}".`,
        model: options?.model ?? 'memory',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    }

    const content = lastUserMessage
      ? `[memory] ${userText}`
      : '[memory] (no user message)';

    return {
      content,
      model: options?.model ?? 'memory',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }

  async complete(prompt: string, options?: AIRequestOptions): Promise<AIResult> {
    return {
      content: `[memory] ${prompt}`,
      model: options?.model ?? 'memory',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }

  async *streamChat(
    messages: ModelMessage[],
    _options?: AIRequestOptions,
  ): AsyncIterable<TextStreamPart<ToolSet>> {
    const result = await this.chat(messages);
    // Emit word-by-word deltas for realistic streaming simulation
    const words = result.content.split(' ');
    for (let i = 0; i < words.length; i++) {
      const wordText = i === 0 ? words[i] : ` ${words[i]}`;
      yield { type: 'text-delta', id: `delta_${i}`, text: wordText } as TextStreamPart<ToolSet>;
    }
    yield {
      type: 'finish',
      finishReason: 'stop' as const,
      totalUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      rawFinishReason: 'stop',
    } as unknown as TextStreamPart<ToolSet>;
  }

  async embed(input: string | string[]): Promise<number[][]> {
    const texts = Array.isArray(input) ? input : [input];
    // Return deterministic zero vectors of dimension 3
    return texts.map(() => [0, 0, 0]);
  }

  async listModels(): Promise<string[]> {
    return ['memory'];
  }

  /**
   * Heuristic structured-output for testing & demos — NOT a real LLM.
   *
   * Strategy:
   * 1. Extract candidate object names from the system messages by matching
   *    schema-context headers (`### name — Label`) emitted by
   *    {@link SchemaRetriever.renderSnippet}.
   * 2. Pick the candidate whose tokens overlap most with the last user
   *    message (falls back to the first candidate).
   * 3. Try `schema.safeParse({ objectName, limit: 20 })` — this satisfies the
   *    `QueryPlanSchema` used by the built-in `query_data` tool.
   * 4. If that fails, fall back to `schema.safeParse({})` for schemas that
   *    accept defaults.
   * 5. Otherwise throw with a clear message — the demo needs a real provider.
   */
  async generateObject<T = unknown>(
    messages: ModelMessage[],
    schema: z.ZodType<T>,
    options?: GenerateObjectOptions,
  ): Promise<AIObjectResult<T>> {
    const sys = messages
      .filter(m => m.role === 'system')
      .map(m => (typeof m.content === 'string' ? m.content : ''))
      .join('\n');

    // Parse headers of the form `### machine_name — Label (Plural)` emitted
    // by SchemaRetriever.renderSnippet. Capture every alias so we can match
    // against natural-language user queries like "show me my tasks".
    const headerRe = /^###\s+([a-z0-9_]+)(?:\s+—\s+([^\n]+))?/gim;
    type Candidate = { name: string; aliasTokens: Set<string> };
    const candidates: Candidate[] = [];
    for (const match of sys.matchAll(headerRe)) {
      const machineName = match[1];
      if (!machineName) continue;
      const aliasText = match[2] ?? '';
      const aliasTokens = new Set<string>();
      // Tokens from the snake_case machine name
      for (const t of machineName.split(/[^a-z0-9]+/)) {
        if (t) aliasTokens.add(t);
      }
      // Tokens from the label / plural label (everything after the em dash)
      for (const t of aliasText.toLowerCase().split(/[^a-z0-9]+/)) {
        if (t) aliasTokens.add(t);
      }
      // Naive stem: include singular form of plural tokens ending in "s"
      for (const t of [...aliasTokens]) {
        if (t.length > 3 && t.endsWith('s')) aliasTokens.add(t.slice(0, -1));
      }
      candidates.push({ name: machineName, aliasTokens });
    }

    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    const userText = typeof lastUser?.content === 'string'
      ? lastUser.content.toLowerCase()
      : '';
    const userTokens = new Set(
      userText.split(/[^a-z0-9_]+/).filter(t => t.length > 1),
    );
    // Apply the same naive plural→singular stem to user tokens so "tasks"
    // also looks up as "task".
    for (const t of [...userTokens]) {
      if (t.length > 3 && t.endsWith('s')) userTokens.add(t.slice(0, -1));
    }

    let chosen = candidates[0]?.name;
    let bestScore = -1;
    for (const cand of candidates) {
      let score = 0;
      for (const tok of cand.aliasTokens) {
        if (userTokens.has(tok)) score += 1;
      }
      if (score > bestScore) {
        bestScore = score;
        chosen = cand.name;
      }
    }

    const attempts: Array<Record<string, unknown>> = [];
    if (chosen) attempts.push({ objectName: chosen, limit: 20 });
    attempts.push({});

    for (const attempt of attempts) {
      const result = schema.safeParse(attempt);
      if (result.success) {
        return {
          object: result.data,
          model: options?.model ?? 'memory',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        };
      }
    }

    throw new Error(
      'MemoryLLMAdapter.generateObject: unable to synthesise a value for the ' +
      'requested schema. The memory adapter only handles QueryPlan-shaped ' +
      'schemas — wire a real LLM adapter (OpenAI / Anthropic / Google) for ' +
      'arbitrary structured output.',
    );
  }
}
