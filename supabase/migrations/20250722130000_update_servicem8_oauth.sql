-- Update ServiceM8 integration for OAuth 2.0 support
-- Add OAuth token fields and remove API key dependency

-- Add OAuth token columns
ALTER TABLE servicem8_data 
ADD COLUMN IF NOT EXISTS access_token TEXT,
ADD COLUMN IF NOT EXISTS refresh_token TEXT,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS tenant_id TEXT,
ADD COLUMN IF NOT EXISTS organization_name TEXT,
ADD COLUMN IF NOT EXISTS scopes TEXT;

-- Update the table to make api_key optional (for backward compatibility during transition)
-- In a future migration, we can remove the api_key column entirely

-- Update existing indexes to include OAuth tokens
DROP INDEX IF EXISTS idx_servicem8_data_api_key;
CREATE INDEX IF NOT EXISTS idx_servicem8_data_access_token ON servicem8_data(user_id, access_token) WHERE access_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_servicem8_data_tenant_id ON servicem8_data(user_id, tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_servicem8_data_expires_at ON servicem8_data(expires_at) WHERE expires_at IS NOT NULL;

-- Add check constraint to ensure either api_key OR oauth tokens are present
ALTER TABLE servicem8_data 
ADD CONSTRAINT servicem8_auth_method_check 
CHECK (
    (api_key IS NOT NULL) OR 
    (access_token IS NOT NULL AND refresh_token IS NOT NULL AND expires_at IS NOT NULL)
);

-- Comment on the table for documentation
COMMENT ON TABLE servicem8_data IS 'ServiceM8 integration data supporting both API key and OAuth 2.0 authentication';
COMMENT ON COLUMN servicem8_data.access_token IS 'OAuth 2.0 access token (expires in 1 hour)';
COMMENT ON COLUMN servicem8_data.refresh_token IS 'OAuth 2.0 refresh token for obtaining new access tokens';
COMMENT ON COLUMN servicem8_data.expires_at IS 'Timestamp when the access token expires';
COMMENT ON COLUMN servicem8_data.tenant_id IS 'ServiceM8 tenant/company identifier from OAuth';
COMMENT ON COLUMN servicem8_data.organization_name IS 'ServiceM8 organization name for display';
COMMENT ON COLUMN servicem8_data.scopes IS 'OAuth scopes granted for this connection';
COMMENT ON COLUMN servicem8_data.api_key IS 'Legacy API key authentication (deprecated, use OAuth)';