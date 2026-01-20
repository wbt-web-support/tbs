-- Create error_codes table
CREATE TABLE IF NOT EXISTS error_codes (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    severity VARCHAR(20) CHECK (severity IN ('critical', 'warning', 'info')),
    category VARCHAR(50),
    troubleshooting_steps TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create junction table for products and error codes (many-to-many)
CREATE TABLE IF NOT EXISTS product_error_codes (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    error_code_id BIGINT NOT NULL REFERENCES error_codes(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, error_code_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_product_error_codes_product_id ON product_error_codes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_error_codes_error_code_id ON product_error_codes(error_code_id);
CREATE INDEX IF NOT EXISTS idx_error_codes_code ON error_codes(code);
CREATE INDEX IF NOT EXISTS idx_error_codes_is_active ON error_codes(is_active);

-- Enable RLS
ALTER TABLE error_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_error_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for error_codes
DROP POLICY IF EXISTS "Allow authenticated users to read error codes" ON error_codes;
CREATE POLICY "Allow authenticated users to read error_codes" ON error_codes
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated users to insert error codes" ON error_codes;
CREATE POLICY "Allow authenticated users to insert error codes" ON error_codes
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated users to update error codes" ON error_codes;
CREATE POLICY "Allow authenticated users to update error_codes" ON error_codes
    FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated users to delete error codes" ON error_codes;
CREATE POLICY "Allow authenticated users to delete error_codes" ON error_codes
    FOR DELETE USING (auth.role() = 'authenticated');

-- RLS Policies for product_error_codes
DROP POLICY IF EXISTS "Allow authenticated users to read product error codes" ON product_error_codes;
CREATE POLICY "Allow authenticated users to read product error codes" ON product_error_codes
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated users to insert product error codes" ON product_error_codes;
CREATE POLICY "Allow authenticated users to insert product error codes" ON product_error_codes
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated users to delete product error codes" ON product_error_codes;
CREATE POLICY "Allow authenticated users to delete product error codes" ON product_error_codes
    FOR DELETE USING (auth.role() = 'authenticated');

-- Create trigger to update updated_at for error_codes
CREATE OR REPLACE FUNCTION update_error_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_error_codes_updated_at ON error_codes;
CREATE TRIGGER update_error_codes_updated_at
    BEFORE UPDATE ON error_codes
    FOR EACH ROW
    EXECUTE FUNCTION update_error_codes_updated_at();
