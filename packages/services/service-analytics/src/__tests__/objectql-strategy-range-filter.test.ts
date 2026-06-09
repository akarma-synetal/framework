// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// Regression (ADR-0021 Phase 2): a dataset runtimeFilter that carries a RANGE
// on one field (`{ close_date: { $gte, $lte } }`) must reach the ObjectQL
// aggregate path with BOTH bounds. Previously the strategy built its filter via
// `filter[field] = convertFilter(...)` in a loop, so the second operator
// overwrote the first and a range silently lost a bound — producing wrong
// numbers vs the legacy inline-query path. Surfaced by the reconciliation gate.

import { describe, it, expect } from 'vitest';
import { DatasetSchema } from '@objectstack/spec/ui';
import { AnalyticsService } from '../analytics-service.js';

const dataset = DatasetSchema.parse({
  name: 'pipeline',
  label: 'Pipeline',
  object: 'opportunity',
  dimensions: [
    { name: 'stage', field: 'stage', type: 'string' },
    { name: 'close_date', field: 'close_date', type: 'date' },
  ],
  measures: [{ name: 'opp_count', aggregate: 'count' }],
});

describe('ObjectQLStrategy range runtimeFilter (regression)', () => {
  it('passes BOTH bounds of a $gte/$lte range to engine.aggregate', async () => {
    const captured: Array<{ filter?: Record<string, unknown> }> = [];
    const svc = new AnalyticsService({
      queryCapabilities: () => ({ nativeSql: false, objectqlAggregate: true, inMemory: false }),
      executeAggregate: async (_object, options) => {
        captured.push({ filter: options.filter });
        return [{ stage: 'qualification', opp_count: 1 }];
      },
    });

    await svc.queryDataset!(dataset, {
      dimensions: ['stage'],
      measures: ['opp_count'],
      runtimeFilter: { close_date: { $gte: 1_774_983_600_000, $lte: 1_782_759_600_000 } },
    });

    expect(captured).toHaveLength(1);
    expect(captured[0].filter?.close_date).toEqual({ $gte: 1_774_983_600_000, $lte: 1_782_759_600_000 });
  });
});

describe('ObjectQLStrategy timeDimension granularity (regression)', () => {
  it('lowers a timeDimension granularity to a structured {field, dateGranularity} groupBy', async () => {
    const captured: Array<{ groupBy?: unknown[] }> = [];
    const svc = new AnalyticsService({
      queryCapabilities: () => ({ nativeSql: false, objectqlAggregate: true, inMemory: false }),
      executeAggregate: async (_object, options) => {
        captured.push({ groupBy: options.groupBy as unknown[] });
        return [{ close_date: '2026-06', opp_count: 1 }];
      },
    });

    await svc.queryDataset!(dataset, {
      dimensions: ['close_date'],
      measures: ['opp_count'],
      timeDimensions: [{ dimension: 'close_date', granularity: 'month' }],
    });

    expect(captured).toHaveLength(1);
    // The date dimension buckets by month instead of grouping raw timestamps.
    expect(captured[0].groupBy).toEqual([{ field: 'close_date', dateGranularity: 'month' }]);
  });
});
