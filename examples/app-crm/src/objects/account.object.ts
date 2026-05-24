// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';

export const Account = ObjectSchema.create({
  name: 'account',
  label: 'Account',
  pluralLabel: 'Accounts',
  icon: 'building',
  description: 'A company that the org sells to or supports.',

  fields: {
    name: Field.text({
      label: 'Account Name',
      required: true,
      searchable: true,
      maxLength: 200,
    }),
    industry: Field.select({
      label: 'Industry',
      options: [
        { label: 'Technology', value: 'technology', default: true },
        { label: 'Finance', value: 'finance' },
        { label: 'Healthcare', value: 'healthcare' },
        { label: 'Retail', value: 'retail' },
        { label: 'Other', value: 'other' },
      ],
    }),
    annual_revenue: Field.currency({
      label: 'Annual Revenue',
      scale: 2,
      min: 0,
    }),
    website: Field.url({
      label: 'Website',
    }),
  },
});
