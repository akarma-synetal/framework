// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import stack from '../objectstack.config.js';

describe('app-crm minimal metadata bundle', () => {
  it('exposes the expected manifest', () => {
    expect(stack.manifest.id).toBe('com.example.crm');
    expect(stack.manifest.namespace).toBe('crm');
    expect(stack.manifest.type).toBe('app');
  });

  it('registers the 3 core objects', () => {
    const names = (stack.objects ?? []).map((o) => o.name).sort();
    expect(names).toEqual(['crm_account', 'crm_contact', 'crm_opportunity']);
  });

  it('registers exactly one app, one dashboard, one hook, one flow', () => {
    expect(stack.apps).toHaveLength(1);
    expect(stack.dashboards).toHaveLength(1);
    expect(stack.hooks).toHaveLength(1);
    expect(stack.flows).toHaveLength(1);
  });

  it('ships seed data for every object', () => {
    expect(stack.data).toBeDefined();
    expect((stack.data ?? []).length).toBeGreaterThanOrEqual(3);
  });
});
