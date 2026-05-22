---
'@objectstack/metadata-core': minor
---

Add `InMemoryRepository` (reference implementation) and a parameterised
Repository contract test suite. The contract suite, exposed at
`@objectstack/metadata-core/testing`, verifies the seven invariants every
backend must satisfy (atomic put, monotonic seq per branch, optimistic
locking, canonical hashing, event ordering, watch resumability,
tombstones).

Includes implementation-specific tests covering the injected clock,
canonical-hash insertion-order independence, and deep-copy isolation
between caller and store.

See ADR-0008 §10 PR-2.
