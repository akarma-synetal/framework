// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { parsePreviewHost, projectIdToShort } from '../src/preview/host-parser.js';

describe('parsePreviewHost', () => {
    describe('commit-pinned (12 hex)', () => {
        it('parses prod hostname', () => {
            const r = parsePreviewHost('abc123def456--7f3e9a01.preview.objectstack.ai');
            expect(r).toEqual({ kind: 'commit', pidShort: '7f3e9a01', ref: 'abc123def456' });
        });

        it('parses localhost hostname (RFC 6761)', () => {
            const r = parsePreviewHost('abc123def456--7f3e9a01.localhost');
            expect(r).toEqual({ kind: 'commit', pidShort: '7f3e9a01', ref: 'abc123def456' });
        });

        it('strips :port', () => {
            const r = parsePreviewHost('abc123def456--7f3e9a01.localhost:4100');
            expect(r).toEqual({ kind: 'commit', pidShort: '7f3e9a01', ref: 'abc123def456' });
        });

        it('lowercases input', () => {
            const r = parsePreviewHost('ABC123DEF456--7F3E9A01.PREVIEW.OBJECTSTACK.AI');
            expect(r).toEqual({ kind: 'commit', pidShort: '7f3e9a01', ref: 'abc123def456' });
        });
    });

    describe('branch-tracking (slug)', () => {
        it('parses main', () => {
            const r = parsePreviewHost('main--7f3e9a01.preview.objectstack.ai');
            expect(r).toEqual({ kind: 'branch', pidShort: '7f3e9a01', ref: 'main' });
        });

        it('parses slash-containing slug', () => {
            const r = parsePreviewHost('feature/login--7f3e9a01.localhost:4100');
            expect(r).toEqual({ kind: 'branch', pidShort: '7f3e9a01', ref: 'feature/login' });
        });

        it('parses dotted slug', () => {
            const r = parsePreviewHost('release.v2--7f3e9a01.preview.objectstack.ai');
            expect(r).toEqual({ kind: 'branch', pidShort: '7f3e9a01', ref: 'release.v2' });
        });

        it('parses dash-containing slug', () => {
            const r = parsePreviewHost('hot-fix--7f3e9a01.localhost');
            expect(r).toEqual({ kind: 'branch', pidShort: '7f3e9a01', ref: 'hot-fix' });
        });
    });

    describe('rejections', () => {
        it('null/empty → null', () => {
            expect(parsePreviewHost('')).toBeNull();
            expect(parsePreviewHost(null as any)).toBeNull();
            expect(parsePreviewHost(undefined as any)).toBeNull();
        });

        it('bare base host → null', () => {
            expect(parsePreviewHost('preview.objectstack.ai')).toBeNull();
            expect(parsePreviewHost('localhost')).toBeNull();
        });

        it('non-preview hostname → null', () => {
            expect(parsePreviewHost('myapp.objectstack.ai')).toBeNull();
            expect(parsePreviewHost('cloud.objectstack.ai')).toBeNull();
        });

        it('missing -- separator → null', () => {
            expect(parsePreviewHost('abc7f3e9a01.preview.objectstack.ai')).toBeNull();
        });

        it('pid not exactly 8 hex → null', () => {
            expect(parsePreviewHost('main--7f3e9a.preview.objectstack.ai')).toBeNull();   // 6 hex
            expect(parsePreviewHost('main--7f3e9a012.preview.objectstack.ai')).toBeNull(); // 9 hex
            expect(parsePreviewHost('main--zzzzzzzz.preview.objectstack.ai')).toBeNull(); // not hex
        });

        it('empty ref → null', () => {
            expect(parsePreviewHost('--7f3e9a01.preview.objectstack.ai')).toBeNull();
        });

        it('uppercase pid → lowercased and accepted', () => {
            const r = parsePreviewHost('main--7F3E9A01.preview.objectstack.ai');
            expect(r).toEqual({ kind: 'branch', pidShort: '7f3e9a01', ref: 'main' });
        });

        it('rejects when base domain not in allowlist', () => {
            const r = parsePreviewHost('main--7f3e9a01.notmydomain.com');
            expect(r).toBeNull();
        });

        it('respects custom baseDomains', () => {
            const r = parsePreviewHost('main--7f3e9a01.example.dev', {
                baseDomains: ['example.dev'],
            });
            expect(r).toEqual({ kind: 'branch', pidShort: '7f3e9a01', ref: 'main' });
            // Default base no longer matches when overridden.
            expect(parsePreviewHost('main--7f3e9a01.preview.objectstack.ai', {
                baseDomains: ['example.dev'],
            })).toBeNull();
        });
    });

    describe('commit/branch disambiguation', () => {
        it('exactly 12 hex → commit', () => {
            expect(parsePreviewHost('0123456789ab--7f3e9a01.localhost')?.kind).toBe('commit');
        });

        it('11 hex → branch (slug regex still matches)', () => {
            expect(parsePreviewHost('0123456789a--7f3e9a01.localhost')?.kind).toBe('branch');
        });

        it('13 hex → branch (slug regex still matches)', () => {
            expect(parsePreviewHost('0123456789abc--7f3e9a01.localhost')?.kind).toBe('branch');
        });
    });
});

describe('projectIdToShort', () => {
    it('strips dashes and returns first 8 hex', () => {
        expect(projectIdToShort('7f3e9a01-1234-5678-9abc-def012345678')).toBe('7f3e9a01');
    });

    it('lowercases', () => {
        expect(projectIdToShort('7F3E9A01-1234-5678-9ABC-DEF012345678')).toBe('7f3e9a01');
    });

    it('returns null on too-short input', () => {
        expect(projectIdToShort('7f3e')).toBeNull();
    });

    it('returns null on non-hex', () => {
        expect(projectIdToShort('zzzzzzzz-1234-5678-9abc-def012345678')).toBeNull();
    });

    it('handles UUID without dashes', () => {
        expect(projectIdToShort('7f3e9a0112345678')).toBe('7f3e9a01');
    });
});
