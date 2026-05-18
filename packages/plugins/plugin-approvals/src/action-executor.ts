// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Approval Action Executor — M11.C15.B
 *
 * Pure dispatcher that runs the `ApprovalAction` items declared on
 * `ApprovalProcess.onSubmit / onFinalApprove / onFinalReject / onRecall`
 * and `ApprovalStep.onApprove / onReject`.
 *
 * Supported action types:
 *   - `field_update`   — write `config.field = config.value` on the
 *     business record (under SYSTEM_CTX so the lock hook is bypassed).
 *     `config.value` may be a literal or `"$status"` / `"$now"` /
 *     `"$actor"` / `"$comment"` token resolved against the runtime
 *     context.
 *   - `inbox_notify`   — insert one `sys_notification` row per target.
 *     `config.to` may be `'submitter' | 'pending_approvers'` or an
 *     explicit `string[]` of user ids. `config.title` / `config.body`
 *     interpolate `{record_id}`, `{object}`, `{status}`, `{step}`,
 *     `{actor}`, `{comment}`.
 *   - `webhook`        — POST `config.body` (JSON) to `config.url`,
 *     fire-and-forget (caller awaits with timeout). Headers default
 *     to `Content-Type: application/json`. Failures are logged, not
 *     thrown, so a flaky receiver can't deadlock the approval flow.
 *
 * Unimplemented (logged + skipped):
 *   - `email_alert`    — needs SMTP transport, later milestone.
 *   - `script`         — needs sandboxed runner, later milestone.
 *   - `connector_action` — needs connector registry, later milestone.
 */

import type { ApprovalEngine } from './approval-service.js';

const SYSTEM_CTX = { isSystem: true, roles: [], permissions: [] } as const;

export interface ActionLogger {
  info?: (msg: string, meta?: any) => void;
  warn?: (msg: string, meta?: any) => void;
  error?: (msg: string, meta?: any) => void;
  debug?: (msg: string, meta?: any) => void;
}

const noopLogger: Required<ActionLogger> = {
  info: () => {}, warn: () => {}, error: () => {}, debug: () => {},
};

/** Possible trigger points; passed to executors for tokenization. */
export type ApprovalTrigger =
  | 'submit'
  | 'step_approve'
  | 'final_approve'
  | 'step_reject'
  | 'final_reject'
  | 'recall';

export interface ExecutionContext {
  /** The trigger that caused these actions to fire. */
  trigger: ApprovalTrigger;
  /** Approval process row (parsed `definition`). */
  process: any;
  /** Approval request row (post-transition). */
  request: any;
  /** Current step config (when applicable). */
  step?: any;
  /** Business record (optional — looked up on demand if needed). */
  record?: any;
  /** Actor whose decision triggered the action; for `submit` this is the submitter. */
  actorId?: string | null;
  /** Comment passed with the decision. */
  comment?: string | null;
}

/** Default fetch implementation — overridable for tests. */
export type FetchLike = (
  input: any,
  init?: any,
) => Promise<{ ok: boolean; status: number; statusText: string }>;

export interface ExecuteActionsOptions {
  engine: ApprovalEngine;
  logger?: ActionLogger;
  fetch?: FetchLike;
  /** Maximum webhook duration in ms; default 5000. */
  webhookTimeoutMs?: number;
}

const DEFAULT_WEBHOOK_TIMEOUT_MS = 5000;

/** Public entry point — run an ordered list of actions. */
export async function executeActions(
  actions: any[] | undefined | null,
  ctx: ExecutionContext,
  opts: ExecuteActionsOptions,
): Promise<void> {
  if (!Array.isArray(actions) || actions.length === 0) return;
  const log = { ...noopLogger, ...(opts.logger ?? {}) };
  for (const a of actions) {
    try {
      await runOne(a, ctx, opts, log);
    } catch (err: any) {
      // Approval actions must not crash the transition — log + continue.
      log.error?.(`[approvals] action '${a?.type ?? '<unknown>'}' failed: ${err?.message ?? err}`, {
        action: a, trigger: ctx.trigger, request_id: ctx.request?.id,
      });
    }
  }
}

