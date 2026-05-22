// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * DashboardPreview — minimal renderer for `dashboard` metadata. No
 * `@object-ui/plugin-dashboard` exists yet, so this Studio-local component
 * lays widgets out on a CSS grid (using `layout.{x,y,w,h}` from the spec)
 * and renders each widget's value(s) via small, type-specific previews:
 *
 *   metric           → aggregate via dataSource.aggregate (or count fallback)
 *   donut / pie / bar / column → grouped-by-category aggregate, rendered as
 *                      horizontal bars (legend included for donut/pie)
 *   table            → first N records via dataSource.find
 *   gauge / area     → metric-style summary with a `(no preview)` note
 *
 * The goal is "good enough so authors can sanity-check the spec and verify
 * data flows," not pixel-perfect dashboards.
 */

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface DashboardPreviewProps {
  spec: any;
  dataSource: any;
  className?: string;
}

interface WidgetState {
  loading: boolean;
  error?: string;
  /** scalar value for metric/gauge */
  value?: number | null;
  /** category buckets for donut/pie/bar */
  buckets?: { key: string; count: number }[];
  /** record rows for table */
  rows?: any[];
}

const BAR_COLORS = [
  'bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  'bg-violet-500', 'bg-teal-500', 'bg-orange-500', 'bg-indigo-500',
];

const formatNumber = (v: number | null | undefined, format?: string): string => {
  if (v == null || !Number.isFinite(v)) return '—';
  if (format === '0%') return `${(v * 100).toFixed(1)}%`;
  if (format === '0.0') return v.toFixed(1);
  return v.toLocaleString();
};

async function fetchAggregate(ds: any, w: any): Promise<number | null> {
  const filter = w.filter && Object.keys(w.filter).length ? w.filter : undefined;
  try {
    if (w.aggregate === 'count' || !w.valueField) {
      const res = await ds.find(w.object, {
        ...(filter ? { $filter: filter } : {}),
        options: { $top: 1, $count: true, $select: ['id'] },
      });
      if (typeof res?.totalCount === 'number') return res.totalCount;
      if (Array.isArray(res?.data)) return res.data.length;
      if (Array.isArray(res?.records)) return res.records.length;
      return null;
    }
    // Generic aggregate via find + client-side reduce (small samples).
    const res = await ds.find(w.object, {
      ...(filter ? { $filter: filter } : {}),
      options: { $top: 500, $select: ['id', w.valueField] },
    });
    const rows: any[] = Array.isArray(res?.data) ? res.data
      : Array.isArray(res?.records) ? res.records : [];
    const vals = rows
      .map((r) => Number(r?.[w.valueField]))
      .filter((n) => Number.isFinite(n));
    if (vals.length === 0) return null;
    switch (w.aggregate) {
      case 'sum': return vals.reduce((a, b) => a + b, 0);
      case 'avg': return vals.reduce((a, b) => a + b, 0) / vals.length;
      case 'min': return Math.min(...vals);
      case 'max': return Math.max(...vals);
      default: return vals.reduce((a, b) => a + b, 0);
    }
  } catch {
    return null;
  }
}

