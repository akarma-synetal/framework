---
'@objectstack/service-ai': minor
'@objectstack/spec': minor
---

feat(ai): v1 AI capabilities — ModelRegistry, structured output, tracing, schema retrieval, and `query_data` tool

This release lights up the first concrete capabilities on the slimmed AI protocol. All additions are
non-breaking — new contract methods are optional and existing callers keep working unchanged.

### What's new

- **ModelRegistry** (`@objectstack/service-ai`): in-memory runtime registry for `AI.ModelConfig`.
  Wire models via `AIServicePluginOptions.models` / `defaultModelId`. Exposes `get`, `getOrThrow`,
  `getDefault`, `list`, and `estimateCost(modelId, usage)` for ex-post token cost computation.

- **ai_traces object + auto-tracing**: every LLM call from `AIService` (`chat`, `complete`,
  `streamChat`, `chatWithTools`, `generateObject`, `embed`) is now instrumented with latency,
  token usage, status, and (when pricing is registered) cost. The default `ObjectQLTraceRecorder`
  is auto-wired when the runtime exposes an `IDataEngine`, persisting rows to the new `ai_traces`
  object. Drop in a custom `TraceRecorder` via `AIServicePluginOptions.traceRecorder`, or pass
  `NullTraceRecorder` to opt out.

- **Structured output (`IAIService.generateObject`)**: new optional method on `IAIService` and
  `LLMAdapter` that returns a parsed, schema-validated object instead of free-form text.
  Implemented end-to-end in `VercelLLMAdapter` (uses the AI SDK's `generateObject` — provider
  strict-mode is automatic when supported). Throws a clear error if the wired adapter doesn't
  implement it.

- **SchemaRetriever**: lightweight keyword-based retriever over `IMetadataService.listObjects()`.
  Scores by object name (×3), label/plural (×2), description (×1), field name (×2), and field
  label (×1) with English stop-word filtering. `SchemaRetriever.renderSnippet()` produces a
  Markdown block ready to inject into a system prompt — no embeddings, no extra infra.

- **`query_data` tool**: auto-registered when AI + Metadata + Data engine are all present. Takes
  a natural-language `request`, retrieves relevant schemas, asks the model for a structured
  `QueryPlan` via `generateObject`, validates the plan targets a real object, and executes it
  through `IDataEngine.find`. Returns `{ plan, count, records }`. The composed primitive that
  closes the loop from "ask in English" → "validated SQL-shaped result".

### Hardening

- Strict tool schemas: nested `orderBy` and `aggregations` items in `data-tools` now declare
  `additionalProperties: false` + `required`, matching the top-level contract and making them
  safe for provider strict mode.

### Notes

- `zod` is now a direct dependency of `@objectstack/service-ai` (previously transitive via `ai`)
  because contract signatures and the new tool definition use `z.ZodType` types directly.
- All new methods on `IAIService` / `LLMAdapter` are optional — existing custom adapters and
  callers continue to work without changes.
- 12 new unit tests cover `ModelRegistry` (cost math, defaults, throwing lookups) and
  `SchemaRetriever` (scoring, limits, snippet rendering). Full suite: 323/323 ✓.
