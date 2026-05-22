---
'@objectstack/studio': patch
---

Studio: timeline + dashboard preview renderers

Previously `view + timeline` and `dashboard` metadata fell through to the
"Unsupported" JSON inspector. They now render against the same live
DataSource as the rest of Studio:

- **TimelinePreview** — vertical chronological list grouped by date,
  honouring `timeline.{startDateField, endDateField, titleField,
  groupByField, colorField}`. Status-coloured dots, start→end ranges.
- **DashboardPreview** — CSS-grid layout (12-col by default, driven by
  `layout.{x,y,w,h}`) that renders each widget by type: `metric` /
  `gauge` / `area` as a big aggregate value; `donut` / `pie` / `bar` /
  `column` as horizontal bar charts of grouped buckets; `table` as a
  small data table fed by `dataSource.find`.

Both renderers are intentionally minimal — designed for "preview the
spec with real data," not pixel-perfect production rendering.
