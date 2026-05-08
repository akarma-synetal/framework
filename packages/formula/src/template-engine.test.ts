import { describe, expect, it } from 'vitest';

import { templateEngine } from './template-engine';

describe('templateEngine', () => {
  it('substitutes simple paths', () => {
    const r = templateEngine.evaluate(
      { dialect: 'template', source: 'Hi {{record.name}}!' },
      { record: { name: 'Lisa' } },
    );
    expect(r).toEqual({ ok: true, value: 'Hi Lisa!' });
  });

  it('renders nested paths', () => {
    const r = templateEngine.evaluate(
      { dialect: 'template', source: '{{record.account.name}} ({{record.account.tier}})' },
      { record: { account: { name: 'Acme', tier: 'gold' } } },
    );
    expect(r).toEqual({ ok: true, value: 'Acme (gold)' });
  });

  it('renders empty for missing paths', () => {
    const r = templateEngine.evaluate(
      { dialect: 'template', source: 'X={{record.missing}}Y' },
      { record: {} },
    );
    expect(r).toEqual({ ok: true, value: 'X=Y' });
  });

  it('exposes os.user / os.org / os.env', () => {
    const r = templateEngine.evaluate(
      { dialect: 'template', source: '{{os.user.id}}@{{os.org.id}}' },
      { user: { id: 'u1' }, org: { id: 'o1' } },
    );
    expect(r).toEqual({ ok: true, value: 'u1@o1' });
  });

  it('rejects unbalanced delimiters', () => {
    const r = templateEngine.compile('Hi {{name');
    expect(r.ok).toBe(false);
  });

  it('refuses non-template dialect', () => {
    const r = templateEngine.evaluate(
      { dialect: 'cel', source: '1' } as never,
      {},
    );
    expect(r.ok).toBe(false);
  });

  it('handles bracket notation', () => {
    const r = templateEngine.evaluate(
      { dialect: 'template', source: '{{record.tags[0]}}' },
      { record: { tags: ['hot', 'cold'] } },
    );
    expect(r).toEqual({ ok: true, value: 'hot' });
  });
});
