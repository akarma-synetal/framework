// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type {
  ModelMessage,
  AIRequestOptions,
  AIResult,
  TextStreamPart,
  ToolSet,
  AIObjectResult,
  GenerateObjectOptions,
} from '@objectstack/spec/contracts';
import type { LLMAdapter } from '@objectstack/spec/contracts';
import type { AIToolDefinition } from '@objectstack/spec/contracts';
import type { LanguageModelV2 } from '@ai-sdk/provider';
import type { z } from 'zod';
import { generateText, streamText, generateObject, tool as vercelTool, jsonSchema } from 'ai';

/**
 * Convert ObjectStack `AIRequestOptions` into the subset of Vercel AI SDK
 * options supported by `generateText` / `streamText`.
 *
 * Forwards: temperature, maxTokens, stop (→ stopSequences), tools, toolChoice.
 *
 * `modelId` lets the adapter strip sampling parameters that the model
 * doesn't support — OpenAI's reasoning models (gpt-5*, o1*, o3*, o4-mini)
 * reject any non-default `temperature` or `top_p`. Without this guard the
 * agent would crash with a 400 on every call (`Unsupported value:
 * 'temperature' does not support 0.3 with this model.`).
 */
function buildVercelOptions(
  options?: AIRequestOptions,
  modelId?: string,
): Record<string, unknown> {
  if (!options) return {};

  const opts: Record<string, unknown> = {};
  const reasoning = isReasoningModel(modelId);

  if (options.temperature != null && !reasoning) opts.temperature = options.temperature;
  if (options.maxTokens != null) opts.maxTokens = options.maxTokens;
  if (options.stop?.length) opts.stopSequences = options.stop;

  if (options.tools?.length) {
    const tools: Record<string, unknown> = {};
    for (const t of options.tools as AIToolDefinition[]) {
      tools[t.name] = vercelTool({
        description: t.description,
        inputSchema: jsonSchema(t.parameters as any),
      });
    }
    opts.tools = tools;
  }

  if (options.toolChoice != null) {
    opts.toolChoice = options.toolChoice;
  }

  return opts;
}

/**
 * Reasoning-class models reject custom sampling parameters
 * (temperature, top_p). They only accept the default (temperature=1).
 *
 * Covers OpenAI's o-series and gpt-5 reasoning family. The check is
 * deliberately permissive — anything looking like `o1`, `o3`, `o4-mini`,
 * or `gpt-5*` is treated as reasoning. False positives only mean we
 * drop a temperature the model would have accepted; false negatives
 * mean a 400 from the provider.
 *
 * Exported for unit tests; callers should not need it.
 */
export function isReasoningModel(modelId: string | undefined): boolean {
  if (!modelId) return false;
  // Normalise: strip provider prefixes like "openai/" used by Vercel AI Gateway
  // and Cloudflare's /compat endpoint.
  const id = modelId.includes('/') ? modelId.slice(modelId.lastIndexOf('/') + 1) : modelId;
  return /^(o[134](?:-|$)|gpt-5(?:-|$)|o4-mini)/i.test(id);
}

/**
 * VercelLLMAdapter — Production LLM adapter powered by the Vercel AI SDK.
 *
 * Wraps `generateText` / `streamText` from the `ai` package, delegating to
 * any Vercel AI SDK–compatible model provider (OpenAI, Anthropic, Google,
 * Ollama, etc.).
 *
 * @example
 * ```typescript
 * import { openai } from '@ai-sdk/openai';
 * import { VercelLLMAdapter } from '@objectstack/service-ai';
 *
 * const adapter = new VercelLLMAdapter({ model: openai('gpt-4o') });
 * ```
 */
export class VercelLLMAdapter implements LLMAdapter {
  readonly name = 'vercel';

  private readonly model: LanguageModelV2;

  constructor(config: VercelLLMAdapterConfig) {
    this.model = config.model;
  }

  async chat(messages: ModelMessage[], options?: AIRequestOptions): Promise<AIResult> {
    const result = await generateText({
      model: this.model,
      messages,
      ...buildVercelOptions(options, this.model.modelId),
    });

    return {
      content: result.text,
      model: result.response?.modelId,
      toolCalls: result.toolCalls?.length ? result.toolCalls : undefined,
      usage: result.usage ? {
        promptTokens: result.usage.inputTokens ?? 0,
        completionTokens: result.usage.outputTokens ?? 0,
        totalTokens: result.usage.totalTokens ?? 0,
      } : undefined,
    };
  }

  async complete(prompt: string, options?: AIRequestOptions): Promise<AIResult> {
    const result = await generateText({
      model: this.model,
      prompt,
      ...buildVercelOptions(options, this.model.modelId),
    });

    return {
      content: result.text,
      model: result.response?.modelId,
      usage: result.usage ? {
        promptTokens: result.usage.inputTokens ?? 0,
        completionTokens: result.usage.outputTokens ?? 0,
        totalTokens: result.usage.totalTokens ?? 0,
      } : undefined,
    };
  }

  async *streamChat(
    messages: ModelMessage[],
    options?: AIRequestOptions,
  ): AsyncIterable<TextStreamPart<ToolSet>> {
    const result = streamText({
      model: this.model,
      messages,
      ...buildVercelOptions(options, this.model.modelId),
    });

    try {
      for await (const part of result.fullStream) {
        yield part as TextStreamPart<ToolSet>;
      }
    } catch (err) {
      // Convert provider errors into a typed `error` part so the encoder can
      // surface them to the client instead of leaving the SSE stream open.
      yield {
        type: 'error',
        error: err instanceof Error ? err : new Error(String(err)),
      } as unknown as TextStreamPart<ToolSet>;
    }
  }

  async embed(_input: string | string[]): Promise<number[][]> {
    // Vercel AI SDK uses a separate EmbeddingModel — not supported via this adapter.
    throw new Error(
      '[VercelLLMAdapter] Embeddings require a dedicated EmbeddingModel. ' +
      'Configure an embedding adapter instead.',
    );
  }

  async generateObject<T>(
    messages: ModelMessage[],
    schema: z.ZodType<T>,
    options?: GenerateObjectOptions,
  ): Promise<AIObjectResult<T>> {
    const { schemaName, schemaDescription, ...rest } = options ?? {};
    const result = await generateObject({
      model: this.model,
      messages,
      schema,
      schemaName,
      schemaDescription,
      ...buildVercelOptions(rest, this.model.modelId),
    });

    return {
      object: result.object as T,
      model: result.response?.modelId,
      usage: result.usage ? {
        promptTokens: result.usage.inputTokens ?? 0,
        completionTokens: result.usage.outputTokens ?? 0,
        totalTokens: result.usage.totalTokens ?? 0,
      } : undefined,
    };
  }

  async listModels(): Promise<string[]> {
    // Model listing is provider-specific and not available through the base SDK.
    return [];
  }
}

/**
 * Configuration for the Vercel LLM adapter.
 */
export interface VercelLLMAdapterConfig {
  /**
   * A Vercel AI SDK–compatible language model instance.
   *
   * @example `openai('gpt-4o')` or `anthropic('claude-sonnet-4-20250514')`
   */
  model: LanguageModelV2;
}
