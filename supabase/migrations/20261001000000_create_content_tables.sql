-- Migration: Create content tables (users, profiles, donations, donation_campaigns, gallery_albums, gallery_media, testimonials, aaradhanes, volunteer_requests)

-- Ensure updated_at function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 4.4. Table: users
CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    email text NOT NULL,
    display_name text,
    phone_number text,
    photo_url text,
    role text NOT NULL DEFAULT 'user',
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public access to users" ON users;
CREATE POLICY "Deny all public access to users" ON users FOR ALL TO public USING (false);


-- 4.5. Table: profiles
CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    uid text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    phone text,
    profile_image text,
    bio text,
    gotra text,
    nakshatra text,
    preferences jsonb NOT NULL DEFAULT '{}',
    favorites text[] NOT NULL DEFAULT '{}',
    recently_viewed text[] NOT NULL DEFAULT '{}',
    bookmarks jsonb NOT NULL DEFAULT '[]',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public access to profiles" ON profiles;
CREATE POLICY "Deny all public access to profiles" ON profiles FOR ALL TO public USING (false);


-- 4.7. Table: donation_campaigns
CREATE TABLE IF NOT EXISTS donation_campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    title text NOT NULL,
    description text NOT NULL,
    image_url text NOT NULL,
    suggested_amount numeric(10,2) NOT NULL,
    active boolean NOT NULL DEFAULT true,
    display_order integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS update_donation_campaigns_updated_at ON donation_campaigns;
CREATE TRIGGER update_donation_campaigns_updated_at BEFORE UPDATE ON donation_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
ALTER TABLE donation_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public access to donation_campaigns" ON donation_campaigns;
CREATE POLICY "Deny all public access to donation_campaigns" ON donation_campaigns FOR ALL TO public USING (false);
CREATE INDEX IF NOT EXISTS idx_donation_campaigns_display_order ON donation_campaigns (display_order);


-- 4.6. Table: donations
CREATE TABLE IF NOT EXISTS donations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    donor_name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    address text NOT NULL,
    amount numeric(10,2) NOT NULL,
    purpose text NOT NULL,
    campaign_id uuid, -- Keeping as uuid, though mapped loosely in code sometimes
    message text NOT NULL,
    payment_mode text NOT NULL,
    status text NOT NULL,
    receipt_number text NOT NULL,
    admin_remarks text NOT NULL,
    collected_by text NOT NULL,
    collected_at timestamptz
);

ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public access to donations" ON donations;
CREATE POLICY "Deny all public access to donations" ON donations FOR ALL TO public USING (false);


-- 4.8. Table: gallery_albums
CREATE TABLE IF NOT EXISTS gallery_albums (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    title text NOT NULL,
    slug text NOT NULL,
    description text NOT NULL,
    cover_image text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    display_order integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS update_gallery_albums_updated_at ON gallery_albums;
CREATE TRIGGER update_gallery_albums_updated_at BEFORE UPDATE ON gallery_albums FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
ALTER TABLE gallery_albums ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public access to gallery_albums" ON gallery_albums;
CREATE POLICY "Deny all public access to gallery_albums" ON gallery_albums FOR ALL TO public USING (false);
CREATE INDEX IF NOT EXISTS idx_gallery_albums_display_order ON gallery_albums (display_order);


-- 4.9. Table: gallery_media
CREATE TABLE IF NOT EXISTS gallery_media (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    album_id uuid, -- Loose reference to gallery_albums
    title text NOT NULL,
    description text NOT NULL,
    category text NOT NULL,
    type text NOT NULL,
    image_path text NOT NULL,
    video_url text,
    alt_text text NOT NULL,
    is_featured boolean NOT NULL DEFAULT false,
    display_order integer NOT NULL DEFAULT 0,
    tags text[] NOT NULL DEFAULT '{}',
    uploaded_by text NOT NULL,
    uploaded_at timestamptz
);

ALTER TABLE gallery_media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public access to gallery_media" ON gallery_media;
CREATE POLICY "Deny all public access to gallery_media" ON gallery_media FOR ALL TO public USING (false);


-- 4.10. Table: testimonials
CREATE TABLE IF NOT EXISTS testimonials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    name text NOT NULL,
    location text NOT NULL,
    quote text NOT NULL,
    years text NOT NULL,
    image text,
    phone text,
    approved boolean DEFAULT false,
    rejected boolean DEFAULT false,
    rejection_reason text,
    submitted_by text,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public access to testimonials" ON testimonials;
CREATE POLICY "Deny all public access to testimonials" ON testimonials FOR ALL TO public USING (false);


-- 4.11. Table: aaradhanes
CREATE TABLE IF NOT EXISTS aaradhanes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    title text NOT NULL,
    guru_name text NOT NULL,
    dates text[] NOT NULL DEFAULT '{}',
    description text NOT NULL,
    significance text NOT NULL,
    rituals text[] NOT NULL DEFAULT '{}',
    offerings text[] NOT NULL DEFAULT '{}',
    image_url text NOT NULL,
    seva_details jsonb NOT NULL DEFAULT '[]',
    is_upcoming boolean NOT NULL DEFAULT false,
    display_order integer NOT NULL DEFAULT 0,
    created_by text NOT NULL,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE aaradhanes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public access to aaradhanes" ON aaradhanes;
CREATE POLICY "Deny all public access to aaradhanes" ON aaradhanes FOR ALL TO public USING (false);


-- 4.13. Table: volunteer_requests
CREATE TABLE IF NOT EXISTS volunteer_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firestore_id text UNIQUE,
    volunteer_id text NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    sex text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    address text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS update_volunteer_requests_updated_at ON volunteer_requests;
CREATE TRIGGER update_volunteer_requests_updated_at BEFORE UPDATE ON volunteer_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
ALTER TABLE volunteer_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Deny all public access to volunteer_requests" ON volunteer_requests;
CREATE POLICY "Deny all public access to volunteer_requests" ON volunteer_requests FOR ALL TO public USING (false);