async function runOne(
  action: any,
  ctx: ExecutionContext,
  opts: ExecuteActionsOptions,
  log: Required<ActionLogger>,
): Promise<void> {
  if (!action || typeof action !== 'object') return;
  switch (action.type) {
    case 'field_update': return runFieldUpdate(action, ctx, opts, log);
    case 'inbox_notify': return runInboxNotify(action, ctx, opts, log);
    case 'webhook':      return runWebhook(action, ctx, opts, log);
    case 'email_alert':
    case 'script':
    case 'connector_action':
      log.warn?.(`[approvals] action type '${action.type}' is not implemented yet — skipping`, {
        action_name: action.name, trigger: ctx.trigger,
      });
      return;
    default:
      log.warn?.(`[approvals] unknown action type '${action.type}' — skipping`);
  }
}

// ── field_update ──────────────────────────────────────────────────

async function runFieldUpdate(
  action: any,
  ctx: ExecutionContext,
  opts: ExecuteActionsOptions,
  log: Required<ActionLogger>,
): Promise<void> {
  const cfg = action.config ?? {};
  const field: string | undefined = cfg.field;
  if (!field) {
    log.warn?.('[approvals] field_update missing config.field');
    return;
  }
  const value = resolveValueToken(cfg.value, ctx);
  const object = ctx.process?.object_name ?? ctx.process?.object;
  const recordId = ctx.request?.record_id;
  if (!object || !recordId) {
    log.warn?.('[approvals] field_update missing object/record context');
    return;
  }
  await opts.engine.update(
    object,
    { id: recordId, [field]: value },
    { context: SYSTEM_CTX },
  );
  log.debug?.(`[approvals] field_update ${object}/${recordId} set ${field}`, { value });
}

/** Resolve `$status`, `$now`, `$actor`, `$comment` or literal value. */
function resolveValueToken(raw: unknown, ctx: ExecutionContext): unknown {
  if (typeof raw !== 'string') return raw;
  switch (raw) {
    case '$status':   return ctx.request?.status ?? null;
    case '$now':      return new Date().toISOString();
    case '$actor':    return ctx.actorId ?? null;
    case '$comment':  return ctx.comment ?? null;
    case '$step':     return ctx.request?.current_step ?? null;
    case '$request_id': return ctx.request?.id ?? null;
    default: return raw;
  }
}

// ── inbox_notify ──────────────────────────────────────────────────

function interpolate(template: string, ctx: ExecutionContext): string {
  if (typeof template !== 'string') return template as any;
  return template
    .replace(/\{record_id\}/g, String(ctx.request?.record_id ?? ''))
    .replace(/\{object\}/g, String(ctx.process?.object_name ?? ctx.process?.object ?? ''))
    .replace(/\{status\}/g, String(ctx.request?.status ?? ''))
    .replace(/\{step\}/g, String(ctx.request?.current_step ?? ''))
    .replace(/\{actor\}/g, String(ctx.actorId ?? ''))
    .replace(/\{comment\}/g, String(ctx.comment ?? ''))
    .replace(/\{process\}/g, String(ctx.process?.name ?? ''));
}

