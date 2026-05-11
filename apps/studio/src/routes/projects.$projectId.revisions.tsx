// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * /projects/$projectId/revisions — published artifact revision history.
 *
 * Lists every `sys_project_revision` row for the project (newest first),
 * surfaces the current commit, and lets the operator:
 *   - copy a download URL for the artifact (public `/pub/v1` if visibility
 *     allows, otherwise auth-gated `/api/v1/cloud/...`),
 *   - activate (rollback to) a previous revision,
 *   - open a "preview" tab against the chosen commit.
 */

import { createFileRoute, useParams } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { Copy, RotateCcw, Loader2, Eye, GitBranch, Trash2, Pencil } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProjectHeader } from '@/components/projects/project-header';
import {
  useProjectDetail,
  useRevisions,
  useActivateRevision,
  useBranches,
  useBranchMutations,
} from '@/hooks/useProjects';
import { toast } from '@/hooks/use-toast';

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function ProjectRevisionsComponent() {
  const { projectId } = useParams({ from: '/projects/$projectId/revisions' });
  const { detail } = useProjectDetail(projectId);
  const [branchFilter, setBranchFilter] = useState<string | null>(null);
  const { items, loading, reload } = useRevisions(projectId, { branch: branchFilter ?? undefined });
  const { items: branches, loading: branchesLoading, reload: reloadBranches } = useBranches(projectId);
  const { activate, activating } = useActivateRevision();
  const { rename: renameBranch, remove: removeBranch, busy: branchMutating } = useBranchMutations();
  const [pendingCommit, setPendingCommit] = useState<string | null>(null);

  const project = detail?.project;
  const rawVisibility = (project as any)?.visibility ?? 'private';
  // Legacy `unlisted` rows collapse into `private` (share-by-link).
  const visibility: 'private' | 'public' =
    rawVisibility === 'public' ? 'public' : 'private';
  const baseOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  const currentCommit = useMemo(
    () => items.find((r) => r.isCurrent)?.commitId ?? null,
    [items],
  );

  const buildArtifactUrl = (commitId: string): string => {
    // Both `public` and `private` allow anonymous download with an exact
    // commitId via /pub/v1; the difference is enumeration (revisions list).
    return `${baseOrigin}/api/v1/pub/v1/projects/${encodeURIComponent(projectId)}/artifact?commit=${encodeURIComponent(commitId)}`;
  };

  const handleCopyUrl = async (commitId: string) => {
    const url = buildArtifactUrl(commitId);
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Artifact URL copied', description: url });
    } catch (err) {
      toast({
        title: 'Copy failed',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleActivate = async (commitId: string) => {
    setPendingCommit(commitId);
    try {
      await activate(projectId, commitId);
      toast({
        title: 'Revision activated',
        description: `Project now serves commit ${commitId.slice(0, 12)}.`,
      });
      await reload();
    } catch (err) {
      toast({
        title: 'Activation failed',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setPendingCommit(null);
    }
  };

  const handlePreview = (commitId: string) => {
    const url = buildArtifactUrl(commitId);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleRenameBranch = async (from: string) => {
    const to = window.prompt(`Rename branch "${from}" to:`, from);
    if (!to || to === from) return;
    try {
      await renameBranch(projectId, from, to);
      toast({ title: 'Branch renamed', description: `${from} → ${to}` });
      if (branchFilter === from) setBranchFilter(to);
      await Promise.all([reload(), reloadBranches()]);
    } catch (err) {
      toast({ title: 'Rename failed', description: (err as Error).message, variant: 'destructive' });
    }
  };

  const handleDeleteBranch = async (name: string) => {
    if (!window.confirm(
      `Delete branch "${name}"?\n\nThe branch's revisions will remain (their commit URLs still resolve), ` +
      `but branch-tracking preview URLs for "${name}" will stop working.`,
    )) return;
    try {
      await removeBranch(projectId, name);
      toast({ title: 'Branch deleted', description: `Branch "${name}" demoted` });
      if (branchFilter === name) setBranchFilter(null);
      await Promise.all([reload(), reloadBranches()]);
    } catch (err) {
      toast({ title: 'Delete failed', description: (err as Error).message, variant: 'destructive' });
    }
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-auto bg-background">
      {project && (
        <ProjectHeader
          projectId={projectId}
          project={project}
          detail={detail}
          onReload={reload}
          loading={loading}
          active="revisions"
        />
      )}
      <div className="mx-auto w-full max-w-6xl space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Published revisions</h1>
            <p className="text-xs text-muted-foreground">
              History of every artifact published for this project.
            </p>
          </div>
          {currentCommit && (
            <Badge variant="secondary" className="font-mono text-xs">
              Current: {currentCommit.slice(0, 12)}
            </Badge>
          )}
        </div>

        {/* Branches summary card */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2.5">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <GitBranch className="h-3.5 w-3.5" />
              Branches
              <span className="font-normal normal-case tracking-normal text-muted-foreground/70">
                ({branchesLoading ? '…' : branches.length})
              </span>
            </h2>
            {branchFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setBranchFilter(null)}
              >
                Show all branches
              </Button>
            )}
          </div>
          {branchesLoading ? (
            <div className="px-4 py-3 text-xs text-muted-foreground">Loading branches…</div>
          ) : branches.length === 0 ? (
            <div className="px-4 py-3 text-xs text-muted-foreground">
              No branches yet. Run{' '}
              <code className="font-mono">objectstack publish --branch &lt;name&gt;</code> to create one.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {branches.map((b) => {
                const isFiltered = branchFilter === b.branch;
                const isMain = b.branch === 'main';
                return (
                  <div
                    key={b.branch}
                    className={`flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/20 ${
                      isFiltered ? 'bg-muted/30' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setBranchFilter(isFiltered ? null : b.branch)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      title={isFiltered ? 'Click to clear filter' : `Click to filter to ${b.branch}`}
                    >
                      <GitBranch className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                      <code className="truncate font-mono text-sm font-medium">{b.branch}</code>
                      {isMain && (
                        <Badge variant="outline" className="text-[10px]">default</Badge>
                      )}
                      {b.isCurrent && (
                        <Badge variant="default" className="text-[10px]">current</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        head <code className="font-mono">{b.headCommitId.slice(0, 12)}</code>
                        {b.revisionCount > 1 && ` · ${b.revisionCount} revisions`}
                        {b.headPublishedAt && ` · ${new Date(b.headPublishedAt).toLocaleDateString()}`}
                      </span>
                    </button>
                    <div className="flex items-center gap-1">
                      {!isMain && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleRenameBranch(b.branch)}
                          disabled={branchMutating}
                          title="Rename branch"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {!isMain && !b.isCurrent && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteBranch(b.branch)}
                          disabled={branchMutating}
                          title="Delete branch (revisions remain accessible by commit URL)"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {loading ? (
          <Card className="flex items-center justify-center p-12 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading revisions…
          </Card>
        ) : items.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground">
            <p className="mb-2">No published revisions yet.</p>
            <p className="text-xs">
              Run <code className="font-mono">objectstack publish</code> from
              your project directory to create the first revision.
            </p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Commit</th>
                    <th className="px-4 py-3 text-left font-medium">Branch</th>
                    <th className="px-4 py-3 text-left font-medium">Size</th>
                    <th className="px-4 py-3 text-left font-medium">Built</th>
                    <th className="px-4 py-3 text-left font-medium">By</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((r) => {
                    const isPending = pendingCommit === r.commitId && activating;
                    return (
                      <tr key={r.commitId} className="hover:bg-muted/20">
                        <td className="px-4 py-3 align-top">
                          <code
                            className="cursor-pointer font-mono text-xs"
                            title={r.commitId}
                            onClick={() => handleCopyUrl(r.commitId)}
                          >
                            {r.commitId.slice(0, 16)}…
                          </code>
                          {r.note && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {r.note}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <button
                            type="button"
                            onClick={() =>
                              setBranchFilter(branchFilter === r.branch ? null : r.branch)
                            }
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted"
                            title={`Filter by branch ${r.branch}`}
                          >
                            <GitBranch className="h-3 w-3 text-muted-foreground" />
                            <code className="font-mono text-xs">{r.branch}</code>
                            {r.isBranchHead && (
                              <Badge variant="outline" className="text-[10px]">head</Badge>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 align-top text-xs text-muted-foreground">
                          {formatBytes(r.sizeBytes)}
                        </td>
                        <td className="px-4 py-3 align-top text-xs text-muted-foreground">
                          {new Date(r.builtAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 align-top text-xs text-muted-foreground">
                          {r.publishedBy ?? '—'}
                        </td>
                        <td className="px-4 py-3 align-top">
                          {r.isCurrent ? (
                            <Badge variant="default" className="text-xs">current</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">archived</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyUrl(r.commitId)}
                              title="Copy artifact URL"
                              className="h-8 w-8 p-0"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePreview(r.commitId)}
                              title="Preview artifact JSON"
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {!r.isCurrent && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleActivate(r.commitId)}
                                disabled={isPending}
                                className="gap-1 text-xs"
                              >
                                {isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-3 w-3" />
                                )}
                                Activate
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {visibility === 'private' && (
          <p className="text-xs text-muted-foreground">
            This project is <strong>private</strong> — it is hidden from the
            public gallery and from <code>/pub/v1</code> enumeration, but
            anyone with the <em>exact</em> URL above (including the{' '}
            <code>?commit=&lt;id&gt;</code> query) can download that snapshot
            anonymously (share-by-link). Members keep full authenticated
            access. Switch to <code>public</code> from the project page to
            list it and allow current-pointer downloads without a commit.
          </p>
        )}
      </div>
    </main>
  );
}

export const Route = createFileRoute('/projects/$projectId/revisions')({
  component: ProjectRevisionsComponent,
});
