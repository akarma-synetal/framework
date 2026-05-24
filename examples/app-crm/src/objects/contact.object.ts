// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectSchema, Field } from '@objectstack/spec/data';
import { cel } from '@objectstack/spec';

export const Contact = ObjectSchema.create({
  name: 'contact',
  label: 'Contact',
  pluralLabel: 'Contacts',
  icon: 'user',
  description: 'A person associated with an account.',

  fields: {
    first_name: Field.text({
      label: 'First Name',
      maxLength: 80,
    }),
    last_name: Field.text({
      label: 'Last Name',
      required: true,
      searchable: true,
      maxLength: 80,
    }),
    full_name: Field.formula({
      label: 'Full Name',
      expression: cel`(first_name == null ? '' : first_name + ' ') + last_name`,
    }),
    email: Field.email({
      label: 'Email',
      searchable: true,
    }),
    account: Field.lookup('account', {
      label: 'Account',
    }),
  },
});
