# Gemini WebSocket Server

This server provides a WebSocket interface to interact with Google's Gemini API, with support for user-specific instructions from Supabase.

## Features

- Real-time chat with Google's Gemini AI model
- Audio transcription and text-to-speech capabilities
- User-specific instructions based on Supabase data
- Integration with multiple Supabase tables to provide user context

## Setup

1. Install dependencies:

```bash
npm install ws @google/generative-ai axios @supabase/supabase-js
```

2. Set up environment variables:

```
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
GEMINI_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-openai-api-key
```

3. Run the server:

```bash
node gemini-ws-server.js
```

## Database Setup

Run the SQL migration in `supabase/migrations/20240601_chatbot_instructions.sql` to create the necessary table for chatbot instructions.

## Usage

Connect to the WebSocket server on `ws://localhost:4001`.

### Client Messages

1. Send text messages:

```javascript
ws.send(JSON.stringify({
  type: 'chat',
  message: 'Hello, how can you help me?',
  userId: 'optional-user-id'  // Optional: Include to get user-specific instructions
}));
```

2. Send audio messages:

```javascript
ws.send(JSON.stringify({
  type: 'audio',
  audio: base64EncodedAudio,
  mimeType: 'audio/wav',
  userId: 'optional-user-id'  // Optional: Include to get user-specific instructions
}));
```

### Server Responses

The server sends various message types:

- `stream-chunk`: Partial AI response during streaming
- `stream-complete`: Complete AI response
- `transcription`: Transcription of audio
- `tts-audio`: Text-to-speech audio
- `error`: Error details

## Adding Instructions

### Global Instructions

Add global instructions in the `chatbot_instructions` table with `is_global` set to `true` and `user_id` set to `null`.

### User-Specific Instructions

Add user-specific instructions in the `chatbot_instructions` table with the user's ID in `user_id` and `is_global` set to `false`.

## User Context

The server automatically fetches data from the following tables to provide context to the AI:

- battle_plan
- business_info
- chain_of_command
- hwgt_plan
- machines
- meeting_rhythm_planner
- playbooks
- quarterly_sprint_canvas
- triage_planner
- user_benefit_claims
- user_checklist_claims
- user_timeline_claims

## Security Considerations

- Always use environment variables for sensitive keys in production
- Implement proper authentication and authorization 