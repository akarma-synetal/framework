---
"@objectstack/console": minor
---

Console (objectui) refreshed to `4a4829d0ef39`. Frontend changes in this range:

- fix(fields): emit the spec's `$notContains`, and keep `secret` out of inline edit (#2901) (#2940)
- fix(detail): distinguish "in approval (editable)" from locked, and stop losing write warnings (#2914)
- fix(types): zod example teaches the Zod 4 `.issues` accessor, and `examples/` is type-checked (#2919) (#2939)
- fix(plugin-grid,plugin-form,cli,+2): type-check the last five unchecked packages, and fix the two runtime bugs hiding there (#2919) (#2936)
- fix(views): ListView reads the spec-canonical `filter` (#2890) (#2935)
- fix(console,runner): render the approvals inbox against one ticking clock, and lint both packages (#2927) (#2930)
- feat(lint): run ESLint on PRs, and cover every package (#2923) (#2928)
- feat(setup): the datasource list shows the real connect verdict, with the operator-facing reason (framework#3827) (#2926)
- fix(fields,core,detail): make the sharing-rule dialog usable — i18n, a picker that lists people, and permission-aware CTAs (#2920)
- fix(detail): the approval band honors the node's `lockRecord` instead of assuming every approval locks (#2902) (#2906)
- fix(console): the API console lists the whole AI family, and the tool preview stops linking to a 404 (framework#3718) (#2925)
- fix(runner): type-check the package at all, fix the hidden DataSource violation (#2917) (#2922)
- fix(console): the API console's AI group lists the routes that exist (framework#3718) (#2921)
- fix(plugin-map): drop the `maplibre-gl@6` default import + gate type-check in CI (#2911) (#2915)
- fix(i18n): compose the AI-model diagnostics summary client-side (#2886) (#2912)
- fix(flow-designer): read approver value sources off the schema instead of mirroring them (framework#3508 follow-up) (#2910)
- feat(i18n): complete the locale backfill — all ten packs reach full key parity (#2872) (#2909)
- fix(list): show real match total in record-count bar under server pagination (#2873)
- fix(i18n): the change card's Confirm button sent text the cloud gate rejects, + parity ratchet (#2905)
- feat(i18n): translate the four highest-traffic namespaces into the eight trailing locales (#2872 part a) (#2903)

objectui range: `1bb77aa24514...4a4829d0ef39`
