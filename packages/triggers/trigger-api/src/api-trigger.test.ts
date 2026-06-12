// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createHmac } from 'node:crypto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiTrigger, verifySignature } from './api-trigger.js';
import type { QueueServiceSurface } from './api-trigger.js';

/** In-memory queue: publish stores, deliver() drains to subscribers. */
function makeFakeQueue() {
    const subs = new Map<string, (m: { data: any }) => Promise<void> | void>();
    const pending = new Map<string, any[]>();
    let n = 0;
    const q: QueueServiceSurface & { deliver(): Promise<number>; published: Array<{ queue: string; data: any; idempotencyKey?: string }> } = {
        published: [],
        async publish(queue, data, options) {
            this.published.push({ queue, data, idempotencyKey: options?.idempotencyKey });
            (pending.get(queue) ?? pending.set(queue, []).get(queue)!).push(data);
            return `msg_${++n}`;
        },
        async subscribe(queue, handler) { subs.set(queue, handler as any); },
        async unsubscribe(queue) { subs.delete(queue); },
        async deliver() {
            let delivered = 0;
            for (const [queue, items] of pending) {
                const handler = subs.get(queue);
                if (!handler) continue;
                for (const data of items.splice(0)) { await handler({ data }); delivered++; }
            }
            return delivered;
        },
    };
    return q;
}

const logger = { info: vi.fn(), warn: vi.fn() };

function sig(secret: string, body: string): string {
    return 'sha256=' + createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

describe('ApiTrigger', () => {
    let queue: ReturnType<typeof makeFakeQueue>;
    let trigger: ApiTrigger;
    let runs: any[];

    beforeEach(() => {
        queue = makeFakeQueue();
        trigger = new ApiTrigger(() => queue, logger as any);
        runs = [];
        vi.clearAllMocks();
    });

    function arm(config: Record<string, unknown> = {}) {
        trigger.start({ flowName: 'lead_intake', config }, async (ctx) => { runs.push(ctx); });
    }

    it('verifySignature accepts a correct GitHub-style signature and rejects others', () => {
        const body = '{"a":1}';
        expect(verifySignature('s3cret', body, sig('s3cret', body))).toBe(true);
        expect(verifySignature('s3cret', body, sig('wrong', body))).toBe(false);
        expect(verifySignature('s3cret', body, undefined)).toBe(false);
        expect(verifySignature('s3cret', body, 'sha256=zz')).toBe(false);
    });

    it('202-enqueues a valid post and the consumer runs the flow with the payload as record', async () => {
        arm({ hookId: 'hk1', secret: 's3cret' });
        const body = JSON.stringify({ title: 'New lead', amount: 5000 });
        const res = await trigger.handleRequest({
            flowName: 'lead_intake', hookId: 'hk1', rawBody: body, signatureHeader: sig('s3cret', body),
        });
        expect(res.status).toBe(202);
        expect(res.body.accepted).toBe(true);
        expect(runs).toHaveLength(0); // never executed in-band
        expect(await queue.deliver()).toBe(1);
        expect(runs).toHaveLength(1);
        expect(runs[0].record).toEqual({ title: 'New lead', amount: 5000 });
        expect(runs[0].params).toEqual({ title: 'New lead', amount: 5000 });
    });

    it('answers 404 identically for unknown flows and wrong hookIds (no probing oracle)', async () => {
        arm({ hookId: 'hk1' });
        const a = await trigger.handleRequest({ flowName: 'nope', hookId: 'hk1', rawBody: '{}' });
        const b = await trigger.handleRequest({ flowName: 'lead_intake', hookId: 'wrong', rawBody: '{}' });
        expect(a).toEqual(b);
        expect(a.status).toBe(404);
    });

    it('401s a missing or bad signature when the flow declares a secret', async () => {
        arm({ hookId: 'hk1', secret: 's3cret' });
        const body = '{"x":1}';
        expect((await trigger.handleRequest({ flowName: 'lead_intake', hookId: 'hk1', rawBody: body })).status).toBe(401);
        expect((await trigger.handleRequest({
            flowName: 'lead_intake', hookId: 'hk1', rawBody: body, signatureHeader: sig('other', body),
        })).status).toBe(401);
    });

    it('accepts unsigned posts when no secret is configured (and warned at arm time)', async () => {
        arm({});
        const res = await trigger.handleRequest({ flowName: 'lead_intake', hookId: 'default', rawBody: '{"x":1}' });
        expect(res.status).toBe(202);
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('WITHOUT a secret'));
    });

    it('400s non-object or invalid JSON bodies', async () => {
        arm({});
        expect((await trigger.handleRequest({ flowName: 'lead_intake', hookId: 'default', rawBody: 'not json' })).status).toBe(400);
        expect((await trigger.handleRequest({ flowName: 'lead_intake', hookId: 'default', rawBody: '[1,2]' })).status).toBe(400);
    });

    it('passes x-idempotency-key through to the queue dedup window', async () => {
        arm({});
        await trigger.handleRequest({
            flowName: 'lead_intake', hookId: 'default', rawBody: '{}', idempotencyKey: 'evt_42',
        });
        expect(queue.published[0].idempotencyKey).toBe('evt_42');
    });

    it('503s when no queue service is registered', async () => {
        const t = new ApiTrigger(() => null, logger as any);
        t.start({ flowName: 'f', config: {} }, async () => {});
        const res = await t.handleRequest({ flowName: 'f', hookId: 'default', rawBody: '{}' });
        expect(res.status).toBe(503);
    });

    it('stop() disarms the hook and unsubscribes the queue', async () => {
        arm({ hookId: 'hk1' });
        trigger.stop('lead_intake');
        const res = await trigger.handleRequest({ flowName: 'lead_intake', hookId: 'hk1', rawBody: '{}' });
        expect(res.status).toBe(404);
        expect(trigger.listHooks()).toHaveLength(0);
    });
});
