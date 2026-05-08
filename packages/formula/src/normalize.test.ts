import { describe, expect, it } from 'vitest';
import { cel, F, P } from '@objectstack/spec';

import { normalizeExpression, normalizeExpressionTree } from './normalize';

describe('cel/F/P tagged templates', () => {
  it('cel`...` produces an Expression envelope with dialect=cel', () => {
    const e = cel`record.amount > 1000`;
    expect(e).toEqual({ dialect: 'cel', source: 'record.amount > 1000' });
  });

  it('F is a cel alias for formulas', () => {
    expect(F`1 + 1`).toEqual({ dialect: 'cel', source: '1 + 1' });
  });

  it('P is a cel alias for predicates', () => {
    expect(P`x == 1`).toEqual({ dialect: 'cel', source: 'x == 1' });
  });

  it('JSON-escapes interpolated strings', () => {
    const name = "O'Brien";
    const e = cel`record.owner == ${name}`;
    expect(e.source).toBe('record.owner == "O\'Brien"');
  });

  it('passes numbers and booleans through unchanged', () => {
    const e = cel`record.x > ${100} && record.flag == ${true}`;
    expect(e.source).toBe('record.x > 100 && record.flag == true');
  });
});

describe('normalizeExpression', () => {
  it('lifts bare strings to {dialect:cel,source} and adds ast', () => {
    const r = normalizeExpression('1 + 1');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.dialect).toBe('cel');
      expect(r.value.source).toBe('1 + 1');
      expect(r.value.ast).toBeDefined();
    }
  });

  it('compiles existing source expressions adding ast', () => {
    const r = normalizeExpression({ dialect: 'cel', source: 'record.x > 1' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.ast).toBeDefined();
  });

  it('returns parse error with kind=parse', () => {
    const r = normalizeExpression('1 +');
    expect(r.ok).toBe(false);
  });
});

describe('normalizeExpressionTree', () => {
  it('walks nested objects and adds ast in place', () => {
    const tree = {
      view: {
        visible: { dialect: 'cel', source: 'record.x > 1' },
      },
      action: {
        disabled: { dialect: 'cel', source: 'record.locked' },
      },
    };
    const err = normalizeExpressionTree(tree);
    expect(err).toBeNull();
    expect((tree.view.visible as { ast: unknown }).ast).toBeDefined();
    expect((tree.action.disabled as { ast: unknown }).ast).toBeDefined();
  });

  it('walks arrays', () => {
    const tree = {
      rules: [
        { condition: { dialect: 'cel', source: 'record.a > 1' } },
        { condition: { dialect: 'cel', source: 'record.b == "x"' } },
      ],
    };
    const err = normalizeExpressionTree(tree);
    expect(err).toBeNull();
    for (const r of tree.rules) expect((r.condition as { ast: unknown }).ast).toBeDefined();
  });

  it('reports the dotted path of the offending node on error', () => {
    const tree = {
      objects: { task: { hooks: { 0: { condition: { dialect: 'cel', source: '1 +' } } } } },
    };
    const err = normalizeExpressionTree(tree);
    expect(err).not.toBeNull();
    expect(err!.path).toContain('condition');
  });

  it('ignores non-Expression objects', () => {
    const tree = { dialect: 'something', notAnExpression: true };
    const err = normalizeExpressionTree(tree);
    expect(err).toBeNull();
    // Tree should be unchanged
    expect((tree as { ast?: unknown }).ast).toBeUndefined();
  });
});
