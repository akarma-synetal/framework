// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { applyInMemoryAggregation, bucketDateValue } from './in-memory-aggregation.js';

const rows = [
  { region: 'East', closed_at: '2024-01-15', amount: 100, owner: 'alice' },
  { region: 'East', closed_at: '2024-02-10', amount: 200, owner: 'alice' },
  { region: 'East', closed_at: '2024-04-05', amount: 150, owner: 'bob' },
  { region: 'West', closed_at: '2024-01-20', amount: 300, owner: 'alice' },
  { region: 'West', closed_at: '2024-04-30', amount: null,  owner: 'carol' },
];

describe('applyInMemoryAggregation', () => {
  it('returns rows unchanged when no groupBy nor aggregations', () => {
    expect(applyInMemoryAggregation(rows, {})).toBe(rows);
  });

  it('aggregates without groupBy → single row', () => {
    const out = applyInMemoryAggregation(rows, {
      aggregations: [
        { function: 'count', alias: 'cnt' },
        { function: 'sum', field: 'amount', alias: 'total' },
        { function: 'avg', field: 'amount', alias: 'avg_amount' },
      ],
    });
    expect(out).toEqual([
      { cnt: 5, total: 750, avg_amount: 750 / 4 }, // null excluded from avg
    ]);
  });

  it('groups by a flat string field', () => {
    const out = applyInMemoryAggregation(rows, {
      groupBy: ['region'],
      aggregations: [{ function: 'sum', field: 'amount', alias: 'total' }],
    });
    const east = out.find((r) => r.region === 'East');
    const west = out.find((r) => r.region === 'West');
    expect(east!.total).toBe(450);
    expect(west!.total).toBe(300);
  });

  it('groups by a structured groupBy with dateGranularity (quarter)', () => {
    const out = applyInMemoryAggregation(rows, {
      groupBy: [{ field: 'closed_at', dateGranularity: 'quarter', alias: 'qtr' }],
      aggregations: [{ function: 'sum', field: 'amount', alias: 'total' }],
    });
    const q1 = out.find((r) => r.qtr === '2024-Q1');
    const q2 = out.find((r) => r.qtr === '2024-Q2');
    expect(q1!.total).toBe(600); // 100+200+300
    expect(q2!.total).toBe(150); // 150 (null excluded by toNumber)
  });

  it('combines region + quarter (multi-dimensional groupBy)', () => {
    const out = applyInMemoryAggregation(rows, {
      groupBy: ['region', { field: 'closed_at', dateGranularity: 'quarter' }],
      aggregations: [{ function: 'count', alias: 'n' }],
    });
    expect(out.length).toBe(4); // East/Q1, East/Q2, West/Q1, West/Q2
    const eastQ1 = out.find((r) => r.region === 'East' && r.closed_at === '2024-Q1');
    expect(eastQ1!.n).toBe(2);
  });

  it('honours count_distinct + array_agg + string_agg', () => {
    const out = applyInMemoryAggregation(rows, {
      groupBy: ['region'],
      aggregations: [
        { function: 'count_distinct', field: 'owner', alias: 'owners' },
        { function: 'array_agg', field: 'owner', alias: 'owner_list' },
        { function: 'string_agg', field: 'owner', alias: 'owner_str' },
      ],
    });
    const east = out.find((r) => r.region === 'East');
    expect(east!.owners).toBe(2);
    expect(east!.owner_list).toEqual(['alice', 'alice', 'bob']);
    expect(east!.owner_str).toBe('alice,alice,bob');
  });

  it('treats null group values as the literal (null) bucket', () => {
    const dataset = [{ stage: null, amount: 10 }, { stage: 'won', amount: 5 }];
    const out = applyInMemoryAggregation(dataset, {
      groupBy: ['stage'],
      aggregations: [{ function: 'sum', field: 'amount', alias: 'total' }],
    });
    expect(out.find((r) => r.stage === '(null)')!.total).toBe(10);
  });
});

describe('bucketDateValue', () => {
  it('truncates to year/quarter/month/day', () => {
    expect(bucketDateValue('2024-05-15', 'year')).toBe('2024');
    expect(bucketDateValue('2024-05-15', 'quarter')).toBe('2024-Q2');
    expect(bucketDateValue('2024-05-15', 'month')).toBe('2024-05');
    expect(bucketDateValue('2024-05-15', 'day')).toBe('2024-05-15');
  });

  it('produces ISO week labels (week starts Monday)', () => {
    // 2024-01-01 is a Monday → ISO week 1
    expect(bucketDateValue('2024-01-01', 'week')).toBe('2024-W01');
    // 2024-12-30 (Mon) → ISO week 1 of 2025
    expect(bucketDateValue('2024-12-30', 'week')).toBe('2025-W01');
  });

  it('returns (null) for null / invalid dates', () => {
    expect(bucketDateValue(null, 'month')).toBe('(null)');
    expect(bucketDateValue('not-a-date', 'month')).toBe('(null)');
  });
});
