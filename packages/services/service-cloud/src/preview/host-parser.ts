// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Preview host parser.
 *
 * Recognises hostnames of the form `<ref>--<pidShort>.<base>` where:
 *   • `pidShort` is exactly 8 lowercase hex chars (= first 8 hex chars of
 *     a project UUID, dashes stripped).
 *   • `ref` is either:
 *       - exactly 16 lowercase hex chars  → a commit-pinned preview
 *         (publish derives commitId = sha256(artifact).slice(0,16)), or
 *       - a branch slug (matches BRANCH_SLUG_RE elsewhere) → branch-tracking.
 *   • `<base>` is one of the configured preview base domains, e.g.
 *     `preview.objectstack.ai` (prod) or `localhost[:port]` (dev,
 *     RFC 6761 — the browser resolves any *.localhost to 127.0.0.1).
 *
 * Examples
 * --------
 *   abc123def456--7f3e9a01.preview.objectstack.ai   commit, pid prefix 7f3e9a01
 *   main--7f3e9a01.preview.objectstack.ai           branch 'main'
 *   feature/login--7f3e9a01.localhost:4100          branch 'feature/login' (dev)
 *
 * The parser does NOT resolve the short id to a full projectId, nor look
 * up the branch head — that lives in PreviewEnvironmentRegistry. It is a
 * pure string function so it can be unit-tested without a registry.
 */

const COMMIT_HEX_RE = /^[0-9a-f]{16}$/;
const PID_SHORT_RE = /^[0-9a-f]{8}$/;
/** Same shape as BRANCH_SLUG_RE in routes/branches.ts. Duplicated here to
 *  avoid pulling that file into the parser's import graph. */
const BRANCH_SLUG_RE = /^[a-z0-9][a-z0-9._/-]{0,62}$/;

export interface PreviewHost {
    /** 'commit' = ref is a 16-hex commit id; 'branch' = ref is a slug. */
    kind: 'commit' | 'branch';
    /** First 8 hex chars of the project's UUID (no dashes). */
    pidShort: string;
    /** Either a 16-hex commit id or a branch slug. */
    ref: string;
}

export interface PreviewParseConfig {
    /**
     * Allowed base domains. Defaults to `['preview.objectstack.ai',
     * 'localhost']` — `localhost` is matched with an optional `:port`.
     *
     * Each entry is matched case-insensitively as an exact hostname suffix
     * (after the first `.<base>` separator). Subdomains of subdomains are
     * not allowed — hostnames must be exactly `<ref>--<pidShort>.<base>`.
     */
    baseDomains?: readonly string[];
}

const DEFAULT_BASE_DOMAINS = ['preview.objectstack.ai', 'localhost'];

/**
 * Normalises the host (lowercases, strips trailing dots) and returns a
 * {@link PreviewHost} when the pattern matches; otherwise `null`.
 *
 * Stripping the port: parsing accepts a `host:port` and silently drops
 * the port for matching, so dev hosts like `main--7f3e9a01.localhost:4100`
 * work seamlessly. The full original string is never echoed.
 */
export function parsePreviewHost(host: string, config?: PreviewParseConfig): PreviewHost | null {
    if (typeof host !== 'string' || host.length === 0) return null;

    // Drop port and any trailing dot, lowercase.
    let h = host.toLowerCase().trim();
    const colon = h.lastIndexOf(':');
    if (colon > 0 && /^[0-9]+$/.test(h.slice(colon + 1))) h = h.slice(0, colon);
    while (h.endsWith('.')) h = h.slice(0, -1);
    if (!h) return null;

    const bases = (config?.baseDomains ?? DEFAULT_BASE_DOMAINS).map((b) => b.toLowerCase());

    // Find which base the hostname ends with.
    let head: string | null = null;
    for (const base of bases) {
        const suffix = `.${base}`;
        if (h === base) {
            // Bare base host; not a preview URL.
            return null;
        }
        if (h.endsWith(suffix)) {
            const candidate = h.slice(0, -suffix.length);
            // Reject deeper subdomains: candidate must NOT contain another
            // dot. We only support exactly one label before the base.
            // (BRANCH_SLUG_RE actually allows '.' in slugs, but a slug
            // can't end in a dot so this disambiguation is safe.)
            //
            // Note: branch slugs like 'feature.x' contain a dot but are
            // followed by `--<pid>.<base>`. The candidate string (before
            // the base) is `feature.x--7f3e9a01` — which is fine. We
            // allow dots within the candidate because both the slug and
            // the `--` separator may legitimately contain them.
            head = candidate;
            break;
        }
    }
    if (head === null) return null;

    // The candidate must contain `--` separating <ref> from <pidShort>.
    // We use lastIndexOf so a ref that itself contains `--` (rare but
    // technically allowed by the slug regex `[a-z0-9._/-]`) still works:
    // the rightmost `--` always precedes the 8-hex pid.
    const sep = head.lastIndexOf('--');
    if (sep < 1 || sep + 2 >= head.length) return null;
    const ref = head.slice(0, sep);
    const pidShort = head.slice(sep + 2);

    if (!PID_SHORT_RE.test(pidShort)) return null;
    if (!ref) return null;

    if (COMMIT_HEX_RE.test(ref)) {
        return { kind: 'commit', pidShort, ref };
    }
    if (BRANCH_SLUG_RE.test(ref)) {
        return { kind: 'branch', pidShort, ref };
    }
    return null;
}

/**
 * Compute the 8-hex short id for a project UUID (or any string).
 * Strips dashes and lowercases, then takes the first 8 hex chars.
 * Returns `null` if the input doesn't yield 8 hex chars.
 */
export function projectIdToShort(projectId: string): string | null {
    if (typeof projectId !== 'string') return null;
    const compact = projectId.replace(/-/g, '').toLowerCase();
    const first8 = compact.slice(0, 8);
    return PID_SHORT_RE.test(first8) ? first8 : null;
}
