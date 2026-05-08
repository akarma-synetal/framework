/**
 * Template dialect engine — strict Mustache subset.
 *
 * Supports `{{path.to.value}}` interpolation only. No conditionals, no loops,
 * no helpers. The variable scope is the same as CEL (`record`, `previous`,
 * `input`, `os.user`, `os.org`, `os.env`, plus `extra`), so authors can move
 * fluidly between a CEL formula and a template body without re-learning a
 * second variable namespace.
 *
 * Why a separate dialect from CEL: templates produce strings (notification
 * subjects, prompt bodies, titleFormat). CEL is a value-typed expression
 * language. Routing them through the same envelope (`{ dialect: 'template' }`)
 * keeps the AI author rule simple — "anything templated or computed is an
 * Expression" — without conflating the two semantics.
 */

import type { Expression } from '@objectstack/spec';

import { buildScope } from './stdlib';
import type { DialectEngine, EvalContext, EvalResult } from './types';

const PATH_RE = /\{\{\s*([\w.[\]]+?)\s*\}\}/g;

function resolvePath(scope: Record<string, unknown>, path: string): unknown {
  // Support `a.b.c` and `a[0].b` style. Bracket notation collapses to dotted.
  const normalized = path.replace(/\[(\w+)\]/g, '.$1');
  const segments = normalized.split('.').filter(Boolean);
  let cursor: unknown = scope;
  for (const seg of segments) {
    if (cursor == null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[seg];
  }
  return cursor;
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'bigint') return value.toString();
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function compileTemplate(source: string): EvalResult<string[]> {
  // Compile is only a structural validity check — no helpers, no balanced
  // open/close beyond what the regex enforces.
  const matches = source.match(/\{\{|\}\}/g) ?? [];
  if (matches.length % 2 !== 0) {
    return {
      ok: false,
      error: { kind: 'parse', message: 'template has unbalanced {{ }} delimiters' },
    };
  }
  const refs: string[] = [];
  let m: RegExpExecArray | null;
  PATH_RE.lastIndex = 0;
  while ((m = PATH_RE.exec(source)) !== null) {
    refs.push(m[1]);
  }
  return { ok: true, value: refs };
}

export const templateEngine: DialectEngine = {
  dialect: 'template',

  compile(source: string): EvalResult<unknown> {
    return compileTemplate(source);
  },

  evaluate<T = unknown>(expr: Expression, ctx: EvalContext): EvalResult<T> {
    if (expr.dialect !== 'template') {
      return {
        ok: false,
        error: { kind: 'dialect', message: `templateEngine cannot evaluate dialect '${expr.dialect}'` },
      };
    }
    if (typeof expr.source !== 'string') {
      return {
        ok: false,
        error: { kind: 'parse', message: 'template Expression.source required' },
      };
    }
    const check = compileTemplate(expr.source);
    if (!check.ok) return check as EvalResult<T>;

    const scope = buildScope(ctx);
    const out = expr.source.replace(PATH_RE, (_match, path) => {
      return stringify(resolvePath(scope, path));
    });
    return { ok: true, value: out as unknown as T };
  },
};
