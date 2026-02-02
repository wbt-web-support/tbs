# Business Owner Instruction Embeddings Edge Function

This edge function automatically generates vector embeddings for the `business_owner_instructions` table using OpenAI's `text-embedding-3-large` model (1536 dimensions).

## Deployment

1. **Deploy the edge function:**
   ```bash
   supabase functions deploy business-owner-instruction-embeddings
   ```

2. **Set environment variables in Supabase Dashboard:**
   - Go to Project Settings > Edge Functions > Environment Variables
   - Set the following:
     - `OPENAI_API_KEY`: Your OpenAI API key
     - `SUPABASE_URL`: Your Supabase project URL (e.g., `https://npeajhtemjbcpnhsqknf.supabase.co`)
     - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key

3. **Run the database migration:**
   ```bash
   supabase db push
   ```
   Or apply the migration manually in the Supabase SQL Editor.

4. **Configure app.settings:**
   After running the migration, update the service role key:
   ```sql
   UPDATE app.settings 
   SET value = 'YOUR_SERVICE_ROLE_KEY' 
   WHERE key = 'service_role_key';
   ```

## Testing

### Manual Test

Test the edge function directly:

```bash
curl -X POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/business-owner-instruction-embeddings' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "record_id": "test-uuid-here",
    "content": "This is test content to generate embeddings for"
  }'
```

### Database Trigger Test

1. Insert a new record:
   ```sql
   INSERT INTO business_owner_instructions (user_id, title, content, content_type)
   VALUES (
     'user-uuid-here',
     'Test Title',
     'This is test content that should trigger embedding generation',
     'text'
   );
   ```

2. Check if embedding was generated:
   ```sql
   SELECT id, title, embeddings IS NOT NULL as has_embedding
   FROM business_owner_instructions
   WHERE title = 'Test Title';
   ```

3. Update content to test UPDATE trigger:
   ```sql
   UPDATE business_owner_instructions
   SET content = 'Updated content that should trigger new embedding'
   WHERE title = 'Test Title';
   ```

## How It Works

1. When a row is inserted or updated in `business_owner_instructions`:
   - The database trigger `business_owner_instructions_embedding_trigger` fires
   - The trigger function `generate_business_owner_instruction_embedding()` is called
   - It calls the edge function via HTTP POST

2. The edge function:
   - Receives the `record_id` and `content`
   - Generates embeddings using OpenAI API
   - Updates the `embeddings` column in the database

3. The process is asynchronous (fire-and-forget), so database operations are not blocked.
