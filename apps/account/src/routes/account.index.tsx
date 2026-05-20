// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * /account — Account home dashboard.
 *
 * A lightweight overview surface that replaces the legacy
 * `Navigate → /account/profile` shortcut. Gives the user an immediate
 * "snapshot" of their account posture: identity tile, security score and
 * quick-jump tiles into the main sub-sections.
 */

import { createFileRoute, Link } from '@tanstack/react-router';
import { useObjectTranslation } from '@object-ui/i18n';
import {
  ArrowRight,
  Building2,
  KeyRound,
  Link2,
  Mail,
  Monitor,
  Shield,
  ShieldCheck,
  User,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useOrganizations, useSession } from '@/hooks/useSession';

export const Route = createFileRoute('/account/')({
  component: AccountHome,
});

type QuickLinkTo =
  | '/account/profile'
  | '/account/security'
  | '/account/sessions'
  | '/account/two-factor'
  | '/account/linked-accounts'
  | '/account/oauth-applications'
  | '/organizations';

function AccountHome() {
  const { t } = useObjectTranslation();
  const { user } = useSession();
  const { organizations } = useOrganizations();

  // Lightweight security score: each enabled signal contributes 25 pts.
  // - email verified
  // - 2FA enabled
  // - has display name
  // - has avatar
  const signals = [
    !!user?.emailVerified,
    !!user?.twoFactorEnabled,
    !!user?.name,
    !!(user as any)?.image,
  ];
  const score = signals.filter(Boolean).length * 25;
  const scoreTone =
    score >= 75 ? 'success' : score >= 50 ? 'warn' : 'danger';

  const initials = (user?.name ?? user?.email ?? '?')
    .split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase();

  const quickLinks: Array<{
    to: QuickLinkTo;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      to: '/account/profile',
      label: t('home.tiles.profile.title', { defaultValue: 'Profile' }),
      description: t('home.tiles.profile.description', {
        defaultValue: 'Display name, avatar and contact info.',
      }),
      icon: User,
    },
    {
      to: '/account/security',
      label: t('home.tiles.security.title', { defaultValue: 'Security' }),
      description: t('home.tiles.security.description', {
        defaultValue: 'Change your password and review activity.',
      }),
      icon: Shield,
    },
    {
      to: '/account/two-factor',
      label: t('home.tiles.twoFactor.title', { defaultValue: 'Two-factor auth' }),
      description: t('home.tiles.twoFactor.description', {
        defaultValue: 'Add an authenticator app for stronger sign-in.',
      }),
      icon: ShieldCheck,
    },
    {
      to: '/account/sessions',
      label: t('home.tiles.sessions.title', { defaultValue: 'Active sessions' }),
      description: t('home.tiles.sessions.description', {
        defaultValue: 'See and revoke devices that are signed in.',
      }),
      icon: Monitor,
    },
    {
      to: '/account/linked-accounts',
      label: t('home.tiles.linked.title', { defaultValue: 'Linked accounts' }),
      description: t('home.tiles.linked.description', {
        defaultValue: 'Manage your social and SSO providers.',
      }),
      icon: Link2,
    },
    {
      to: '/account/oauth-applications',
      label: t('home.tiles.oauth.title', { defaultValue: 'OAuth applications' }),
      description: t('home.tiles.oauth.description', {
        defaultValue: 'Apps you have authorised to access your account.',
      }),
      icon: KeyRound,
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Identity hero ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-xl border bg-card">
        <div className="absolute inset-0 bg-brand-gradient" aria-hidden />
        <div
          className="absolute inset-0 opacity-40 mix-blend-soft-light"
          style={{
            backgroundImage:
              'radial-gradient(ellipse at 20% 0%, rgba(255,255,255,0.4), transparent 60%), radial-gradient(ellipse at 100% 100%, rgba(0,0,0,0.25), transparent 60%)',
          }}
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 p-6 text-white sm:flex-row sm:items-center sm:gap-6 sm:p-8">
          <Avatar className="size-16 shrink-0 ring-4 ring-white/30 shadow-md sm:size-20">
            {(user as any)?.image ? (
              <AvatarImage src={(user as any).image} alt={user?.name ?? ''} />
            ) : null}
            <AvatarFallback className="bg-white/20 text-base font-semibold text-white backdrop-blur">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs uppercase tracking-wider text-white/70">
              {t('home.welcome', { defaultValue: 'Welcome back' })}
            </p>
            <h2 className="truncate text-2xl font-semibold tracking-tight">
              {user?.name || user?.email || 'ObjectStack user'}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-sm text-white/80">
              <Mail className="size-3.5" aria-hidden />
              <span className="truncate">{user?.email}</span>
              {user?.emailVerified ? (
                <Badge className="border-white/30 bg-white/15 text-[10px] font-medium text-white backdrop-blur hover:bg-white/20">
                  {t('home.verified', { defaultValue: 'Verified' })}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={ShieldCheck}
          label={t('home.stats.score', { defaultValue: 'Security score' })}
          value={`${score}%`}
          tone={scoreTone}
          extra={
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-brand-gradient transition-[width] duration-500"
                style={{ width: `${score}%` }}
              />
            </div>
          }
        />
        <StatCard
          icon={Building2}
          label={t('home.stats.orgs', { defaultValue: 'Organizations' })}
          value={String(organizations.length)}
          extra={
            <Link
              to="/organizations"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {t('home.stats.manage', { defaultValue: 'Manage' })}
              <ArrowRight className="size-3" />
            </Link>
          }
        />
        <StatCard
          icon={user?.twoFactorEnabled ? ShieldCheck : Shield}
          label={t('home.stats.twoFactor', { defaultValue: 'Two-factor auth' })}
          value={
            user?.twoFactorEnabled
              ? t('home.stats.enabled', { defaultValue: 'Enabled' })
              : t('home.stats.disabled', { defaultValue: 'Disabled' })
          }
          tone={user?.twoFactorEnabled ? 'success' : 'warn'}
          extra={
            <Link
              to="/account/two-factor"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {user?.twoFactorEnabled
                ? t('home.stats.review', { defaultValue: 'Review' })
                : t('home.stats.enable', { defaultValue: 'Enable now' })}
              <ArrowRight className="size-3" />
            </Link>
          }
        />
      </div>

      {/* ── Quick-jump tiles ───────────────────────────────────────────── */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">
          {t('home.quickAccess', { defaultValue: 'Quick access' })}
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map(({ to, label, description, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group relative flex items-start gap-3 rounded-lg border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-gradient-subtle text-primary ring-1 ring-primary/10 transition-transform group-hover:scale-110">
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{label}</span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: 'success' | 'warn' | 'danger' | 'neutral';
  extra?: React.ReactNode;
}

function StatCard({ icon: Icon, label, value, tone = 'neutral', extra }: StatCardProps) {
  const toneClasses =
    tone === 'success'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'warn'
        ? 'text-amber-600 dark:text-amber-400'
        : tone === 'danger'
          ? 'text-destructive'
          : 'text-foreground';
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <Icon className={`size-4 ${toneClasses}`} />
        </div>
        <p className={`mt-1 text-2xl font-semibold tracking-tight ${toneClasses}`}>
          {value}
        </p>
        {extra}
      </CardContent>
    </Card>
  );
}

