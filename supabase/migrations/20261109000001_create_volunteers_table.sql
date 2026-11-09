-- Migration: Create volunteers table
-- This table stores volunteer information for the temple.
CREATE TABLE volunteers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id text UNIQUE,
  volunteer_id text UNIQUE,
  name text NOT NULL,
  phone text,
  sex text DEFAULT 'Male',
  active boolean NOT NULL DEFAULT true,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE volunteers ENABLE ROW LEVEL SECURITY;

-- Deny all public access (service-role only)
CREATE POLICY "Deny all public access to volunteers"
  ON volunteers
  FOR ALL
  TO public
  USING (false);
