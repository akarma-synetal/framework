---
'@objectstack/metadata-core': minor
---

Add `LayeredRepository` — composes N `MetadataRepository`s into a
read-through stack. Reads walk top-to-bottom; writes route to the
topmost writable layer; `list()` deduplicates by `refKey` preferring
the top; `history()` and `watch()` merge events from all layers,
tagging each event's `source` with `<layer>:<original-source>`. The
multiplexed `watch()` correctly cancels all child iterators when the
consumer calls `return()`.

Enables the canonical "system built-ins under user overlay" pattern
described in ADR-0008.

See ADR-0008 §10 PR-5.
