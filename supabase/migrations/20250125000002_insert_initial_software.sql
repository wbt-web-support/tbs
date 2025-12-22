-- Insert initial software entries for department 539dca95-3be2-48e9-9c8c-c8f3adce4059
-- Note: This migration requires a team_id. You may need to update the team_id values
-- based on your actual team structure. The team_id should reference auth.users(id)

-- This migration inserts software entries. You'll need to provide the correct team_id
-- when running this migration. For now, we'll use a placeholder that you should replace.

-- Example: If you know the team_id, replace 'YOUR_TEAM_ID_HERE' with the actual UUID
-- Or you can query it: SELECT team_id FROM business_info WHERE user_id = 'some_user_id' LIMIT 1;

DO $$
DECLARE
  v_team_id uuid;
  v_department_id uuid := '539dca95-3be2-48e9-9c8c-c8f3adce4059';
BEGIN
  -- Get the team_id from the first user (you may want to adjust this logic)
  -- For now, we'll try to get it from business_info or use a default
  SELECT team_id INTO v_team_id 
  FROM business_info 
  WHERE team_id IS NOT NULL 
  LIMIT 1;
  
  -- If no team_id found, you'll need to set it manually
  -- For this migration, we'll insert with a placeholder that should be updated
  -- You can also manually set v_team_id := 'your-actual-team-id-here'::uuid;
  
  -- Insert software entries
  INSERT INTO public.software (software, url, description, price_monthly, pricing_period, department_id, team_id)
  VALUES
    ('Vercel', 'https://vercel.com/', NULL, 20.00, 'monthly', v_department_id, COALESCE(v_team_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    ('Supabase', 'https://supabase.com/', NULL, 65.00, 'monthly', v_department_id, COALESCE(v_team_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    ('Coolify', 'https://coolify.io/', NULL, 5.00, 'monthly', v_department_id, COALESCE(v_team_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    ('Cursor', 'https://www.cursor.com/', NULL, 16.00, 'yearly', v_department_id, COALESCE(v_team_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    ('Gemini API', 'https://gemini.google.com/', 'Pay as you go pricing', NULL, 'custom', v_department_id, COALESCE(v_team_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    ('Google Maps API', 'https://developers.google.com/maps', 'Pay as you go pricing', NULL, 'custom', v_department_id, COALESCE(v_team_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    ('OpenAI GPT API', 'https://platform.openai.com/', 'Pay as you go pricing', NULL, 'custom', v_department_id, COALESCE(v_team_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    ('Apify', 'https://apify.com/', NULL, 39.00, 'monthly', v_department_id, COALESCE(v_team_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    ('Contabo', 'https://contabo.com/', NULL, 15.00, 'monthly', v_department_id, COALESCE(v_team_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    ('Stripe', 'https://stripe.com/', NULL, NULL, 'n/a', v_department_id, COALESCE(v_team_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    ('ManageWP Dashboard', 'https://orion.managewp.com/', NULL, NULL, 'n/a', v_department_id, COALESCE(v_team_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    ('Live Website Cloud Flare', 'https://dash.cloudflare.com/', NULL, NULL, 'n/a', v_department_id, COALESCE(v_team_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    ('Brixly Web Server', 'https://client.brixly.uk/', NULL, NULL, 'n/a', v_department_id, COALESCE(v_team_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    ('Siteground Server', 'https://login.siteground.com/', NULL, NULL, 'n/a', v_department_id, COALESCE(v_team_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    ('Mailgun', 'https://login.mailgun.com/', NULL, NULL, 'n/a', v_department_id, COALESCE(v_team_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    ('Sinch', 'https://id.sinch.com/u/login/', NULL, NULL, 'n/a', v_department_id, COALESCE(v_team_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    ('Zero Bouce', 'https://www.zerobounce.net/', NULL, NULL, 'n/a', v_department_id, COALESCE(v_team_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    ('Post Codes4you', 'https://www.postcodes4u.co.uk/', NULL, NULL, 'n/a', v_department_id, COALESCE(v_team_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    ('Pritunl VPN', 'https://vpn.webuildtrades.com/', NULL, NULL, 'n/a', v_department_id, COALESCE(v_team_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    ('Cloud ways', 'https://unified.cloudways.com/', NULL, 54.00, 'monthly', v_department_id, COALESCE(v_team_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    ('Digital Ocen', 'https://www.digitalocean.com/', NULL, 230.00, 'monthly', v_department_id, COALESCE(v_team_id, '00000000-0000-0000-0000-000000000000'::uuid))
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE 'Software entries inserted. If team_id was not found, entries were created with placeholder team_id. Please update team_id manually if needed.';
END $$;

