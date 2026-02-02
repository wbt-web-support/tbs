# Chatbot Flow API

API for building and running flow-based chatbots (admin) and for using them in your application (public endpoints).

---

## Application integration (public endpoints)

Use these from your app: dashboard chat, embedded widgets, or any authenticated page.

### 1. List chatbots

- **GET** `/api/chatbot-flow/public/chatbots`
- **Auth:** Any authenticated user.
- **Response:** `{ chatbots: Array<{ id, name, is_active, model_name }> }` — active chatbots only.

Use to show a list of assistants and link to chat.

### 2. Get one chatbot (for header + web search option)

- **GET** `/api/chatbot-flow/public/chatbots/[id]`
- **Auth:** Any authenticated user.
- **Response:** `{ id, name, is_active, model_name, webSearchEnabled: boolean }`. 404 if not found or inactive.

- `webSearchEnabled`: `true` when the chatbot has a Web search node. Only show the “Search web” option in your chat UI when this is `true`.

### 2b. Get context for current user (debug panel)

- **GET** `/api/chatbot-flow/public/chatbots/[id]/context`
- **Auth:** Any authenticated user. Uses the **logged-in user** (session) and their `business_info` team for data.
- **Response:** `{ basePrompt, instructionBlocks, dataModules, fullPrompt, webSearchEnabled }`. 404 if chatbot not found.

Use to show a debug/context panel: base prompt, instruction blocks, data modules (team/user data), and full prompt sent to the LLM.

### 3. Send message (chat)

- **POST** `/api/chatbot-flow/chatbots/[id]/chat`
- **Auth:** Any authenticated user. The API uses the **logged-in user** (session) and their `business_info` team for context so the chatbot has access to that user's data.
- **Request body:**

| Field            | Type     | Required | Description |
|------------------|----------|----------|-------------|
| `message`        | string   | Yes      | User message for this turn. |
| `history`        | array    | No       | Previous turns for context. See format below. |
| `use_web_search` | boolean  | No       | When `true`, enables Google Search grounding for this turn. Only send when the user has checked “Search web” and the chatbot has `webSearchEnabled: true`. |

- **Response:** `{ reply: string, thoughtSummary?: string }`.
- **Errors:** 400 (missing message), 401 (not authenticated), 404 (chatbot not found), 502 (model/API error).

#### History format

Send the last N turns so the model keeps conversation context. Each item can be:

**Preferred (Gemini format):**
```json
{ "role": "user", "parts": [{ "text": "Hello" }] }
{ "role": "assistant", "parts": [{ "text": "Hi! How can I help?" }] }
```
or `"model"` instead of `"assistant"` for assistant messages.

**Also accepted (simplified):**
```json
{ "role": "user", "content": "Hello" }
{ "role": "assistant", "content": "Hi! How can I help?" }
```

- `role`: `"user"` or `"assistant"` (or `"model"`).
- Either `parts: [{ "text": "..." }]` or `content: "..."`.
- API keeps the last 30 history messages; you can send fewer (e.g. last 10–20).

---

## Example: chat in your app

```ts
// 1. List chatbots (e.g. for a selector)
const { chatbots } = await fetch('/api/chatbot-flow/public/chatbots').then(r => r.json());

// 2. Get chatbot details (name, and whether to show "Search web")
const bot = await fetch(`/api/chatbot-flow/public/chatbots/${chatbotId}`).then(r => r.json());
// bot: { id, name, is_active, model_name, webSearchEnabled }

// 3. Send a message (keep history on the client and send last N turns)
const history = messages.slice(-20).map((m) => ({
  role: m.role,
  parts: [{ text: m.content }],
}));

const res = await fetch(`/api/chatbot-flow/chatbots/${chatbotId}/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: userInput,
    history,
    use_web_search: userCheckedSearchWeb && bot.webSearchEnabled,
  }),
});
const data = await res.json();
if (!res.ok) throw new Error(data.error ?? 'Request failed');
// data.reply, data.thoughtSummary
```

**UI behavior:**

- Show a “Search web” checkbox only when `bot.webSearchEnabled === true`.
- When the user checks it, send `use_web_search: true` for that message.
- Maintain `messages` (user + assistant) on the client and send the last 10–30 as `history` for each request.

---

## Admin-only endpoints (super_admin)

Used by `/admin/chatbot-flow`. All require `verifySuperAdmin()`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/chatbot-flow/chatbots` | List all chatbots. Returns `{ chatbots }` with `node_count`. |
| POST | `/api/chatbot-flow/chatbots` | Create chatbot. Body: `{ name, base_prompts?, model_name?, is_active? }`. |
| GET | `/api/chatbot-flow/chatbots/[id]` | Get one chatbot (full, including `base_prompts`). |
| PUT | `/api/chatbot-flow/chatbots/[id]` | Update chatbot. Body: `{ name?, base_prompts?, model_name?, is_active? }`. |
| DELETE | `/api/chatbot-flow/chatbots/[id]` | Delete chatbot. |
| GET | `/api/chatbot-flow/chatbots/[id]/nodes` | Get linked nodes. Returns `{ nodes: Array<{ id, node_key, name, node_type, settings, order_index, link_id? }> }`. |
| POST | `/api/chatbot-flow/chatbots/[id]/nodes` | Add node. Body: `{ node_key, position? }`. |
| PUT | `/api/chatbot-flow/chatbots/[id]/nodes/[nodeId]` | Update node. Body: `{ settings?, position? }`. |
| DELETE | `/api/chatbot-flow/chatbots/[id]/nodes/[nodeId]` | Remove node. |
| POST | `/api/chatbot-flow/assemble` | Build system prompt. Body: `{ chatbotId, userId?, teamId?, structured? }`. If `structured: true`, returns `{ prompt, chatbotId, chatbotName, basePrompt, instructionBlocks, dataModules, webSearchEnabled }`. |
| POST | `/api/chatbot-flow/chat` | Send message (admin test). Body: `{ chatbotId, message, history?, userId?, teamId?, use_web_search? }`. Returns `{ reply, thoughtSummary? }`. |
| GET | `/api/chatbot-flow/test-users` | List users for “Test as user”. Returns `{ users }`. |

---

## Summary for application implementation

1. **List assistants:** `GET /api/chatbot-flow/public/chatbots` → show cards/links.
2. **Chat screen:** `GET /api/chatbot-flow/public/chatbots/[id]` → show name and, if `webSearchEnabled`, a “Search web” checkbox.
3. **Send message:** `POST /api/chatbot-flow/chatbots/[id]/chat` with `{ message, history, use_web_search? }`; keep conversation history on the client and send last N turns as `history`.
4. All public endpoints return **401** if not authenticated and **404** when the chatbot is missing or inactive where applicable.
