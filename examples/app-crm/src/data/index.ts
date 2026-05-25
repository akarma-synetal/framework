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
    // --- Open pipeline (no close yet) -----------------------------------
    { name: 'Acme — Q3 Platform Renewal', account: { externalId: 'Acme Corp' },  stage: 'proposal',       amount: 120_000, probability: 70, close_date: cel`daysFromNow(30)` },
    { name: 'Globex — New CRM Rollout',   account: { externalId: 'Globex Ltd' }, stage: 'qualification',  amount: 450_000, probability: 40, close_date: cel`daysFromNow(60)` },
    { name: 'Initech — Expansion',        account: { externalId: 'Initech' },    stage: 'prospecting',    amount:  80_000, probability: 20, close_date: cel`daysFromNow(45)` },
    { name: 'Acme — Add-on Module',       account: { externalId: 'Acme Corp' },  stage: 'qualification',  amount:  60_000, probability: 35, close_date: cel`daysFromNow(20)` },

    // --- Recently closed-won (current quarter — drives "Won This Quarter") -
    { name: 'Initech — Pilot',                  account: { externalId: 'Initech' },    stage: 'closed_won', amount:  35_000, probability: 100, close_date: cel`daysAgo(7)` },
    { name: 'Acme — Support Tier Upgrade',      account: { externalId: 'Acme Corp' },  stage: 'closed_won', amount:  90_000, probability: 100, close_date: cel`daysAgo(14)` },
    { name: 'Globex — Analytics Pack',          account: { externalId: 'Globex Ltd' }, stage: 'closed_won', amount: 110_000, probability: 100, close_date: cel`daysAgo(21)` },

    // --- Previous-quarter wins (drives the "vs last quarter" comparison) ---
    { name: 'Initech — POC',                    account: { externalId: 'Initech' },    stage: 'closed_won', amount:  25_000, probability: 100, close_date: cel`daysAgo(95)` },
    { name: 'Globex — Initial Seats',           account: { externalId: 'Globex Ltd' }, stage: 'closed_won', amount: 145_000, probability: 100, close_date: cel`daysAgo(110)` },

    // --- Prior-year wins in the same window (drives "YoY" comparison) ------
    { name: 'Acme — Year-Ago Renewal',          account: { externalId: 'Acme Corp' },  stage: 'closed_won', amount:  75_000, probability: 100, close_date: cel`daysAgo(380)` },
    { name: 'Globex — Year-Ago Implementation', account: { externalId: 'Globex Ltd' }, stage: 'closed_won', amount: 210_000, probability: 100, close_date: cel`daysAgo(400)` },

    // --- Closed lost (kept out of pipeline sum) ----------------------------
    { name: 'Initech — Cancelled Eval',         account: { externalId: 'Initech' },    stage: 'closed_lost', amount: 15_000, probability: 0, close_date: cel`daysAgo(30)` },
  ],
});

export const CrmSeedData = [accounts, contacts, opportunities];
