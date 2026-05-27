// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Email Verification Prompt Page
 *
 * Shown to users who need to verify their email address. Provides:
 * - Clear messaging about verification requirement
 * - Resend verification email button
 * - Support link
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useClient } from '@objectstack/client-react';
import { useObjectTranslation } from '@object-ui/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { AuthShell } from '@/components/auth/auth-shell';
import { MailCheck, RefreshCw } from 'lucide-react';

export const Route = createFileRoute('/verify-email-prompt')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { email?: string; redirect?: string } => {
    return {
      email: typeof search.email === 'string' ? search.email : undefined,
      redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
    };
  },
  component: VerifyEmailPromptPage,
});

function VerifyEmailPromptPage() {
  const { t } = useObjectTranslation();
  const navigate = useNavigate();
  const { email, redirect } = Route.useSearch();
  const client = useClient() as any;
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    if (!email || !client?.auth) {
      toast({
        title: t('auth.verifyEmail.resendFailed', {
          defaultValue: 'Cannot resend verification email',
        }),
        description: t('auth.verifyEmail.emailMissing', {
          defaultValue: 'Email address is missing',
        }),
        variant: 'destructive',
      });
      return;
    }

    setResending(true);
    try {
      // Call better-auth's send-verification-email endpoint
      const response = await fetch('/api/v1/auth/send-verification-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          callbackURL: redirect || '/',
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(error.message || 'Failed to send verification email');
      }

      setResent(true);
      toast({
        title: t('auth.verifyEmail.resentSuccess', {
          defaultValue: 'Verification email sent!',
        }),
        description: t('auth.verifyEmail.resentDescription', {
          defaultValue: 'Please check your inbox and click the verification link.',
        }),
      });
    } catch (err) {
      toast({
        title: t('auth.verifyEmail.resendFailed', {
          defaultValue: 'Failed to resend verification email',
        }),
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setResending(false);
    }
  };

  const handleBackToLogin = () => {
    navigate({ to: '/login', search: redirect ? { redirect } : undefined });
  };

  return (
    <AuthShell>
      <div className="flex flex-col gap-6">
        <Card className="border-border/60 shadow-sm shadow-primary/5 backdrop-blur supports-[backdrop-filter]:bg-card/95">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
              <MailCheck className="size-8 text-primary" />
            </div>
            <CardTitle className="text-xl tracking-tight">
              {t('auth.verifyEmail.title', {
                defaultValue: 'Verify your email address',
              })}
            </CardTitle>
            <CardDescription>
              {t('auth.verifyEmail.description', {
                defaultValue:
                  'We sent a verification link to your email address. Please click the link to verify your account.',
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              {email ? (
                <p className="text-center text-sm text-muted-foreground">
                  {t('auth.verifyEmail.sentTo', {
                    defaultValue: 'Sent to:',
                  })}{' '}
                  <span className="font-medium text-foreground">{email}</span>
                </p>
              ) : null}

              <Button
                onClick={handleResend}
                disabled={resending || resent}
                className="w-full"
                variant={resent ? 'outline' : 'default'}
              >
                {resending ? (
                  <>
                    <RefreshCw className="mr-2 size-4 animate-spin" />
                    {t('auth.verifyEmail.resending', {
                      defaultValue: 'Sending...',
                    })}
                  </>
                ) : resent ? (
                  t('auth.verifyEmail.resent', {
                    defaultValue: 'Email sent! Check your inbox',
                  })
                ) : (
                  <>
                    <RefreshCw className="mr-2 size-4" />
                    {t('auth.verifyEmail.resendButton', {
                      defaultValue: 'Resend verification email',
                    })}
                  </>
                )}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    {t('auth.verifyEmail.or', { defaultValue: 'Or' })}
                  </span>
                </div>
              </div>

              <Button onClick={handleBackToLogin} variant="ghost" className="w-full">
                {t('auth.verifyEmail.backToLogin', {
                  defaultValue: 'Back to login',
                })}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                {t('auth.verifyEmail.checkSpam', {
                  defaultValue:
                    "Didn't receive the email? Check your spam folder or contact support.",
                })}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthShell>
  );
}
