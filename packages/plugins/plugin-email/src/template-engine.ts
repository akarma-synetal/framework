// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Minimal mustache-style template renderer.
 *
 * Supports `{{path.to.value}}` placeholders resolved against a plain
 * JS object via dotted-path lookup. Values are HTML-escaped by
 * default; use `{{{path}}}` (triple braces) to opt out of escaping
 * (e.g. when injecting pre-rendered HTML fragments such as URLs in
 * `<a href="">`).
 *
 * Deliberately tiny (no loops / conditionals / partials) — the design
 * stance is that email templates SHOULD be data-only renderings; any
 * branching belongs in the caller. If we ever need more, swap for
 * Handlebars, but bringing it in costs ~50KB and pulls a parser at
 * runtime; we resist that until a real use case demands it.
 */

const PLACEHOLDER = /(\{\{\{?)\s*([\w.]+)\s*(\}?\}\})/g;

function lookup(data: Record<string, any>, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split('.');
  let cur: any = data;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render `template` with values from `data`. Missing placeholders
 * render as empty strings (no throw); call `requireVars()` first if
 * you need strict validation.
 */
export function renderTemplate(template: string, data: Record<string, any>): string {
  if (!template) return '';
  return template.replace(PLACEHOLDER, (_match, open: string, path: string, close: string) => {
    const isUnescaped = open === '{{{' && close === '}}}';
    const raw = lookup(data, path);
    if (raw == null) return '';
    const str = typeof raw === 'string' ? raw : String(raw);
    return isUnescaped ? str : escapeHtml(str);
  });
}

/**
 * Throw `Error('MISSING_VARIABLES: a, b')` when required vars are
 * absent from `data`. Used by `IEmailService.sendTemplate()` to
 * fail fast rather than send a half-rendered email.
 */
export function requireVars(
  data: Record<string, any>,
  required: ReadonlyArray<string>,
): void {
  const missing = required.filter((name) => lookup(data, name) == null);
  if (missing.length > 0) {
    throw new Error(`MISSING_VARIABLES: ${missing.join(', ')}`);
  }
}

/**
 * Strip HTML tags + collapse whitespace to derive a plain-text body
 * from an HTML template. Conservative: keeps line breaks at block
 * boundaries (<br>, </p>, </div>) so the resulting text is at least
 * paragraph-shaped.
 */
export function htmlToText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
