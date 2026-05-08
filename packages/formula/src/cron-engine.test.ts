import { describe, expect, it } from 'vitest';

import { cronEngine } from './cron-engine';

describe('cronEngine', () => {
  it('accepts standard 5-field cron', () => {
    const r = cronEngine.evaluate({ dialect: 'cron', source: '0 9 * * 1-5' }, {});
    expect(r.ok).toBe(true);
  });

  it('accepts 6-field cron', () => {
    const r = cronEngine.evaluate({ dialect: 'cron', source: '0 0 9 * * 1' }, {});
    expect(r.ok).toBe(true);
  });

  it('accepts aliases', () => {
    for (const alias of ['@daily', '@hourly', '@weekly', '@monthly', '@yearly']) {
      expect(cronEngine.evaluate({ dialect: 'cron', source: alias }, {}).ok).toBe(true);
    }
  });

  it('rejects empty source', () => {
    const r = cronEngine.evaluate({ dialect: 'cron', source: '   ' }, {});
    expect(r.ok).toBe(false);
  });

  it('rejects unknown alias', () => {
    const r = cronEngine.evaluate({ dialect: 'cron', source: '@whenever' }, {});
    expect(r.ok).toBe(false);
  });

  it('rejects wrong field count', () => {
    const r = cronEngine.evaluate({ dialect: 'cron', source: '* * *' }, {});
    expect(r.ok).toBe(false);
  });

  it('rejects invalid characters', () => {
    const r = cronEngine.evaluate({ dialect: 'cron', source: '* * * * !' }, {});
    expect(r.ok).toBe(false);
  });
});
