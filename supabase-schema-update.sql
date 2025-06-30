-- Add missing is_active column to tavus_sessions table
ALTER TABLE tavus_sessions 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
