// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Logger } from '@objectstack/spec/contracts';
import type { IAIService } from '@objectstack/spec/contracts';
import type { RouteDefinition } from './ai-routes.js';

/**
 * Build pending-action (HITL approval) REST routes.
 *
 * | Method | Path | Description |
 * |:---|:---|:---|
 * | GET    | /api/v1/ai/pending-actions               | List pending actions (filter by status) |
 * | GET    | /api/v1/ai/pending-actions/:id           | Get a single pending action |
 * | POST   | /api/v1/ai/pending-actions/:id/approve   | Approve & execute |
 * | POST   | /api/v1/ai/pending-actions/:id/reject    | Reject with optional reason |
 *
 * Auth: requires `ai:approve` permission for approve/reject. Listing/reads
 * require the lighter `ai:read` permission so operators can monitor the
 * queue without execution rights.
 */
export function buildPendingActionRoutes(
  aiService: IAIService,
  logger: Logger,
): RouteDefinition[] {
  // Guard: if the AI service doesn't implement HITL methods (e.g. older
  // build or no dataEngine wired), surface a clear 501 instead of NPE.
  const supported =
    typeof aiService.listPendingActions === 'function' &&
    typeof aiService.approvePendingAction === 'function' &&
    typeof aiService.rejectPendingAction === 'function';

  if (!supported) {
    logger.warn(
      '[AI] HITL pending-action methods not implemented on AI service — routes return 501.',
    );
  }

  const notImpl = () => ({
    status: 501,
    body: { error: 'Pending-action queue not available (dataEngine not wired)' },
  });

  return [
    // ── List pending actions ───────────────────────────────────────
    {
      method: 'GET',
      path: '/api/v1/ai/pending-actions',
      description: 'List pending actions in the HITL approval queue',
      auth: true,
      permissions: ['ai:read'],
      handler: async (req) => {
        if (!supported) return notImpl();
        try {
          const query = (req.query ?? {}) as Record<string, unknown>;
          const status = typeof query.status === 'string' ? (query.status as any) : undefined;
          const conversationId =
            typeof query.conversationId === 'string' ? query.conversationId : undefined;
          const limitRaw = query.limit;
          const limit = typeof limitRaw === 'string' ? Number(limitRaw) : undefined;
          const rows = await aiService.listPendingActions!({
            status,
            conversationId,
            limit: Number.isFinite(limit) ? limit : undefined,
          });
          return { status: 200, body: { items: rows, total: rows.length } };
        } catch (err) {
          logger.error(
            '[AI Route] /pending-actions list error',
            err instanceof Error ? err : undefined,
          );
          return { status: 500, body: { error: 'Failed to list pending actions' } };
        }
      },
    },

    // ── Get a single pending action ────────────────────────────────
    {
      method: 'GET',
      path: '/api/v1/ai/pending-actions/:id',
      description: 'Get a single pending action by id',
      auth: true,
      permissions: ['ai:read'],
      handler: async (req) => {
        if (!supported) return notImpl();
        const id = req.params?.id;
        if (!id) return { status: 400, body: { error: 'id is required' } };
        try {
          const rows = await aiService.listPendingActions!({});
          const found = rows.find(r => r.id === id);
          if (!found) return { status: 404, body: { error: `Pending action ${id} not found` } };
          return { status: 200, body: found };
        } catch (err) {
          logger.error(
            '[AI Route] /pending-actions/:id error',
            err instanceof Error ? err : undefined,
          );
          return { status: 500, body: { error: 'Failed to load pending action' } };
        }
      },
    },

    // ── Approve & execute ──────────────────────────────────────────
    {
      method: 'POST',
      path: '/api/v1/ai/pending-actions/:id/approve',
      description: 'Approve a pending action and execute it immediately',
      auth: true,
      permissions: ['ai:approve'],
      handler: async (req) => {
        if (!supported) return notImpl();
        const id = req.params?.id;
        if (!id) return { status: 400, body: { error: 'id is required' } };
        const actorId = req.user?.id ?? 'system';
        try {
          const outcome = await aiService.approvePendingAction!(id, actorId);
          // outcome.status is 'executed' on success, 'failed' on dispatch error
          const httpStatus = outcome.status === 'executed' ? 200 : 500;
          return { status: httpStatus, body: outcome };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error('[AI Route] /pending-actions/:id/approve error', err instanceof Error ? err : undefined);
          // 409 = state conflict (already approved/rejected/etc.); 404 = missing
          if (/not found/i.test(msg)) return { status: 404, body: { error: msg } };
          if (/already|not pending|no dispatcher/i.test(msg)) {
            return { status: 409, body: { error: msg } };
          }
          return { status: 500, body: { error: msg } };
        }
      },
    },

    // ── Reject ─────────────────────────────────────────────────────
    {
      method: 'POST',
      path: '/api/v1/ai/pending-actions/:id/reject',
      description: 'Reject a pending action (will not be executed)',
      auth: true,
      permissions: ['ai:approve'],
      handler: async (req) => {
        if (!supported) return notImpl();
        const id = req.params?.id;
        if (!id) return { status: 400, body: { error: 'id is required' } };
        const actorId = req.user?.id ?? 'system';
        const body = (req.body ?? {}) as Record<string, unknown>;
        const reason = typeof body.reason === 'string' ? body.reason : undefined;
        try {
          await aiService.rejectPendingAction!(id, actorId, reason);
          return { status: 200, body: { status: 'rejected', id } };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error('[AI Route] /pending-actions/:id/reject error', err instanceof Error ? err : undefined);
          if (/not found/i.test(msg)) return { status: 404, body: { error: msg } };
          if (/already|not pending/i.test(msg)) {
            return { status: 409, body: { error: msg } };
          }
          return { status: 500, body: { error: msg } };
        }
      },
    },
  ];
}
