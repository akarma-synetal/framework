---
"@objectstack/plugin-auth": minor
---

WebContainer (StackBlitz) signup compatibility: `AuthManager` now auto-detects
WebContainer runtimes at construction time and swaps better-auth's default
`node:crypto.scrypt`-based password hasher for the pure-JS hasher from
`@better-auth/utils/password` (which uses `@noble/hashes/scrypt` under the
hood).

**Why:** WebContainer's `node:crypto` polyfill ships an incomplete `scrypt`
implementation that throws `TypeError: y.run is not a function` on every
signup, blocking template demos on StackBlitz. The pure-JS implementation is
byte-compatible with the Node hasher (same scrypt params, same `salt:keyHex`
storage format), so accounts created under either hasher remain mutually
verifiable — no migration, no template changes.

**Scope:** detection short-circuits to `undefined` on real Node, so production
deployments are completely unaffected — the JS fallback module is only
dynamically imported when one of `process.versions.webcontainer`,
`SHELL` containing `jsh`, or `STACKBLITZ` env is present.

Templates (`@template/todo`, `@template/contracts`, …) require no changes;
the fix lives entirely inside `@objectstack/plugin-auth`.
