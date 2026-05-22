---
'@objectstack/spec': minor
---

Add `_sections` to `ObjectTranslationData` so per-section labels on detail
pages can be authored alongside `_views` and `_actions`. Convention:
`objects.<object>._sections.<section_name>.label`. Consumed by
`@object-ui/plugin-detail` when sections declare a stable `name`.
