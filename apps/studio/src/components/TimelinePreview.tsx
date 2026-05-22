// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * TimelinePreview — minimal chronological list renderer for view specs of
 * `type: 'timeline'`. No `@object-ui` timeline plugin exists yet; rather
 * than fall through to the JSON inspector, this Studio-local component
 * fetches records via the shared DataSource and renders them as a vertical
 * timeline grouped by date.
 *
 * Supported spec keys (mirrors the kanban/calendar transforms in
 * MetadataPreview):
 *   timeline.{ startDateField, endDateField, titleField, groupByField,
 *              colorField, scale }
 *   filter
 *
 * Anything advanced (zoom, drag-to-reschedule, swimlanes) is out of scope.
 * Designed as a "good enough so authors can sanity-check their spec" view.
 */

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface TimelinePreviewProps {
  objectName: string;
  spec: any;
  dataSource: any;
  className?: string;
}

interface Row {
  id: string;
  title: string;
  start?: Date;
  end?: Date;
  group?: string;
  color?: string;
  raw: Record<string, any>;
}

const COLOR_CLASS: Record<string, string> = {
  new: 'bg-blue-500',
  in_progress: 'bg-amber-500',
  open: 'bg-amber-500',
  pending: 'bg-amber-500',
  waiting_on_customer: 'bg-violet-500',
  escalated: 'bg-rose-500',
  resolved: 'bg-emerald-500',
  closed: 'bg-zinc-400',
  high: 'bg-rose-500',
  urgent: 'bg-rose-600',
  medium: 'bg-amber-500',
  low: 'bg-blue-500',
};

const colorClass = (v: unknown) => {
  if (!v) return 'bg-zinc-400';
  const key = String(v).toLowerCase().replace(/[\s-]/g, '_');
  return COLOR_CLASS[key] ?? 'bg-indigo-500';
};

const toDate = (v: unknown): Date | undefined => {
  if (!v) return undefined;
  if (v instanceof Date) return v;
  const d = new Date(String(v));
  return Number.isFinite(d.getTime()) ? d : undefined;
};

const formatDate = (d: Date | undefined) => {
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatDateTime = (d: Date | undefined) => {
  if (!d) return '';
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
};

export function TimelinePreview({ objectName, spec, dataSource, className }: TimelinePreviewProps) {
  const cfg = spec?.timeline ?? {};
  const startField: string | undefined =
    cfg.startDateField ?? cfg.startField ?? spec?.startDateField ?? spec?.startField;
  const endField: string | undefined =
    cfg.endDateField ?? cfg.endField ?? spec?.endDateField;
  const titleField: string =
    cfg.titleField ?? spec?.titleField ?? 'name';
  const groupByField: string | undefined =
    cfg.groupByField ?? cfg.groupBy ?? spec?.groupBy;
  const colorField: string | undefined =
    cfg.colorField ?? spec?.colorField;

  const filter = spec?.filter;

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataSource || typeof dataSource.find !== 'function' || !objectName) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const select = Array.from(new Set([
          'id', titleField,
          ...(startField ? [startField] : []),
          ...(endField ? [endField] : []),
          ...(groupByField ? [groupByField] : []),
          ...(colorField ? [colorField] : []),
        ]));
        const query: Record<string, unknown> = {
          options: { $top: 100, $select: select },
        };
        if (filter) (query as any).$filter = filter;
        if (startField) (query as any).$orderby = [`-${startField}`];
        const res = await dataSource.find(objectName, query);
        if (cancelled) return;
        const records: any[] = Array.isArray(res?.data) ? res.data
          : Array.isArray(res?.records) ? res.records
          : Array.isArray(res) ? res : [];
        const next: Row[] = records.map((r, i) => ({
          id: String(r?.id ?? r?._id ?? i),
          title: String(r?.[titleField] ?? r?.name ?? r?.id ?? '(untitled)'),
          start: startField ? toDate(r?.[startField]) : undefined,
          end: endField ? toDate(r?.[endField]) : undefined,
          group: groupByField ? (r?.[groupByField] != null ? String(r[groupByField]) : undefined) : undefined,
          color: colorField ? r?.[colorField] : undefined,
          raw: r,
        }));
        setRows(next);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [dataSource, objectName, titleField, startField, endField, groupByField, colorField, JSON.stringify(filter)]);

  // Group rows by date bucket (yyyy-mm-dd) for visual scanning.
  const grouped = useMemo(() => {
    const buckets = new Map<string, Row[]>();
    for (const r of rows) {
      const key = r.start ? r.start.toISOString().slice(0, 10) : '__no-date__';
      const list = buckets.get(key) ?? [];
      list.push(r);
      buckets.set(key, list);
    }
    return Array.from(buckets.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  if (!startField) {
    return (
      <div className={`p-6 text-sm text-muted-foreground ${className ?? ''}`}>
        Timeline preview requires <code className="font-mono">timeline.startDateField</code> on the view spec.
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground ${className ?? ''}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading timeline…
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 text-sm text-rose-600 ${className ?? ''}`}>
        Failed to load timeline: {error}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={`p-12 text-center text-sm text-muted-foreground ${className ?? ''}`}>
        No records to show on the timeline.
      </div>
    );
  }

  return (
    <div className={`relative overflow-auto p-6 ${className ?? ''}`}>
      <div className="relative ml-3 border-l border-zinc-200 pl-6 dark:border-zinc-800">
        {grouped.map(([dateKey, items]) => {
          const headerDate = items[0]?.start;
          return (
            <div key={dateKey} className="mb-6">
              <div className="mb-3 sticky top-0 z-10 -ml-9 inline-flex rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                {dateKey === '__no-date__' ? 'No date' : formatDate(headerDate)}
              </div>
              <ul className="space-y-3">
                {items.map((r) => (
                  <li key={r.id} className="relative">
                    <span
                      className={`absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-white shadow ${colorClass(r.color)} dark:border-zinc-950`}
                      title={r.color ? String(r.color) : undefined}
                    />
                    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{r.title}</div>
                        {r.group ? (
                          <span className="text-[11px] uppercase tracking-wide text-zinc-500">{r.group}</span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500">
                        {formatDateTime(r.start)}
                        {r.end ? ` → ${formatDateTime(r.end)}` : ''}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
