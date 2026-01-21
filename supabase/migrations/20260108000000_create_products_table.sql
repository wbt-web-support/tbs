-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    client_id BIGINT,
    category VARCHAR(50) CHECK (category IN ('boiler', 'ac', 'ashp', 'battery_storage', 'solar')),
    category_ref_id BIGINT,
    brand_id BIGINT,
    title VARCHAR(255) NOT NULL,
    subtitle VARCHAR(255),
    base_price DECIMAL(12,2),
    currency VARCHAR(10) DEFAULT 'GBP',
    warranty VARCHAR(50),
    power_rating VARCHAR(50),
    width VARCHAR(50),
    height VARCHAR(50),
    depth VARCHAR(50),
    image VARCHAR(512),
    images JSONB DEFAULT '[]'::jsonb,
    features JSONB DEFAULT '[]'::jsonb,
    description TEXT,
    product_specs JSONB DEFAULT '{}'::jsonb,
    ai_vector VECTOR(768),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (title, category, power_rating)
);

-- Dimension check/fix for existing column (if table existed with different vector size)
DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'ai_vector'
    ) THEN
        -- If it exists, we drop and recreate to ensure VECTOR(768)
        ALTER TABLE products DROP COLUMN ai_vector;
        ALTER TABLE products ADD COLUMN ai_vector VECTOR(768);
    END IF;
END $$;

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to avoid "already exists" errors
DROP POLICY IF EXISTS "Allow authenticated users to read products" ON products;
CREATE POLICY "Allow authenticated users to read products" ON products
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated users to insert products" ON products;
CREATE POLICY "Allow authenticated users to insert products" ON products
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated users to update products" ON products;
CREATE POLICY "Allow authenticated users to update products" ON products
    FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated users to delete products" ON products;
CREATE POLICY "Allow authenticated users to delete products" ON products
    FOR DELETE USING (auth.role() = 'authenticated');

-- Create a function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger to call the function
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
