// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Building2, Check, ChevronRight, Plus } from 'lucide-react';
import { useObjectTranslation } from '@object-ui/i18n';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/page-header';
import { toast } from '@/hooks/use-toast';
import { useOrganizations, useSession } from '@/hooks/useSession';

export const Route = createFileRoute('/organizations/')({
  component: OrgsListPage,
});

function OrgsListPage() {
  const { t } = useObjectTranslation();
  const { organizations, loading } = useOrganizations();
  const { session, setActiveOrganization, features } = useSession();
  const navigate = useNavigate();
  const activeId = session?.activeOrganizationId ?? undefined;
  const canCreateOrg = features?.multiOrgEnabled !== false;

  const handleSelect = async (id: string) => {
    try {
      if (id !== activeId) {
        await setActiveOrganization(id);
      }
      navigate({ to: '/organizations/$orgId', params: { orgId: id } });
    } catch (err) {
      toast({
        title: t('organizations.switchFailed'),
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  const orgInitials = (name: string) =>
    name
      .split(/\s+/)
      .map((s) => s[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="page-enter mx-auto flex max-w-3xl flex-col gap-6">
          <PageHeader
            icon={Building2}
            title={t('organizations.title')}
            description={t('organizations.description')}
            actions={
              canCreateOrg ? (
                <Button
                  onClick={() => navigate({ to: '/organizations/new' })}
                  className="bg-brand-gradient text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:opacity-95 hover:shadow-md hover:shadow-primary/30"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t('organizations.newOrganization')}
                </Button>
              ) : null
            }
          />

          {loading && (
            <p className="text-sm text-muted-foreground">{t('organizations.loading')}</p>
          )}

          {!loading && organizations.length === 0 && (
            <Card className="p-10 text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-lg bg-brand-gradient-subtle text-primary ring-1 ring-primary/15">
                <Building2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-medium">{t('organizations.emptyTitle')}</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                {t('organizations.emptyDescription')}
              </p>
              {canCreateOrg && (
                <Button
                  onClick={() => navigate({ to: '/organizations/new' })}
                  className="bg-brand-gradient text-primary-foreground shadow-sm shadow-primary/20"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t('organizations.createOrganization')}
                </Button>
              )}
            </Card>
          )}

          <div className="grid gap-3">
            {organizations.map((org) => {
              const isActive = org.id === activeId;
              return (
                <Card
                  key={org.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelect(org.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelect(org.id);
                    }
                  }}
                  className={`group cursor-pointer p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 focus:outline-none focus:ring-2 focus:ring-ring ${
                    isActive
                      ? 'border-primary/50 bg-brand-gradient-subtle ring-1 ring-primary/30'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={
                        'flex size-12 shrink-0 items-center justify-center rounded-lg font-semibold ' +
                        (isActive
                          ? 'bg-brand-gradient text-primary-foreground shadow-sm shadow-primary/30 ring-1 ring-white/15'
                          : 'bg-muted text-muted-foreground group-hover:bg-brand-gradient-subtle group-hover:text-primary')
                      }
                    >
                      {orgInitials(org.name) || <Building2 className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-medium">
                          {org.name}
                        </h3>
                        {isActive && (
                          <Badge className="gap-1 border-transparent bg-emerald-500/15 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                            <Check className="h-3 w-3" />
                            {t('organizations.active')}
                          </Badge>
                        )}
                      </div>
                      {org.slug && (
                        <code className="mt-0.5 block font-mono text-xs text-muted-foreground">
                          {org.slug}
                        </code>
                      )}
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
