// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { LogOut, Monitor } from 'lucide-react';
import { useObjectTranslation } from '@object-ui/i18n';
import { useClient } from '@objectstack/client-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { parseUserAgent } from '@/lib/user-agent';
import { toast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/useSession';

export const Route = createFileRoute('/account/sessions')({
  component: SessionsPage,
});

interface SessionRecord {
  id: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: string;
  expiresAt: string;
  token: string;
}

function SessionsPage() {
  const { t } = useObjectTranslation();
  const client = useClient() as any;
  const { session: currentSession } = useSession();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const loadSessions = async () => {
    try {
      const res = await client.auth.sessions.list();
      setSessions((res?.sessions ?? []) as SessionRecord[]);
    } catch (err) {
      toast({
        title: t('sessions.loadFailed'),
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRevoke = async (token: string) => {
    setRevoking(token);
    try {
      await client.auth.sessions.revoke(token);
      toast({ title: t('sessions.revoked') });
      await loadSessions();
    } catch (err) {
      toast({
        title: t('sessions.revokeFailed'),
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeOthers = async () => {
    setRevokingOthers(true);
    try {
      await client.auth.sessions.revokeOthers();
      toast({ title: t('sessions.othersRevoked') });
      await loadSessions();
    } catch (err) {
      toast({
        title: t('sessions.revokeOthersFailed'),
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setRevokingOthers(false);
    }
  };

  const currentToken = currentSession?.token;
  const currentSessionRecord = sessions.find((s) => s.token === currentToken);
  const otherSessions = sessions.filter((s) => s.token !== currentToken);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Monitor}
        title={t('sessions.title')}
        description={t('sessions.description')}
        actions={
          sessions.length > 1 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRevokeOthers}
              disabled={revokingOthers}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {revokingOthers ? t('sessions.revokingOthers') : t('sessions.revokeOthers')}
            </Button>
          ) : null
        }
      />

      {loading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="flex items-center gap-3 p-4">
                <Skeleton className="size-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-64" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center text-sm text-muted-foreground">
            <Monitor className="size-10 text-muted-foreground/50" />
            {t('sessions.empty')}
          </CardContent>
        </Card>
      )}

      {!loading && currentSessionRecord && (
        <SessionRow
          session={currentSessionRecord}
          isCurrent
          revoking={false}
          onRevoke={() => undefined}
          t={t}
        />
      )}

      {!loading && otherSessions.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t('sessions.otherDevices', { defaultValue: 'Other signed-in devices' })}
          </p>
          <div className="space-y-2">
            {otherSessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                isCurrent={false}
                revoking={revoking === s.token}
                onRevoke={() => handleRevoke(s.token)}
                t={t}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface SessionRowProps {
  session: SessionRecord;
  isCurrent: boolean;
  revoking: boolean;
  onRevoke: () => void;
  t: (key: string, options?: any) => string;
}

function SessionRow({ session: s, isCurrent, revoking, onRevoke, t }: SessionRowProps) {
  const parsed = parseUserAgent(s.userAgent);
  const Icon = parsed.icon;
  return (
    <Card
      className={
        isCurrent
          ? 'border-primary/40 bg-brand-gradient-subtle shadow-sm shadow-primary/10'
          : 'transition-colors hover:bg-accent/30'
      }
    >
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={
            'flex size-10 shrink-0 items-center justify-center rounded-lg ' +
            (isCurrent
              ? 'bg-brand-gradient text-primary-foreground shadow-sm shadow-primary/30'
              : 'bg-muted text-muted-foreground')
          }
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">{parsed.label}</span>
            {isCurrent && (
              <Badge className="border-transparent bg-emerald-500/15 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                {t('sessions.current')}
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {s.ipAddress && <span className="font-mono">{s.ipAddress}</span>}
            <span>
              {t('sessions.expires', {
                date: new Date(s.expiresAt).toLocaleDateString(),
              })}
            </span>
          </div>
        </div>
        {!isCurrent && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRevoke}
            disabled={revoking}
            className="ml-3 shrink-0 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="mr-1.5 h-4 w-4" />
            {t('sessions.revoke', { defaultValue: 'Revoke' })}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
