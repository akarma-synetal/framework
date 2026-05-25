---
"@objectstack/spec": minor
---

Add `compareTo` field to `DashboardWidgetSchema` and `variant` / `dashArray` /
`opacity` to `ChartSeriesSchema` so renderers can express period-over-period
overlays on metric / gauge / chart widgets.

`compareTo` accepts `'previousPeriod'`, `'previousYear'`, or
`{ offset: '7d' | '4w' | '1M' | '1y' }`. The renderer issues a second query
against the shifted filter and either (a) derives a trend delta for KPI
widgets or (b) overlays a muted comparison series on cartesian charts.
