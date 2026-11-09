-- Migration: Create members table
-- This table stores member information for the temple.
CREATE TABLE members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id text UNIQUE,
  member_id text UNIQUE,
  name text NOT NULL,
  phone text,
  sex text DEFAULT 'Male',
  active boolean NOT NULL DEFAULT true,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- Deny all public access (service-role only)
CREATE POLICY "Deny all public access to members"
  ON members
  FOR ALL
  TO public
  USING (false);
