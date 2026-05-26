---
'@objectstack/service-ai': minor
'@objectstack/spec': patch
---

Auto-persist chat history when a `conversationId` is supplied.

- `AIService.chatWithTools` and `streamChatWithTools` now write the inbound user turn, each intermediate assistant/tool round, and the final assistant turn to `ai_messages` whenever `toolExecutionContext.conversationId` is set. Persistence is best-effort: failures are warned and never break the chat response.
- Add `IAIConversationService.update(conversationId, { title?, metadata? })` and a matching `PATCH /api/v1/ai/conversations/:id` route so clients can rename conversations and edit metadata.
- `ObjectQLConversationService` and `InMemoryConversationService` both implement the new `update` method.
