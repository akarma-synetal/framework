// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineDataset } from '@objectstack/spec/data';
import { cel } from '@objectstack/spec';
import { Account } from '../objects/account.object.js';
import { Contact } from '../objects/contact.object.js';
import { Opportunity } from '../objects/opportunity.object.js';

const accounts = defineDataset(Account, {
  mode: 'upsert',
  externalId: 'name',
  records: [
    { name: 'Acme Corp',     industry: 'technology', annual_revenue: 5_000_000, website: 'https://acme.example' },
    { name: 'Globex Ltd',    industry: 'finance',    annual_revenue: 12_000_000, website: 'https://globex.example' },
    { name: 'Initech',       industry: 'technology', annual_revenue: 2_500_000, website: 'https://initech.example' },
  ],
});

const contacts = defineDataset(Contact, {
  mode: 'upsert',
  externalId: 'email',
  records: [
    { first_name: 'Ada',    last_name: 'Lovelace', email: 'ada@acme.example',    account: { externalId: 'Acme Corp' } },
    { first_name: 'Linus',  last_name: 'Torvalds', email: 'linus@globex.example', account: { externalId: 'Globex Ltd' } },
    { first_name: 'Grace',  last_name: 'Hopper',   email: 'grace@initech.example', account: { externalId: 'Initech' } },
  ],
});

const opportunities = defineDataset(Opportunity, {
  mode: 'upsert',
  externalId: 'name',
  records: [
    { name: 'Acme — Q3 Platform Renewal', account: { externalId: 'Acme Corp' },  stage: 'proposal',       amount: 120_000, probability: 70, close_date: cel`daysFromNow(30)` },
    { name: 'Globex — New CRM Rollout',   account: { externalId: 'Globex Ltd' }, stage: 'qualification',  amount: 450_000, probability: 40, close_date: cel`daysFromNow(60)` },
    { name: 'Initech — Pilot',            account: { externalId: 'Initech' },    stage: 'closed_won',     amount:  35_000, probability: 100, close_date: cel`daysAgo(7)` },
  ],
});

export const CrmSeedData = [accounts, contacts, opportunities];
