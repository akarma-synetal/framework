---
'@objectstack/service-ai': patch
---

Add `GET /api/v1/ai/conversations/:id` route to fetch a single conversation with its full message history. Enforces ownership via the authenticated user: returns `404` when the conversation does not exist and `403` when it belongs to another user. Enables clients to hydrate chat UIs from server-persisted history instead of relying on local storage.
