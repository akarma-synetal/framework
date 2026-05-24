// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { ModelRegistry, computeCost } from '../model-registry.js';
import type * as AI from '@objectstack/spec/ai';

const gpt4o: AI.ModelConfig = {
  id: 'gpt-4o',
  name: 'GPT-4o',
  version: '2024-08-06',
  provider: 'openai',
  capabilities: { textGeneration: true, functionCalling: true },
  limits: { maxTokens: 128000, contextWindow: 128000 },
  pricing: { inputCostPer1kTokens: 0.0025, outputCostPer1kTokens: 0.01, currency: 'USD' },
};

const haiku: AI.ModelConfig = {
  id: 'claude-haiku',
  name: 'Claude Haiku',
  version: '2024-10-22',
  provider: 'anthropic',
  capabilities: { textGeneration: true },
  limits: { maxTokens: 200000, contextWindow: 200000 },
  pricing: { inputCostPer1kTokens: 0.001, outputCostPer1kTokens: 0.005, currency: 'USD' },
};

describe('ModelRegistry', () => {
  it('registers and retrieves models', () => {
    const r = new ModelRegistry({ models: [gpt4o, haiku] });
    expect(r.size).toBe(2);
    expect(r.get('gpt-4o')?.id).toBe('gpt-4o');
    expect(r.get('claude-haiku')?.provider).toBe('anthropic');
    expect(r.get('missing')).toBeUndefined();
  });

  it('resolves default model explicitly or via insertion order', () => {
    const r1 = new ModelRegistry({ models: [gpt4o, haiku], defaultModelId: 'claude-haiku' });
    expect(r1.getDefault()?.id).toBe('claude-haiku');

    const r2 = new ModelRegistry({ models: [gpt4o, haiku] });
    expect(r2.getDefault()?.id).toBe('gpt-4o');

    const r3 = new ModelRegistry();
    expect(r3.getDefault()).toBeUndefined();
  });

  it('throws on getOrThrow for unknown id', () => {
    const r = new ModelRegistry({ models: [gpt4o] });
    expect(() => r.getOrThrow('nope')).toThrow(/Unknown model "nope"/);
  });

  it('estimates cost from pricing', () => {
    const r = new ModelRegistry({ models: [gpt4o] });
    const c = r.estimateCost('gpt-4o', {
      promptTokens: 1000,
      completionTokens: 2000,
    });
    expect(c).toBeDefined();
    expect(c!.inputCost).toBeCloseTo(0.0025);
    expect(c!.outputCost).toBeCloseTo(0.02);
    expect(c!.totalCost).toBeCloseTo(0.0225);
    expect(c!.currency).toBe('USD');
  });

  it('returns undefined cost when model is unknown or unpriced', () => {
    const r = new ModelRegistry({ models: [{ ...gpt4o, pricing: undefined }] });
    expect(r.estimateCost('gpt-4o', { promptTokens: 1, completionTokens: 1 })).toBeUndefined();
    expect(r.estimateCost('???', { promptTokens: 1, completionTokens: 1 })).toBeUndefined();
  });
});

describe('computeCost', () => {
  it('handles missing pricing fields gracefully', () => {
    const c = computeCost(
      { inputCostPer1kTokens: 0.01 },
      { promptTokens: 500, completionTokens: 500 },
    );
    expect(c.inputCost).toBeCloseTo(0.005);
    expect(c.outputCost).toBe(0);
    expect(c.totalCost).toBeCloseTo(0.005);
    expect(c.currency).toBe('USD');
  });
});
