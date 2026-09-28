-- Migration: Alter events table to allow nulls for description, location, and status

ALTER TABLE events
  ALTER COLUMN description DROP NOT NULL,
  ALTER COLUMN location DROP NOT NULL,
  ALTER COLUMN status DROP NOT NULL;
