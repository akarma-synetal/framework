// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * LLMAdapter — LLM Provider Adapter Contract
 *
 * Adapters translate between the ObjectStack AI protocol and concrete
 * LLM provider SDKs (OpenAI, Anthropic, Ollama, etc.).
 *
 * Each adapter is a thin wrapper — all orchestration, conversation
 * management, and tool execution logic lives in the AI service layer.
 *
 * Follows Dependency Inversion Principle — third-party adapter packages
 * depend only on `@objectstack/spec/contracts` for type alignment.
 *
 * Aligned with `IAIService` in `ai-service.ts`.
 */

import type {
  ModelMessage,
  TextStreamPart,
  ToolSet,
} from 'ai';

import type {
  AIRequestOptions,
  AIResult,
  AIObjectResult,
  GenerateObjectOptions,
} from './ai-service.js';
import type { z } from 'zod';

export interface LLMAdapter {
  /** Unique adapter identifier (e.g. 'openai', 'anthropic', 'memory') */
  readonly name: string;

  /**
   * Generate a chat completion.
   * @param messages - Conversation messages (Vercel `ModelMessage`)
   * @param options  - Request configuration (includes tool definitions)
   */
  chat(messages: ModelMessage[], options?: AIRequestOptions): Promise<AIResult>;

  /**
   * Generate a text completion from a single prompt.
   * @param prompt  - Input prompt string
   * @param options - Request configuration
   */
  complete(prompt: string, options?: AIRequestOptions): Promise<AIResult>;

  /**
   * Stream a chat completion as an async iterable of Vercel AI SDK stream parts.
   * Implementations that do not support streaming may omit this method.
   */
  streamChat?(messages: ModelMessage[], options?: AIRequestOptions): AsyncIterable<TextStreamPart<ToolSet>>;

  /**
   * Generate embedding vectors.
   */
  embed?(input: string | string[], model?: string): Promise<number[][]>;

  /**
   * Generate a strongly-typed object that conforms to a Zod schema.
   *
   * Adapters should delegate to the provider's native structured-output
   * facility when available. Adapters without structured-output support
   * may omit this method — the AI service will throw a clear error.
   */
  generateObject?<T>(
    messages: ModelMessage[],
    schema: z.ZodType<T>,
    options?: GenerateObjectOptions,
  ): Promise<AIObjectResult<T>>;

  /**
   * List models available through this adapter.
   */
  listModels?(): Promise<string[]>;
}
