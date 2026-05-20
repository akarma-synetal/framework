// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * /account — Account settings layout.
 *
 * Thin layout shell: centres content in a `max-w-4xl` column with a fade-in
 * animation. Each sub-route owns its own `<PageHeader>` (or custom hero) so
 * the header text + icon stays contextual instead of generic.
 */

import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/account')({
  component: AccountLayout,
});

function AccountLayout() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="page-enter mx-auto flex max-w-4xl flex-col gap-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
