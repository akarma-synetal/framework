---
'@objectstack/example-crm': patch
---

chore(example-crm): cull duplicate/low-value reports

Remove three reports from the CRM example that didn't pass the
"Report vs. Dashboard" value test:

- `LeadsBySourceReport` (single-dim count by `lead_source`) — fully
  redundant with the sales dashboard's "Lead Source" pie tile.
- `ContactsByAccountReport` — really a Contact List View grouped by
  account, not a report.
- `TasksByOwnerReport` — single-dim count, not navigated anywhere.

Remaining 10 reports keep full shape coverage: summary (2), matrix (4),
joined (2), multi-pane (1) plus a chartful summary.
