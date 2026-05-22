---
"@objectstack/objectql": patch
---

test(objectql): integration coverage for `LayeredRepository` composed of
`SysMetadataRepository` (top, writable overlay) over `InMemoryRepository`
(bottom, artifact baseline). Verifies read fallthrough, overlay-wins
precedence, write routing, delete behavior, event source tagging across
layers, and merged-list semantics. Part of ADR-0008 PR-10c.
