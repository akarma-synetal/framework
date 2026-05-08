/**
 * Cron dialect engine.
 *
 * Validates cron expressions at compile time without depending on a parser.
 * Actual schedule firing lives in the scheduler service — this engine just
 * round-trips the expression through `Expression.evaluate`, returning the
 * source so callers can hand it to a scheduler library.
 *
 * Accepted forms:
 *   - 5-field standard cron:  `m h dom mon dow`
 *   - 6-field extended cron:  `s m h dom mon dow`
 *   - Aliases: @yearly, @annually, @monthly, @weekly, @daily, @hourly, @reboot
 */

import type { Expression } from '@objectstack/spec';

import type { DialectEngine, EvalContext, EvalResult } from './types';

const ALIASES = new Set([
  '@yearly', '@annually', '@monthly', '@weekly', '@daily', '@hourly', '@reboot',
]);

function validate(source: string): EvalResult<string> {
  const trimmed = source.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: { kind: 'parse', message: 'cron source is empty' } };
  }
  if (trimmed.startsWith('@')) {
    if (!ALIASES.has(trimmed)) {
      return {
        ok: false,
        error: { kind: 'parse', message: `unknown cron alias '${trimmed}'` },
      };
    }
    return { ok: true, value: trimmed };
  }
  const fields = trimmed.split(/\s+/);
  if (fields.length !== 5 && fields.length !== 6) {
    return {
      ok: false,
      error: {
        kind: 'parse',
        message: `cron requires 5 or 6 space-separated fields, got ${fields.length}`,
      },
    };
  }
  // Each field must use only allowed cron characters.
  const allowed = /^[\d*/,\-?LWA-Z#]+$/i;
  for (let i = 0; i < fields.length; i++) {
    if (!allowed.test(fields[i])) {
      return {
        ok: false,
        error: {
          kind: 'parse',
          message: `cron field ${i + 1} contains invalid characters: '${fields[i]}'`,
        },
      };
    }
  }
  return { ok: true, value: trimmed };
}

export const cronEngine: DialectEngine = {
  dialect: 'cron',

  compile(source: string): EvalResult<unknown> {
    return validate(source);
  },

  evaluate<T = unknown>(expr: Expression, _ctx: EvalContext): EvalResult<T> {
    if (expr.dialect !== 'cron') {
      return {
        ok: false,
        error: { kind: 'dialect', message: `cronEngine cannot evaluate dialect '${expr.dialect}'` },
      };
    }
    if (typeof expr.source !== 'string') {
      return { ok: false, error: { kind: 'parse', message: 'cron Expression.source required' } };
    }
    const result = validate(expr.source);
    if (!result.ok) return result as EvalResult<T>;
    // Cron expressions don't "evaluate" to a value at predicate time — they
    // describe a schedule. Returning the source lets schedulers consume it.
    return { ok: true, value: result.value as unknown as T };
  },
};
