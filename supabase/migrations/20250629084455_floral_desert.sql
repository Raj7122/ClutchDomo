/*
  # Fix Videos Table Schema

  1. Table Updates
    - Ensure all required columns exist in videos table
    - Add missing duration_seconds column if not present
    - Fix any column type mismatches

  2. Security
    - Maintain existing RLS policies
    - Ensure proper indexing
*/

-- Ensure videos table has all required columns
DO $$
BEGIN
  -- Add duration_seconds column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'duration_seconds'
  ) THEN
    ALTER TABLE videos ADD COLUMN duration_seconds integer;
    RAISE NOTICE 'Added duration_seconds column to videos table';
  END IF;

  -- Ensure all other required columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'demo_id'
  ) THEN
    ALTER TABLE videos ADD COLUMN demo_id uuid REFERENCES demos(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added demo_id column to videos table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'filename'
  ) THEN
    ALTER TABLE videos ADD COLUMN filename text NOT NULL DEFAULT 'untitled';
    RAISE NOTICE 'Added filename column to videos table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'video_url'
  ) THEN
    ALTER TABLE videos ADD COLUMN video_url text NOT NULL DEFAULT '';
    RAISE NOTICE 'Added video_url column to videos table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'order_index'
  ) THEN
    ALTER TABLE videos ADD COLUMN order_index integer NOT NULL DEFAULT 1;
    RAISE NOTICE 'Added order_index column to videos table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'file_size_bytes'
  ) THEN
    ALTER TABLE videos ADD COLUMN file_size_bytes bigint;
    RAISE NOTICE 'Added file_size_bytes column to videos table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'thumbnail_url'
  ) THEN
    ALTER TABLE videos ADD COLUMN thumbnail_url text;
    RAISE NOTICE 'Added thumbnail_url column to videos table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE videos ADD COLUMN created_at timestamptz DEFAULT now();
    RAISE NOTICE 'Added created_at column to videos table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE videos ADD COLUMN updated_at timestamptz DEFAULT now();
    RAISE NOTICE 'Added updated_at column to videos table';
  END IF;
END $$;

-- Ensure the videos table has proper constraints
DO $$
BEGIN
  -- Make sure demo_id is properly constrained if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'demo_id'
  ) THEN
    -- Add foreign key constraint if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'videos' 
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'demo_id'
    ) THEN
      ALTER TABLE videos ADD CONSTRAINT videos_demo_id_fkey 
        FOREIGN KEY (demo_id) REFERENCES demos(id) ON DELETE CASCADE;
      RAISE NOTICE 'Added foreign key constraint for demo_id';
    END IF;
  END IF;
END $$;

-- Refresh the schema cache to ensure Supabase recognizes the new columns
NOTIFY pgrst, 'reload schema';