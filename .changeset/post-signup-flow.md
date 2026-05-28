---
'@objectstack/account': patch
---

Fix: post-signup landing flow

Single-tenant deployments (`OS_MULTI_ORG_ENABLED=false` /
`OS_MULTI_TENANT=false`) no longer bounce a fresh user to the
`/organizations` picker or the `/organizations/new` wizard — both are
nonsensical when org creation is server-side-gated and the user is
expected to land in the one default org. Registration now hands the
user straight to the platform home (or the original `?redirect=`).

Multi-tenant deployments still route no-org users into the create-org
wizard, but the wizard now renders as a fullscreen `AuthShell` dialog
(matching `/login` and `/register`) instead of the authenticated
account chrome (TopBar + Sidebar). Showing a sidebar full of
organization-scoped settings to a user who does not yet have an
organization was contradictory and confusing — the create-org step
should feel like a follow-on to register, not a settings panel. After
successful creation, the wizard also honors `?redirect=` and falls
back to `/` instead of dropping the user back into org settings.

Verified end-to-end in browser for both tenancy modes with two fresh
deployments (single-tenant on :3003 with `OS_MULTI_ORG_ENABLED=false`,
multi-tenant on :3004 with `OS_MULTI_TENANT=true`).
