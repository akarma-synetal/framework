// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { SettingsManifestSchema } from '@objectstack/spec/system';
import { aiSettingsManifest, aiTestActionHandler } from './ai.manifest';

describe('aiSettingsManifest', () => {
  it('parses against SettingsManifestSchema', () => {
    expect(() => SettingsManifestSchema.parse(aiSettingsManifest)).not.toThrow();
  });

  it('declares namespace=ai, scope=global, version=1', () => {
    const parsed = SettingsManifestSchema.parse(aiSettingsManifest);
    expect(parsed.namespace).toBe('ai');
    expect(parsed.scope).toBe('global');
    expect(parsed.version).toBe(1);
  });

  it('exposes provider select with memory + gateway + 3 SDK providers', () => {
    const provider = (aiSettingsManifest.specifiers as any[]).find(
      (s) => s.key === 'provider' && s.type === 'select',
    );
    expect(provider).toBeDefined();
    const values = provider.options.map((o: any) => o.value).sort();
    expect(values).toEqual(['anthropic', 'gateway', 'google', 'memory', 'openai']);
    expect(provider.default).toBe('memory');
  });

  it('marks every per-provider api key field as encrypted password input', () => {
    const keys = ['openai_api_key', 'anthropic_api_key', 'google_api_key', 'gateway_api_key'];
    for (const key of keys) {
      const f = (aiSettingsManifest.specifiers as any[]).find((s) => s.key === key);
      expect(f, `${key} missing`).toBeDefined();
      expect(f.type).toBe('password');
      expect(f.encrypted).toBe(true);
    }
  });

  it('exposes a test action that POSTs to /api/settings/ai/test', () => {
    const test = (aiSettingsManifest.specifiers as any[]).find(
      (s) => s.type === 'action_button' && s.id === 'test',
    );
    expect(test).toBeDefined();
    expect(test.handler).toEqual({ kind: 'http', method: 'POST', url: '/api/settings/ai/test' });
  });
});

describe('aiTestActionHandler', () => {
  it('returns warning for memory provider (no external call to validate)', async () => {
    const r = await aiTestActionHandler({ values: { provider: 'memory' } } as any);
    expect(r.ok).toBe(true);
    expect(r.severity).toBe('warning');
  });

  it('rejects gateway provider without gateway_model', async () => {
    const r = await aiTestActionHandler({ values: { provider: 'gateway' } } as any);
    expect(r.ok).toBe(false);
    expect(r.severity).toBe('error');
  });

  it('rejects openai provider without api key', async () => {
    const r = await aiTestActionHandler({ values: { provider: 'openai' } } as any);
    expect(r.ok).toBe(false);
    expect(r.severity).toBe('error');
  });

  it('accepts openai provider with api key and reports the model', async () => {
    const r = await aiTestActionHandler({
      values: { provider: 'openai', openai_api_key: 'sk-test', openai_model: 'gpt-4o' },
    } as any);
    expect(r.ok).toBe(true);
    expect(r.message).toContain('gpt-4o');
  });

  it('accepts anthropic with api key', async () => {
    const r = await aiTestActionHandler({
      values: { provider: 'anthropic', anthropic_api_key: 'sk-ant-test' },
    } as any);
    expect(r.ok).toBe(true);
  });
});
