---
"@objectstack/studio": patch
"@objectstack/client": patch
---

Studio developer UX overhaul.

- **Inspector drawer** (right Sheet, toggle via header button or `]`) with API / Source / Refs tabs that auto-populate from the current resource detail page.
- **Problems panel** (status bar pill + `[`) that subscribes to object/view/flow/hook changes and surfaces unknown object refs, missing field refs, and broken triggers with deep-links back to source.
- **Keyboard shortcuts**: `g o|f|v|a|s|p` navigation, `[` problems, `]` inspector, `?` help dialog.
- **Resource actions menu** (`⋯` on detail page header): Copy as curl / fetch() / `defineX()` TypeScript / Metadata JSON; Open in VS Code; Open API endpoint.
- **Welcome onboarding** empty-state in the developer overview when a package has no metadata.
- New `StudioShell` wrapper; `TopBar` gains a `rightSlot` prop for Inspector / Help buttons.

`@objectstack/client`: surface plain-string `error` bodies (e.g. `RECORD_LOCKED: …`) in fetch error messages instead of swallowing them as `Bad Request`.
