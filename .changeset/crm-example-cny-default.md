---
"@objectstack/example-app-crm": patch
---

CRM example: set `currency: 'CNY'` on every `Field.currency()` definition (opportunity, account, lead, quote, contract, campaign, product, line items). The CRM example renders Chinese labels by default; bare `500,000` amounts in the pipeline kanban were confusing without an explicit unit, and falling back to USD on a Chinese-locale dataset was misleading. CNY is the right default for the localized demo.
