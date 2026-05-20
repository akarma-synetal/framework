---
'@objectstack/spec': minor
---

`record:highlights` now accepts richer field items.

Each entry in `fields` may be either a bare field name (backward compatible) or an object `{ name, label?, icon?, type? }` that lets the schema override the displayed label, attach a Lucide icon, or force a specific cell renderer without editing the underlying object metadata. Useful when the same field appears in multiple highlight strips with different framing (e.g. "Annual Revenue" vs "ARR") or when you want a tiny icon for status-like fields.
