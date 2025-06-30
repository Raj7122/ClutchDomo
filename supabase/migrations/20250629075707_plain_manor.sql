/*
  # Fix Missing Database Columns and Tables

  1. Add missing demo_id column to videos table
  2. Ensure all required tables exist with proper structure
  3. Add missing indexes and constraints
  4. Fix any structural issues

  This migration fixes the database schema to match the application requirements.
*/

-- First, check if demos table exists, if not create it
CREATE TABLE IF NOT EXISTS demos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'ready', 'published')),
  cta_link text,
  knowledge_base_filename text,
  knowledge_base_content text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add demo_id column to videos table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'demo_id'
  ) THEN
    ALTER TABLE videos ADD COLUMN demo_id uuid REFERENCES demos(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Ensure knowledge_base_chunks table exists
CREATE TABLE IF NOT EXISTS knowledge_base_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_id uuid REFERENCES demos(id) ON DELETE CASCADE,
  content text NOT NULL,
  chunk_index integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Update videos table structure to ensure all columns exist
DO $$
BEGIN
  -- Add missing columns to videos table if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'filename'
  ) THEN
    ALTER TABLE videos ADD COLUMN filename text NOT NULL DEFAULT 'untitled';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'video_url'
  ) THEN
    ALTER TABLE videos ADD COLUMN video_url text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'order_index'
  ) THEN
    ALTER TABLE videos ADD COLUMN order_index integer NOT NULL DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'file_size_bytes'
  ) THEN
    ALTER TABLE videos ADD COLUMN file_size_bytes bigint;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'thumbnail_url'
  ) THEN
    ALTER TABLE videos ADD COLUMN thumbnail_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE videos ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE videos ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Enable Row Level Security on all tables
ALTER TABLE demos ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_processing_jobs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can manage their own demos" ON demos;
DROP POLICY IF EXISTS "Users can manage KB chunks in their demos" ON knowledge_base_chunks;
DROP POLICY IF EXISTS "Users can manage videos in their demos" ON videos;
DROP POLICY IF EXISTS "Users can view transcripts for their videos" ON transcripts;
DROP POLICY IF EXISTS "Users can view their audio processing jobs" ON audio_processing_jobs;

-- Create RLS policies
CREATE POLICY "Users can manage their own demos"
  ON demos FOR ALL TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage KB chunks in their demos"
  ON knowledge_base_chunks FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM demos 
      WHERE demos.id = knowledge_base_chunks.demo_id 
      AND demos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage videos in their demos"
  ON videos FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM demos 
      WHERE demos.id = videos.demo_id 
      AND demos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view transcripts for their videos"
  ON transcripts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM videos 
      JOIN demos ON demos.id = videos.demo_id
      WHERE videos.id = transcripts.video_id 
      AND demos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their audio processing jobs"
  ON audio_processing_jobs FOR ALL TO authenticated
  USING ((input_data->>'user_id')::uuid = auth.uid());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_demos_user_id ON demos(user_id);
CREATE INDEX IF NOT EXISTS idx_demos_status ON demos(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_chunks_demo_id ON knowledge_base_chunks(demo_id);
CREATE INDEX IF NOT EXISTS idx_videos_demo_id ON videos(demo_id);
CREATE INDEX IF NOT EXISTS idx_videos_order_index ON videos(demo_id, order_index);
CREATE INDEX IF NOT EXISTS idx_transcripts_video_id ON transcripts(video_id);
CREATE INDEX IF NOT EXISTS idx_audio_jobs_status ON audio_processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_audio_jobs_type ON audio_processing_jobs(job_type);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_demos_updated_at ON demos;
DROP TRIGGER IF EXISTS update_videos_updated_at ON videos;

-- Create triggers for updated_at
CREATE TRIGGER update_demos_updated_at
  BEFORE UPDATE ON demos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_videos_updated_at
  BEFORE UPDATE ON videos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Ensure storage bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('demo-videos', 'demo-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies to avoid conflicts
DROP POLICY IF EXISTS "Users can upload videos to their demos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view videos from their demos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update videos in their demos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete videos from their demos" ON storage.objects;

-- Create storage policies
CREATE POLICY "Users can upload videos to their demos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'demo-videos' AND
    (storage.foldername(name))[1] IN (
      SELECT demos.id::text FROM demos WHERE demos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view videos from their demos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'demo-videos' AND
    (storage.foldername(name))[1] IN (
      SELECT demos.id::text FROM demos WHERE demos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update videos in their demos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'demo-videos' AND
    (storage.foldername(name))[1] IN (
      SELECT demos.id::text FROM demos WHERE demos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete videos from their demos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'demo-videos' AND
    (storage.foldername(name))[1] IN (
      SELECT demos.id::text FROM demos WHERE demos.user_id = auth.uid()
    )
  );