async function fetchBuckets(ds: any, w: any): Promise<{ key: string; count: number }[]> {
  const filter = w.filter && Object.keys(w.filter).length ? w.filter : undefined;
  const cat = w.categoryField;
  if (!cat) return [];
  const res = await ds.find(w.object, {
    ...(filter ? { $filter: filter } : {}),
    options: { $top: 500, $select: ['id', cat] },
  });
  const rows: any[] = Array.isArray(res?.data) ? res.data
    : Array.isArray(res?.records) ? res.records : [];
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = r?.[cat] == null ? '∅' : String(r[cat]);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

async function fetchRows(ds: any, w: any): Promise<any[]> {
  const filter = w.filter && Object.keys(w.filter).length ? w.filter : undefined;
  const cols: any[] = w.options?.columns ?? [];
  const select = ['id', ...cols.map((c) => c.accessorKey).filter(Boolean)];
  const limit = Number(w.options?.limit) || 10;
  try {
    const res = await ds.find(w.object, {
      ...(filter ? { $filter: filter } : {}),
      options: { $top: limit, $select: select },
    });
    return Array.isArray(res?.data) ? res.data
      : Array.isArray(res?.records) ? res.records
      : Array.isArray(res) ? res : [];
  } catch {
    return [];
  }
}

function WidgetCard({ widget, state }: { widget: any; state: WidgetState }) {
  const { title, description, type, options } = widget;
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-900">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</h3>
          <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
            {type}
          </span>
        </div>
        {description ? (
          <p className="mt-0.5 truncate text-xs text-zinc-500">{description}</p>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-4">
        {state.loading ? (
          <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            Loading…
          </div>
        ) : state.error ? (
          <div className="text-xs text-rose-600">{state.error}</div>
        ) : (type === 'metric' || type === 'gauge' || type === 'area') ? (
          <div className="flex flex-1 flex-col justify-center">
            <div className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {formatNumber(state.value, options?.format)}
              {options?.suffix ? <span className="ml-1 text-base text-zinc-500">{options.suffix}</span> : null}
            </div>
            {options?.trend ? (
              <div className={`mt-1 text-xs ${options.trend.direction === 'down' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {options.trend.direction === 'down' ? '↓' : '↑'} {options.trend.value}% {options.trend.label}
              </div>
            ) : null}
            {type === 'area' ? (
              <div className="mt-2 text-[11px] italic text-zinc-400">Sparkline preview not available</div>
            ) : null}
          </div>
        ) : (type === 'donut' || type === 'pie' || type === 'bar' || type === 'column') ? (
          <BarsChart buckets={state.buckets ?? []} />
        ) : type === 'table' ? (
          <MiniTable widget={widget} rows={state.rows ?? []} />
        ) : (
          <div className="text-xs text-zinc-500 italic">No preview for type "{type}"</div>
        )}
      </div>
    </div>
  );
}

function BarsChart({ buckets }: { buckets: { key: string; count: number }[] }) {
  const max = buckets.reduce((m, b) => Math.max(m, b.count), 0);
  if (max === 0) return <div className="text-xs text-muted-foreground">No data</div>;
  return (
    <ul className="space-y-1.5">
      {buckets.map((b, i) => (
        <li key={b.key} className="flex items-center gap-2 text-xs">
          <span className="w-24 shrink-0 truncate text-zinc-600 dark:text-zinc-400" title={b.key}>{b.key}</span>
          <div className="relative flex-1 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-900">
            <div
              className={`h-4 rounded ${BAR_COLORS[i % BAR_COLORS.length]}`}
              style={{ width: `${(b.count / max) * 100}%`, minWidth: '4px' }}
            />
          </div>
          <span className="w-10 shrink-0 text-right tabular-nums text-zinc-700 dark:text-zinc-300">{b.count}</span>
        </li>
      ))}
    </ul>
  );
}

function MiniTable({ widget, rows }: { widget: any; rows: any[] }) {
  const cols: any[] = widget.options?.columns ?? [];
  if (rows.length === 0) {
    return <div className="text-xs text-muted-foreground">No records</div>;
  }
  return (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            {cols.map((c) => (
              <th key={c.accessorKey} className="px-2 py-1 text-left font-medium text-zinc-700 dark:text-zinc-300">
                {c.header ?? c.accessorKey}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r?.id ?? i} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
              {cols.map((c) => (
                <td key={c.accessorKey} className="truncate px-2 py-1 text-zinc-800 dark:text-zinc-200">
                  {String(r?.[c.accessorKey] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardPreview({ spec, dataSource, className }: DashboardPreviewProps) {
  const widgets: any[] = useMemo(() => Array.isArray(spec?.widgets) ? spec.widgets : [], [spec]);
  const columns = Number(spec?.columns) || 12;
  const gap = Number(spec?.gap) || 4;

  const [states, setStates] = useState<Record<string, WidgetState>>({});

  useEffect(() => {
    if (!dataSource || typeof dataSource.find !== 'function') return;
    let cancelled = false;
    setStates(Object.fromEntries(widgets.map((w) => [w.id, { loading: true }])));
    (async () => {
      await Promise.all(widgets.map(async (w) => {
        try {
          let next: WidgetState = { loading: false };
          if (w.type === 'metric' || w.type === 'gauge' || w.type === 'area') {
            next.value = await fetchAggregate(dataSource, w);
          } else if (['donut', 'pie', 'bar', 'column'].includes(w.type)) {
            next.buckets = await fetchBuckets(dataSource, w);
          } else if (w.type === 'table') {
            next.rows = await fetchRows(dataSource, w);
          }
          if (cancelled) return;
          setStates((prev) => ({ ...prev, [w.id]: next }));
        } catch (e: any) {
          if (cancelled) return;
          setStates((prev) => ({ ...prev, [w.id]: { loading: false, error: e?.message ?? String(e) } }));
        }
      }));
    })();
    return () => { cancelled = true; };
  }, [dataSource, widgets]);

  if (widgets.length === 0) {
    return (
      <div className={`p-6 text-sm text-muted-foreground ${className ?? ''}`}>
        Dashboard has no widgets to preview.
      </div>
    );
  }

  return (
    <div className={`overflow-auto p-4 ${className ?? ''}`}>
      {spec?.header?.showTitle && spec?.label ? (
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{spec.label}</h2>
          {spec?.header?.showDescription && spec?.description ? (
            <p className="text-sm text-zinc-500">{spec.description}</p>
          ) : null}
        </div>
      ) : null}
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: `${gap * 4}px`,
          gridAutoRows: '60px',
        }}
      >
        {widgets.map((w) => {
          const lay = w.layout ?? {};
          const x = Number(lay.x) || 0;
          const y = Number(lay.y) || 0;
          const wWidth = Number(lay.w) || 3;
          const wHeight = Number(lay.h) || 2;
          return (
            <div
              key={w.id}
              style={{
                gridColumn: `${x + 1} / span ${wWidth}`,
                gridRow: `${y + 1} / span ${wHeight}`,
              }}
            >
              <WidgetCard widget={w} state={states[w.id] ?? { loading: true }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
