// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useObjectTranslation } from '@object-ui/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { useCreateOrganization, useSession } from '@/hooks/useSession';
import { AuthShell } from '@/components/auth/auth-shell';

export const Route = createFileRoute('/organizations/new')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const r = search.redirect;
    return typeof r === 'string' ? { redirect: r } : {};
  },
  component: NewOrgPage,
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function isSafeRedirect(target: string | undefined): target is string {
  return !!target && target.startsWith('/') && !target.startsWith('//');
}

function resolveRedirect(target: string): string {
  if (target.startsWith('/_')) return target;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return base + target;
}

function NewOrgPage() {
  const { t } = useObjectTranslation();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const { create, creating } = useCreateOrganization();
  const { setActiveOrganization, reloadOrganizations, features } = useSession();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugDirty, setSlugDirty] = useState(false);

  // Server-side `beforeCreateOrganization` hook also blocks this, but
  // bouncing early avoids a confusing form-then-error round trip.
  useEffect(() => {
    if (features && features.multiOrgEnabled === false) {
      navigate({ to: '/organizations' });
    }
  }, [features, navigate]);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugDirty) setSlug(slugify(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await create({ name, slug: slug || undefined });
      const created = (res as any)?.data ?? res;
      const newId = created?.id ?? created?.organization?.id;
      if (newId) {
        await setActiveOrganization(newId).catch(() => {});
      }
      await reloadOrganizations().catch(() => {});
      toast({ title: t('organizations.new.successToast') });
      // Hand off to the original target (post-signup redirect) or the
      // platform home. The user just finished an auth-flow follow-on
      // step — they want to land in product, not in org settings.
      if (isSafeRedirect(redirect)) {
        window.location.assign(resolveRedirect(redirect));
      } else {
        window.location.assign('/');
      }
    } catch (err) {
      toast({
        title: t('organizations.new.failed'),
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  return (
    <AuthShell formWidth="md">
      <Card className="border-border/60 shadow-sm shadow-primary/5 backdrop-blur supports-[backdrop-filter]:bg-card/95">
        <CardHeader className="text-center">
          <CardTitle className="text-xl tracking-tight">{t('organizations.new.title')}</CardTitle>
          <CardDescription>{t('organizations.new.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">{t('organizations.new.name')}</Label>
              <Input
                id="name"
                required
                autoFocus
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={t('organizations.new.namePlaceholder')}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="slug">{t('organizations.new.slug')}</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugDirty(true);
                }}
                placeholder={t('organizations.new.slugPlaceholder')}
                pattern="[a-z0-9-]+"
              />
              <p className="text-[11px] text-muted-foreground">
                {t('organizations.new.slugHint')}
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={creating || !name}>
              {creating ? t('organizations.new.submitting') : t('organizations.new.submit')}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <Link
                to="/organizations"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {t('organizations.new.cancel')}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
