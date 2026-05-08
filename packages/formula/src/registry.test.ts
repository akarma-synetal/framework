import { describe, expect, it } from 'vitest';

import { ExpressionEngine, getEngine, hasDialect } from './registry';
import type { Expression } from '@objectstack/spec';

describe('ExpressionEngine registry', () => {
  it('routes cel dialect to celEngine', () => {
    const expr: Expression = { dialect: 'cel', source: '1 + 1' };
    const r = ExpressionEngine.evaluate(expr, {});
    expect(r).toEqual({ ok: true, value: 2 });
  });

  it('returns dialect error for js stub', () => {
    const expr: Expression = { dialect: 'js', source: 'foo' };
    const r = ExpressionEngine.evaluate(expr, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('dialect');
  });

  it('routes cron dialect to cronEngine (validates schedule)', () => {
    const expr: Expression = { dialect: 'cron', source: '* * * * *' };
    const r = ExpressionEngine.evaluate(expr, {});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('* * * * *');
  });

  it('cron rejects malformed source', () => {
    const r = ExpressionEngine.evaluate({ dialect: 'cron', source: 'not a cron' }, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('parse');
  });

  it('routes template dialect to templateEngine', () => {
    const r = ExpressionEngine.evaluate(
      { dialect: 'template', source: 'Hello {{record.name}}' },
      { record: { name: 'World' } },
    );
    expect(r).toEqual({ ok: true, value: 'Hello World' });
  });

  it('returns dialect error for unknown dialect', () => {
    const r = ExpressionEngine.evaluate({ dialect: 'xyz' as never, source: 'x' }, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('dialect');
  });

  it('compile() emits AST for valid CEL source', () => {
    const r = ExpressionEngine.compile({ dialect: 'cel', source: 'record.x > 1' });
    expect(r.ok).toBe(true);
  });

  it('getEngine returns registered engine', () => {
    expect(getEngine('cel')?.dialect).toBe('cel');
    expect(getEngine('js')?.dialect).toBe('js');
    expect(getEngine('nonexistent')).toBeUndefined();
  });

  it('hasDialect distinguishes real engines from stubs', () => {
    expect(hasDialect('cel')).toBe(true);
  });
});
