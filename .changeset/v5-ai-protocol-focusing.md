---
"@objectstack/spec": major
---

# v1 AI Protocol focusing — remove application-template schemas

The `@objectstack/spec/ai` protocol is reduced to **only the primitives
the runtime directly consumes**. Eight schemas that described
application templates or product features (not platform contracts) are
removed; three more are slimmed to their primitive cores.

## Removed (8 files, ~4,700 lines)

| File | Reason for removal |
|---|---|
| `ai/devops-agent.zod.ts` | A specific Agent template, not a primitive. Compose with `Agent + Skill + Tool`. |
| `ai/plugin-development.zod.ts` | Specific workflow; same reasoning. |
| `ai/runtime-ops.zod.ts` | AIOps is a vertical product, not a backend platform concern. |
| `ai/predictive.zod.ts` | ML pipeline product (DataRobot/H2O space), orthogonal to metadata-driven backend. |
| `ai/agent-action.zod.ts` | 100% conceptual overlap with `tool` + `flow`. |
| `ai/orchestration.zod.ts` | Multi-agent plans can be expressed as agents-as-tools. Premature. |
| `ai/nlq.zod.ts` | NLQ is LLM-native capability + a `query_data` tool over ObjectQL, not a protocol. |
| `ai/feedback-loop.zod.ts` | RLHF / training-side concern; not platform-owned. |

## Slimmed (3 files)

- **`ai/rag-pipeline.zod.ts` → `ai/embedding.zod.ts`** (318 → 80 lines).
  Keeps `EmbeddingModelSchema` + `VectorStoreSchema` primitives.
  Removed: chunking strategies, retrieval pipelines, rerankers,
  document loaders, end-to-end RAG pipeline DSL. The `ragPipelines`
  field on `defineStack()` is removed.
- **`ai/cost.zod.ts` → `ai/usage.zod.ts`** (431 → ~70 lines).
  Keeps `TokenUsageSchema` + `AIUsageRecordSchema`. Model pricing is
  the canonical `ModelPricingSchema` already exported from
  `ai/model-registry.zod.ts`. Removed: budget definitions,
  enforcement, alerts, allocation reports, optimization
  recommendations.
- **`ai/mcp.zod.ts`** (629 → ~100 lines). Defines only how to
  *reference* an external MCP server and *bind* its tools to an
  agent. The MCP protocol itself is owned by Anthropic's published
  spec and the `@modelcontextprotocol/sdk`; we no longer re-declare
  transport/capability/resource/prompt/streaming/sampling shapes.

## Migration

No production code in this repository depended on the removed
schemas. Downstream consumers that imported any of the removed types
from `@objectstack/spec/ai` must:

1. **Remove the import.** The platform no longer provides these types.
2. **Define your own application-level shape** in your project / plugin
   if you still need the concept. The primitives (`Agent`, `Skill`,
   `Tool`, `Conversation`, `Embedding`, `Usage`, `MCP{ServerRef,ToolBinding}`)
   are sufficient to express every removed schema.
3. For RAG: replace `RAGPipelineConfig` with your own pipeline
   description built on `EmbeddingModelSchema` + `VectorStoreSchema`.
4. For cost: replace budget enforcement with your own service built
   on `AIUsageRecordSchema` records.

## Why

The platform's job is to define **primitives that any AI feature can
be built on top of**, leveraging the metadata-driven nature of
ObjectStack. The removed schemas described specific product features
(DevOps agent, AIOps, RAG pipeline DSL, budget enforcement) that
should live in plugins or applications — not in the canonical
protocol. Shipping a 6,245-line AI protocol where 80% of it has no
runtime implementation creates false promises to integrators.

After this change the AI protocol is:

```
ai/
├── agent.zod.ts          ← who
├── skill.zod.ts          ← when
├── tool.zod.ts           ← what
├── conversation.zod.ts   ← what to remember
├── model-registry.zod.ts ← which LLMs
├── embedding.zod.ts      ← embedding + vector store primitives
├── usage.zod.ts          ← token + cost accounting
└── mcp.zod.ts            ← external ecosystem bridge
```

8 files, ~1,200 lines. Every schema has a runtime implementation in
`@objectstack/service-ai` or `@objectstack/plugin-mcp-server`.