async function runInboxNotify(
  action: any,
  ctx: ExecutionContext,
  opts: ExecuteActionsOptions,
  log: Required<ActionLogger>,
): Promise<void> {
  const cfg = action.config ?? {};
  const recipients = resolveRecipients(cfg.to, ctx);
  if (recipients.length === 0) {
    log.debug?.('[approvals] inbox_notify resolved no recipients — skipping');
    return;
  }
  const title = interpolate(cfg.title ?? 'Approval update', ctx);
  const body  = interpolate(cfg.body ?? '', ctx);
  // sys_notification.type is a select with a fixed enum; 'system' is the
  // safe default. Callers may override via cfg.notificationType but must
  // pick a value the schema accepts.
  const type  = String(cfg.notificationType ?? 'system');
  const rawLink = cfg.link
    ? interpolate(String(cfg.link), ctx)
    : `/console/system/approvals?requestId=${encodeURIComponent(ctx.request?.id ?? '')}`;
  // sys_notification.url is a URL field — only forward absolute URLs.
  // Relative deep-links (`/system/approvals`) get stripped to satisfy
  // validation; the recipient can still navigate via the source linkage.
  const url = /^https?:\/\//i.test(rawLink) ? rawLink : null;
  const now = new Date().toISOString();

  for (const recipient of recipients) {
    try {
      await opts.engine.insert(
        'sys_notification',
        {
          id: `notif_${cryptoRandom()}`,
          recipient_id: String(recipient),
          type,
          title,
          body,
          url,
          is_read: false,
          source_object: ctx.process?.object_name ?? ctx.process?.object ?? null,
          source_id: ctx.request?.record_id ?? null,
          created_at: now,
          updated_at: now,
        },
        { context: SYSTEM_CTX },
      );
    } catch (err: any) {
      // Notification persistence is best-effort.
      log.warn?.(`[approvals] inbox_notify insert failed for ${recipient}: ${err?.message ?? err}`);
    }
  }
}

function resolveRecipients(to: unknown, ctx: ExecutionContext): string[] {
  if (Array.isArray(to)) return to.map(String).filter(Boolean);
  if (typeof to === 'string') {
    if (to === 'submitter') return ctx.request?.submitter_id ? [String(ctx.request.submitter_id)] : [];
    if (to === 'pending_approvers') {
      const list = ctx.request?.pending_approvers ?? [];
      if (Array.isArray(list)) return list.map(String).filter(Boolean);
      if (typeof list === 'string') return list.split(',').map(s => s.trim()).filter(Boolean);
      return [];
    }
    // Fall through: literal user id.
    return [to];
  }
  return [];
}

function cryptoRandom(): string {
  const g: any = globalThis as any;
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

// ── webhook ──────────────────────────────────────────────────────

async function runWebhook(
  action: any,
  ctx: ExecutionContext,
  opts: ExecuteActionsOptions,
  log: Required<ActionLogger>,
): Promise<void> {
  const cfg = action.config ?? {};
  const url: string | undefined = cfg.url;
  if (!url) {
    log.warn?.('[approvals] webhook missing config.url');
    return;
  }
  const fetchImpl: FetchLike = opts.fetch ?? (globalThis as any).fetch;
  if (!fetchImpl) {
    log.warn?.('[approvals] webhook skipped — no fetch implementation available');
    return;
  }
  const timeoutMs = opts.webhookTimeoutMs ?? DEFAULT_WEBHOOK_TIMEOUT_MS;
  const headers = { 'Content-Type': 'application/json', ...(cfg.headers ?? {}) };
  const payload = {
    trigger: ctx.trigger,
    request: ctx.request,
    step: ctx.step ? { name: ctx.step.name, index: ctx.request?.current_step_index } : null,
    actor_id: ctx.actorId ?? null,
    comment: ctx.comment ?? null,
    process_name: ctx.process?.name,
    object: ctx.process?.object_name ?? ctx.process?.object,
    ...(cfg.body && typeof cfg.body === 'object' ? cfg.body : {}),
  };
  // Manual timeout — works in Node 18+ without AbortController dependency.
  const controller = (globalThis as any).AbortController ? new (globalThis as any).AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: cfg.method ?? 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller?.signal,
    });
    if (!res.ok) {
      log.warn?.(`[approvals] webhook ${url} → ${res.status} ${res.statusText}`);
    }
  } catch (err: any) {
    log.warn?.(`[approvals] webhook ${url} failed: ${err?.message ?? err}`);
  } finally {
    clearTimeout(timer);
  }
}
