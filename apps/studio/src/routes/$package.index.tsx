// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute } from '@tanstack/react-router';
import { DeveloperOverview } from '../components/DeveloperOverview';
import { usePackages } from '../hooks/usePackages';

function PackageIndexComponent() {
  const { package: packageId } = Route.useParams();
  const { packages, selectedPackage } = usePackages(packageId);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <DeveloperOverview packages={packages} selectedPackage={selectedPackage} />
    </div>
  );
}

export const Route = createFileRoute('/$package/')({
  component: PackageIndexComponent,
});
