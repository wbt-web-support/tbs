# Chatbot Flow API

API for building and running flow-based chatbots (admin) and for using them elsewhere in the app (public/user endpoints).

---

## Admin-only endpoints (super_admin required)

Used by `/admin/chatbot-flow` only. All require `verifySuperAdmin()`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/chatbot-flow/chatbots` | List all chatbots. Returns `{ chatbots: Array<{ id, name, base_prompts, is_active, model_name, created_by, created_at, updated_at, node_count }> }`. |
| POST | `/api/chatbot-flow/chatbots` | Create chatbot. Body: `{ name, base_prompts?, model_name?, is_active? }`. |
| GET | `/api/chatbot-flow/chatbots/[id]` | Get one chatbot (full). Returns full row including `base_prompts`. |
| PUT | `/api/chatbot-flow/chatbots/[id]` | Update chatbot. Body: `{ name?, base_prompts?, model_name?, is_active? }`. |
| DELETE | `/api/chatbot-flow/chatbots/[id]` | Delete chatbot. |
| GET | `/api/chatbot-flow/chatbots/[id]/nodes` | Get linked nodes for a chatbot. Returns `{ nodes: Array<{ id, node_key, name, node_type, settings, order_index, link_id? }> }`. |
| POST | `/api/chatbot-flow/chatbots/[id]/nodes` | Add node. Body: `{ node_key, position? }`. |
| PUT | `/api/chatbot-flow/chatbots/[id]/nodes/[nodeId]` | Update node (settings/position). Body: `{ settings?, position? }`. |
| DELETE | `/api/chatbot-flow/chatbots/[id]/nodes/[nodeId]` | Remove node. |
| POST | `/api/chatbot-flow/assemble` | Build system prompt for a chatbot. Body: `{ chatbotId, userId?, teamId?, structured? }`. Returns `{ prompt, chatbotId, chatbotName }` or structured breakdown if `structured: true`. |
| POST | `/api/chatbot-flow/chat` | Send message (admin test). Body: `{ chatbotId, message, history?, userId?, teamId? }`. Returns `{ reply, thoughtSummary? }`. |
| GET | `/api/chatbot-flow/test-users` | List users for "Test as user". Returns `{ users: Array<{ id, email, full_name, business_name, role }> }`. |

---

## Public / use-elsewhere endpoints (any authenticated user)

Use these from dashboard pages, embedded chat widgets, or any non-admin part of the app.

### List chatbots (for display)

- **GET** `/api/chatbot-flow/public/chatbots`
- **Auth:** Any authenticated user.
- **Response:** `{ chatbots: Array<{ id, name, is_active, model_name }> }` — only active chatbots, no `base_prompts`.

Use to show a list of available assistants (e.g. "Fulfillment assistant", "Growth assistant") and link to chat.

### Get one chatbot details (for header / config)

- **GET** `/api/chatbot-flow/public/chatbots/[id]`
- **Auth:** Any authenticated user.
- **Response:** `{ id, name, is_active, model_name }`. Returns 404 if chatbot is inactive or missing.

Use to show the chatbot name and status when rendering a chat UI elsewhere.

### Send message as current user (chat from dashboard, etc.)

- **POST** `/api/chatbot-flow/chatbots/[id]/chat`
- **Auth:** Any authenticated user. Uses the **effective user** (or session user) for context: `userId` and `teamId` from `business_info`.
- **Body:** `{ message: string, history?: Array<{ role: "user" | "model", parts: [{ text: string }] }> }`.
- **Response:** `{ reply: string, thoughtSummary?: string }`.

Use from any page that has a chat UI: pass `message` and optional `history`; the API resolves the current user and team and runs the chatbot with that context (same data access as if that user were talking to the bot).

**Example (from a dashboard component):**

```ts
// Fetch chatbot list for selector
const { chatbots } = await fetch('/api/chatbot-flow/public/chatbots').then(r => r.json());

// Optional: get one chatbot's name for header
const bot = await fetch(`/api/chatbot-flow/public/chatbots/${chatbotId}`).then(r => r.json());

// Send message as current user (no userId/teamId needed)
const res = await fetch(`/api/chatbot-flow/chatbots/${chatbotId}/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: userInput, history: messages }),
});
const { reply } = await res.json();
```

---

## Where details are shown today

- **Admin flow editor** (`/admin/chatbot-flow/[id]/edit`): Uses GET `/api/chatbot-flow/chatbots/[id]` and GET `/api/chatbot-flow/chatbots/[id]/nodes` for full config; POST `/api/chatbot-flow/assemble` for context preview; POST `/api/chatbot-flow/chat` for test chat (with optional `userId`/`teamId` for "Test as user").
- **Admin list** (`/admin/chatbot-flow`): Uses GET `/api/chatbot-flow/chatbots` for the table with `node_count`.

---

## Using in other places

1. **List assistants:** `GET /api/chatbot-flow/public/chatbots` → show cards/links.
2. **Chat page/embed:** For a chosen `chatbotId`, call `POST /api/chatbot-flow/chatbots/[id]/chat` with `{ message, history }`; no need to pass `userId`/`teamId` — the API uses the current (effective) user.
3. **Header/label:** `GET /api/chatbot-flow/public/chatbots/[id]` → display `name` and optionally `model_name`.

All public endpoints return 401 if not authenticated and 404 if the chatbot does not exist or is inactive where applicable.
