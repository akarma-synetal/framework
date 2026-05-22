// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute } from '@tanstack/react-router';
import { PluginHost } from '../plugins';
import { usePackages } from '../hooks/usePackages';
import { useSetInspectorTarget } from '@/hooks/useInspector';
import { ResourceActionsMenu } from '@/components/ResourceActionsMenu';

function MetadataViewComponent() {
  const { package: packageId, type, name } = Route.useParams();
  const { selectedPackage } = usePackages(packageId);
  const resolvedPkgId = selectedPackage?.manifest?.id ?? packageId;
  useSetInspectorTarget({ type, name, packageId: resolvedPkgId });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-end gap-2 border-b px-3 py-1.5">
        <ResourceActionsMenu type={type} name={name} packageId={resolvedPkgId} />
      </div>
      <PluginHost metadataType={type} metadataName={name} packageId={resolvedPkgId} />
    </div>
  );
}

export const Route = createFileRoute('/$package/metadata/$type/$name')({
  component: MetadataViewComponent,
});
