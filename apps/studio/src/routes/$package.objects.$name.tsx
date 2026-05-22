// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute } from '@tanstack/react-router';
import { PluginHost } from '../plugins';
import { usePackages } from '../hooks/usePackages';

function ObjectViewComponent() {
  const { package: packageId, name } = Route.useParams();
  const { selectedPackage } = usePackages(packageId);
  const resolvedPkgId = selectedPackage?.manifest?.id ?? packageId;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PluginHost metadataType="object" metadataName={name} packageId={resolvedPkgId} />
    </div>
  );
}

export const Route = createFileRoute('/$package/objects/$name')({
  component: ObjectViewComponent,
});
