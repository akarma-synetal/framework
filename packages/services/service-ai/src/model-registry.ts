// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type * as AI from '@objectstack/spec/ai';

/**
 * ModelRegistry — In-memory runtime registry for AI models.
 *
 * Provides:
 * - Model lookup by id
 * - Default model resolution
 * - Token-based cost estimation
 *
 * Populated from `objectstack.config.ts` at boot. Pure in-memory by design —
 * suitable for serverless / edge runtimes. Persistent registries should be
 * implemented as a wrapper that hydrates this registry at start time.
 *
 * @example
 * ```ts
 * const registry = new ModelRegistry({
 *   models: [{
 *     id: 'gpt-4o',
 *     name: 'GPT-4o',
 *     version: '2024-08-06',
 *     provider: 'openai',
 *     capabilities: { textGeneration: true, functionCalling: true },
 *     limits: { maxTokens: 128000, contextWindow: 128000 },
 *     pricing: { inputCostPer1kTokens: 0.0025, outputCostPer1kTokens: 0.01 },
 *   }],
 *   defaultModelId: 'gpt-4o',
 * });
 * const cost = registry.estimateCost('gpt-4o', { promptTokens: 1000, completionTokens: 500 });
 * ```
 */
export class ModelRegistry {
  private readonly models = new Map<string, AI.ModelConfig>();
  private defaultModelId?: string;

  constructor(config: ModelRegistryConfig = {}) {
    for (const model of config.models ?? []) {
      this.models.set(model.id, model);
    }
    this.defaultModelId = config.defaultModelId;
  }

  /** Register or replace a model. */
  register(model: AI.ModelConfig): void {
    this.models.set(model.id, model);
  }

  /** Look up a model by id. */
  get(id: string): AI.ModelConfig | undefined {
    return this.models.get(id);
  }

  /** Look up a model by id, throwing if missing. */
  getOrThrow(id: string): AI.ModelConfig {
    const model = this.models.get(id);
    if (!model) {
      throw new Error(
        `[ModelRegistry] Unknown model "${id}". Registered: ${
          [...this.models.keys()].join(', ') || '(none)'
        }`,
      );
    }
    return model;
  }

  /** Resolve the default model (explicit > first registered > undefined). */
  getDefault(): AI.ModelConfig | undefined {
    if (this.defaultModelId) {
      return this.models.get(this.defaultModelId);
    }
    return this.models.values().next().value;
  }

  /** Set the default model id (must already be registered). */
  setDefault(id: string): void {
    this.getOrThrow(id);
    this.defaultModelId = id;
  }

  /** All registered models. */
  list(): AI.ModelConfig[] {
    return [...this.models.values()];
  }

  /** Number of registered models. */
  get size(): number {
    return this.models.size;
  }

  /**
   * Estimate cost in the model's currency (defaults to USD).
   *
   * Returns `undefined` when the model is unknown or has no pricing data.
   * Costs are computed as `(tokens / 1000) * pricePer1kTokens` for input and
   * output independently, then summed.
   */
  estimateCost(modelId: string, usage: TokenUsage): CostEstimate | undefined {
    const model = this.models.get(modelId);
    if (!model?.pricing) return undefined;
    return computeCost(model.pricing, usage);
  }
}

/** Token usage shape (mirrors `AIResult['usage']`). */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
}

/** Cost estimate returned by {@link ModelRegistry.estimateCost}. */
export interface CostEstimate {
  /** Cost attributable to prompt/input tokens. */
  inputCost: number;
  /** Cost attributable to completion/output tokens. */
  outputCost: number;
  /** `inputCost + outputCost`. */
  totalCost: number;
  /** ISO 4217 currency code. */
  currency: string;
}

/** Configuration for {@link ModelRegistry}. */
export interface ModelRegistryConfig {
  /** Models to register at construction. */
  models?: AI.ModelConfig[];
  /** Default model id (must appear in `models`). */
  defaultModelId?: string;
}

/**
 * Compute cost from pricing + usage. Exported for direct use when a registry
 * is not in scope (e.g. tests or one-off calculations).
 */
export function computeCost(pricing: AI.ModelPricing, usage: TokenUsage): CostEstimate {
  const inputCost =
    pricing.inputCostPer1kTokens != null
      ? (usage.promptTokens / 1000) * pricing.inputCostPer1kTokens
      : 0;
  const outputCost =
    pricing.outputCostPer1kTokens != null
      ? (usage.completionTokens / 1000) * pricing.outputCostPer1kTokens
      : 0;
  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    currency: pricing.currency ?? 'USD',
  };
}
