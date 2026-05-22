// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Public Forms preset — surfaces every `view` metadata item with
 * `sharing.allowAnonymous === true && sharing.publicLink`.
 *
 * Each row exposes:
 *   • the public URL (`/console/f/:slug`)
 *   • copy actions for raw URL, `<iframe>`, and React snippets
 *   • a preview link that opens the form in a new tab
 *
 * This is the customer-facing entry point for the Web-to-Lead /
 * Web-to-Case shape documented in `content/docs/guides/public-forms.mdx`.
 */

import { useEffect, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useClient } from '@objectstack/client-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Copy, ExternalLink, FormInput, RefreshCw, Code2, Link2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

/** Shape of a `view` metadata row, narrowed for the Public Forms lens. */
interface PublicFormRow {
  name: string;
  label?: string;
  object?: string;
  slug: string;
  publicLink: string;
  updatedAt?: string;
}

/** Extract a slug from a `publicLink` like '/forms/contact-us' → 'contact-us'. */
function slugFromLink(link?: string): string | null {
  if (!link) return null;
  const m = link.replace(/^\/+/, '').match(/^forms\/([^/?#]+)/i);
  return m?.[1] ?? null;
}

function PublicFormsList() {
  const client = useClient();
  const packageId = Route.useParams().package;
  const [rows, setRows] = useState<PublicFormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await client.meta.getItems('view');
      const items: any[] = Array.isArray(result)
        ? (result as any)
        : Array.isArray((result as any)?.items)
          ? (result as any).items
          : [];
      const forms: PublicFormRow[] = items
        .map((it): PublicFormRow | null => {
          const spec = it?.spec ?? it;
          const sharing = spec?.sharing;
          const link: string | undefined = sharing?.publicLink;
          const slug = slugFromLink(link);
          if (!sharing?.allowAnonymous || !slug || !link) return null;
          return {
            name: spec?.name ?? it?.name,
            label: spec?.label,
            object: spec?.object,
            slug,
            publicLink: link,
            updatedAt: it?.updatedAt ?? it?.updated_at,
          };
        })
        .filter((x): x is PublicFormRow => x !== null);
      setRows(forms);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const formatPublicUrl = (slug: string) => `${origin}/console/f/${slug}`;
  const formatIframe = (slug: string) =>
    `<iframe src="${formatPublicUrl(slug)}" width="100%" height="640" frameborder="0" style="border:0;"></iframe>`;
  const formatReact = (slug: string) =>
    `<iframe\n  src={\`${formatPublicUrl(slug)}\`}\n  title="Public form"\n  style={{ width: '100%', height: 640, border: 0 }}\n/>`;

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `Copied ${label}` });
    } catch {
      toast({ title: 'Clipboard unavailable', variant: 'destructive' as any });
    }
  };

  const hasRows = rows.length > 0;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6 overflow-auto">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FormInput className="h-4 w-4" />
              Public forms
            </CardTitle>
            <CardDescription>
              Anonymous form views with{' '}
              <code className="text-xs">sharing.allowAnonymous</code> enabled. Each
              row is wired to{' '}
              <code className="text-xs">GET / POST /api/v1/forms/:slug</code>.{' '}
              <a
                href="/docs/guides/public-forms"
                className="underline underline-offset-2"
                target="_blank"
                rel="noreferrer"
              >
                Read the guide →
              </a>
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="ml-1.5">Refresh</span>
          </Button>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {!loading && !hasRows && (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              <p className="font-medium text-foreground">No public forms yet</p>
              <p className="mt-1">
                Declare a <code className="text-xs">FormView</code> with{' '}
                <code className="text-xs">sharing.allowAnonymous: true</code> and a{' '}
                <code className="text-xs">publicLink</code>, then refresh.
              </p>
            </div>
          )}
          {hasRows && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Object</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Public URL</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const url = formatPublicUrl(row.slug);
                  return (
                    <TableRow key={row.name}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{row.label ?? row.name}</span>
                          <code className="text-xs text-muted-foreground">{row.name}</code>
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.object ? (
                          <Badge variant="secondary">{row.object}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs">{row.slug}</code>
                      </TableCell>
                      <TableCell>
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
                        >
                          {url}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Copy URL"
                            onClick={() => copy('URL', url)}
                          >
                            <Link2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Copy <iframe> embed"
                            onClick={() => copy('iframe snippet', formatIframe(row.slug))}
                          >
                            <Code2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Copy React snippet"
                            onClick={() => copy('React snippet', formatReact(row.slug))}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button asChild variant="ghost" size="sm" title="Open metadata">
                            <Link
                              to="/$package/metadata/$type/$name"
                              params={{ package: packageId, type: 'view', name: row.name }}
                            >
                              <FormInput className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Route definition — file-based `/$package/public-forms`. */
export const Route = createFileRoute('/$package/public-forms')({
  component: PublicFormsList,
});
