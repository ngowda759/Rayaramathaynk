-- Migration: Create settings tables (site_settings, social_links)

-- 1. Create `site_settings` table
CREATE TABLE site_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    temple_name text NOT NULL DEFAULT 'Sri Raghavendra Swamy Temple',
    contact_email text NOT NULL DEFAULT 'info@example.com',
    contact_phone text NOT NULL DEFAULT '',
    address text NOT NULL DEFAULT '',
    footer_text text,
    welcome_message text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Apply updated_at trigger to site_settings
CREATE TRIGGER update_site_settings_updated_at
    BEFORE UPDATE ON site_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 2. Create `social_links` table
CREATE TABLE social_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    facebook text,
    instagram text,
    youtube text,
    whatsapp text,
    twitter text,
    linkedin text,
    map_url text,
    show_facebook boolean NOT NULL DEFAULT true,
    show_instagram boolean NOT NULL DEFAULT true,
    show_youtube boolean NOT NULL DEFAULT true,
    show_whatsapp boolean NOT NULL DEFAULT true,
    show_twitter boolean NOT NULL DEFAULT false,
    show_linkedin boolean NOT NULL DEFAULT false,
    show_map boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Apply updated_at trigger to social_links
CREATE TRIGGER update_social_links_updated_at
    BEFORE UPDATE ON social_links
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 3. Enable Row Level Security (RLS)
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_links ENABLE ROW LEVEL SECURITY;

-- Create policies: allow public reads since settings are non-sensitive configuration data.
-- Keep writes restricted.
CREATE POLICY "Allow public read access to site_settings"
    ON site_settings
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Allow public read access to social_links"
    ON social_links
    FOR SELECT
    TO public
    USING (true);

-- Restrict writes (Deny all public writes)
CREATE POLICY "Deny all public write access to site_settings"
    ON site_settings
    FOR INSERT
    TO public
    WITH CHECK (false);

CREATE POLICY "Deny all public update access to site_settings"
    ON site_settings
    FOR UPDATE
    TO public
    USING (false);

CREATE POLICY "Deny all public delete access to site_settings"
    ON site_settings
    FOR DELETE
    TO public
    USING (false);

CREATE POLICY "Deny all public write access to social_links"
    ON social_links
    FOR INSERT
    TO public
    WITH CHECK (false);

CREATE POLICY "Deny all public update access to social_links"
    ON social_links
    FOR UPDATE
    TO public
    USING (false);

CREATE POLICY "Deny all public delete access to social_links"
    ON social_links
    FOR DELETE
    TO public
    USING (false);
