// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { useObjectTranslation } from '@object-ui/i18n';

export interface LegalLinksProps {
  /** URL to the deployment's Terms of Service. Hidden when undefined. */
  termsUrl?: string;
  /** URL to the deployment's Privacy Policy. Hidden when undefined. */
  privacyUrl?: string;
}

/**
 * Fine-print legal links shown beneath the login / register cards.
 *
 * ObjectStack is a developer tool: end users of downstream apps should
 * see the *operator's* legal documents, not ours. Operators configure
 * these URLs via the `OS_TERMS_URL` / `OS_PRIVACY_URL` env vars, which
 * are surfaced through `GET /api/v1/auth/config` → `features.termsUrl` /
 * `features.privacyUrl`. When neither is set this component renders
 * nothing — there is no vanilla "ObjectStack Terms" page to link to.
 */
export function LegalLinks({ termsUrl, privacyUrl }: LegalLinksProps): React.ReactElement | null {
  const { t } = useObjectTranslation('account');
  const hasTerms = typeof termsUrl === 'string' && termsUrl.length > 0;
  const hasPrivacy = typeof privacyUrl === 'string' && privacyUrl.length > 0;
  if (!hasTerms && !hasPrivacy) return null;
  return (
    <p className="px-6 text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary">
      {t('legal.agreementPrefix')}{' '}
      {hasTerms ? (
        <a href={termsUrl} target="_blank" rel="noreferrer noopener">
          {t('legal.termsOfService')}
        </a>
      ) : null}
      {hasTerms && hasPrivacy ? <> {t('legal.and')} </> : null}
      {hasPrivacy ? (
        <a href={privacyUrl} target="_blank" rel="noreferrer noopener">
          {t('legal.privacyPolicy')}
        </a>
      ) : null}
      .
    </p>
  );
}
