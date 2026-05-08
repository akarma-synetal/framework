// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolve as resolvePath } from 'node:path';
import { tmpdir } from 'node:os';
import {
    resolveDefaultDataDir,
    isServerlessReadOnlyFs,
    __resetDataDirWarningForTests,
} from '../src/data-dir.js';

describe('resolveDefaultDataDir', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        __resetDataDirWarningForTests();
    });

    it('honours OS_DATA_DIR when set', () => {
        const dir = resolveDefaultDataDir({ OS_DATA_DIR: '/custom/path' });
        expect(dir).toBe(resolvePath('/custom/path'));
    });

    it('OS_DATA_DIR wins over serverless detection', () => {
        const dir = resolveDefaultDataDir({ OS_DATA_DIR: '/custom/path', VERCEL: '1' });
        expect(dir).toBe(resolvePath('/custom/path'));
    });

    it('defaults to <cwd>/.objectstack/data on a writable filesystem', () => {
        const dir = resolveDefaultDataDir({});
        expect(dir).toBe(resolvePath(process.cwd(), '.objectstack/data'));
    });

    it('falls back to /tmp when running on Vercel', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const dir = resolveDefaultDataDir({ VERCEL: '1' });
        expect(dir).toBe(resolvePath(tmpdir(), '.objectstack/data'));
        expect(warn).toHaveBeenCalledOnce();
        warn.mockRestore();
    });

    it('falls back to /tmp on AWS Lambda', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const dir = resolveDefaultDataDir({ AWS_LAMBDA_FUNCTION_NAME: 'my-fn' });
        expect(dir).toBe(resolvePath(tmpdir(), '.objectstack/data'));
    });

    it('warns only once per process', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        resolveDefaultDataDir({ VERCEL: '1' });
        resolveDefaultDataDir({ VERCEL: '1' });
        resolveDefaultDataDir({ VERCEL: '1' });
        expect(warn).toHaveBeenCalledOnce();
        warn.mockRestore();
    });

    it('OS_READONLY_FS escape hatch triggers tmpdir fallback', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const dir = resolveDefaultDataDir({ OS_READONLY_FS: '1' });
        expect(dir).toBe(resolvePath(tmpdir(), '.objectstack/data'));
    });
});

describe('isServerlessReadOnlyFs', () => {
    it('detects Vercel via VERCEL=1', () => {
        expect(isServerlessReadOnlyFs({ VERCEL: '1' })).toBe(true);
    });
    it('detects AWS Lambda via AWS_LAMBDA_FUNCTION_NAME', () => {
        expect(isServerlessReadOnlyFs({ AWS_LAMBDA_FUNCTION_NAME: 'fn' })).toBe(true);
    });
    it('detects Netlify via NETLIFY=true', () => {
        expect(isServerlessReadOnlyFs({ NETLIFY: 'true' })).toBe(true);
    });
    it('returns false for an empty environment', () => {
        expect(isServerlessReadOnlyFs({})).toBe(false);
    });
    it('respects the OS_READONLY_FS escape hatch', () => {
        expect(isServerlessReadOnlyFs({ OS_READONLY_FS: '1' })).toBe(true);
        expect(isServerlessReadOnlyFs({ OS_READONLY_FS: 'true' })).toBe(true);
        expect(isServerlessReadOnlyFs({ OS_READONLY_FS: '0' })).toBe(false);
    });
});
