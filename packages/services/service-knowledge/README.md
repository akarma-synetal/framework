# @objectstack/service-knowledge

Orchestrator implementing `IKnowledgeService` over pluggable
`IKnowledgeAdapter` backends. Ships zero RAG infrastructure of its own
— that's the job of adapter plugins (`knowledge-memory`,
`knowledge-ragflow`, …).

See [`content/docs/protocol/knowledge.mdx`](../../../content/docs/protocol/knowledge.mdx).

## License

BUSL-1.1 with a four-year conversion to Apache-2.0. See
[LICENSING.md](../../../LICENSING.md).
