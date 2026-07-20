---
"@objectstack/console": patch
---

Console (objectui) refreshed to `af1b0db96e44`. Frontend changes in this range:

- feat(i18n): localize action result dialogs via _actions.<action>.resultDialog (#2736)
- feat(data): thread the host's authenticated fetch into provider:'api' data sources (#2725) (#2732)
- feat(managedBy): add explicit `engine-owned` lifecycle bucket (tracks framework ADR-0103 addendum, #3343) (#2739)
- feat(fields): CheckboxesField visibleWhen cascading + dependsOn gating (completes option-widget parity) (#2735)
- feat(fields): RadioField visibleWhen cascading + dependsOn gating; single-source the option resolver (#2728)
- fix(kanban,calendar): surface write failures instead of silently swallowing them (#2716)
- fix(plugin-charts): draw dashboard bars on first paint via one settle re-mount (#2727)
- feat(dashboard): retire pre-ADR-0021 inline-analytics renderer branches (framework#3320) (#2723)
- fix(data-objectstack): type the exportDownload test fetch mock so its type-check passes (#2726)
- feat(detail): related lists paginate by default with server-side $top/$skip windows (#2711) (#2722)
- fix(approvals-inbox): align participant gating with the server-computed viewer block (#2719)
- fix(plugin-view): coerce i18n tab-label helpers to string (TS2322) (#2721)
- feat(fields): MultiSelectField per-option visibleWhen cascading + dependsOn gating (#2715) (#2717)
- fix(site): make docs build resilient to remote badge fetch failures (#2695) (#2718)
- feat(approvals-inbox): retire the approve/reject composer for declared actions with file attachments (#2698) (#2710)
- feat(fields): select+multiple → multi-value chip picker; restore fields/core lint gates (#2709)

objectui range: `3b2e4d98d904...af1b0db96e44`
