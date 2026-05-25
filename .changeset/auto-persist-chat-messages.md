---
'@objectstack/service-ai': patch
---

Auto-persist chat messages when `conversationId` is supplied. `AIService.chatWithTools` and `streamChatWithTools` now write the inbound user turn, every intermediate assistant/tool round, and the final assistant turn to `ai_messages` via the configured conversation service. Persistence is best-effort: failures are logged at `warn` level and never fail the chat request.
