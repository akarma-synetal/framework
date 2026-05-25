---
'@objectstack/service-ai': patch
---

**HITL Phase 3 — end-to-end demos + bug fix in handler-engine adapter.**

Two runnable integration demos for the action-approval queue ship under `examples/app-todo/test/`:

- `ai-hitl.test.ts` — drives the tool registry directly (no LLM). Asserts `variant:'danger'` actions register as tools, invocation returns `pending_approval`, row persists, `approvePendingAction(id, actor)` re-runs the handler, row flips to `executed`. Reject path covered too. Run with `pnpm --filter @example/app-todo test:hitl`.
- `ai-hitl-llm.test.ts` — same scenario behind a real model on Vercel AI Gateway. The LLM autonomously picks `action_delete_completed`, the framework gates the call with `pending_approval`, the model summarises the wait without retrying, and the operator-side approve completes the deletion. Gated on `AI_GATEWAY_API_KEY`. Run with `AI_GATEWAY_API_KEY=... pnpm --filter @example/app-todo test:hitl:llm`.

While wiring the demos, two bugs surfaced in the bypass-approval dispatcher and the handler-engine adapter:

1. **Bulk delete from declarative handlers was silently failing.** The adapter built by `buildHandlerEngineAdapter()` wrapped multi-id deletes as `engine.delete(obj, { where: { id: { $in: ids } } })`, but `ObjectQLEngine.delete()` prefers the scalar `id` branch whenever `where.id` is set — so the `{ $in: [...] }` object was forwarded to `driver.delete(scalar)` and rejected as `"Wrong API use: tried to bind a value of an unknown type ([object Object])"`. The adapter now loops scalar deletes, which is correct and driver-agnostic.

2. **Approval pathway swallowed handler errors.** `createActionToolHandler` returns a `{ ok: false, error }` envelope on failure rather than throwing. The pre-registered bypass dispatcher just JSON-parsed and returned that envelope, so `approvePendingAction` thought the run succeeded and flipped the row to `executed`. The dispatcher now treats `ok === false` as a thrown error, so failed approvals are correctly persisted as `status: 'failed'` with the original message.

Also: added `delete`/`remove`/`purge`/`destroy`/`erase` to `MemoryLLMAdapter.ACTION_VERBS` so the in-memory adapter can route delete-style intents during tests that don't have a real LLM.

Docs: `content/docs/guides/ai-capabilities.mdx` now points at the two integration demos with copy-pasteable run commands.
