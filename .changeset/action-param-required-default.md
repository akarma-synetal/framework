---
'@objectstack/spec': patch
---

`ActionParamSchema.required` now defaults to `false` (was effectively `undefined`). Functionally equivalent for existing consumers (which check truthiness), but makes the parsed object shape complete and unblocks downstream type narrowing. Fixes pre-existing failing test `action.test.ts > should accept minimal action parameter`.
