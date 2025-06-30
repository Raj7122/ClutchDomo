/*
  # Video Upload and Processing Schema

  1. New Tables
    - `videos` - Store video files and metadata
    - `transcripts` - Store video transcriptions from ElevenLabs
    - `audio_processing_jobs` - Track ElevenLabs processing jobs

  2. Storage
    - Create storage bucket for demo videos
    - Set up RLS policies for secure access

  3. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own content
*/

-- Create videos table
CREATE TABLE IF NOT EXISTS videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_id uuid REFERENCES demos(id) ON DELETE CASCADE,
  filename text NOT NULL,
  video_url text NOT NULL,
  order_index integer NOT NULL,
  duration_seconds integer,
  file_size_bytes bigint,
  thumbnail_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create transcripts table with ElevenLabs integration
CREATE TABLE IF NOT EXISTS transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid REFERENCES videos(id) ON DELETE CASCADE,
  transcript_text text NOT NULL,
  confidence_score float,
  timestamps jsonb, -- Word-level timestamps from ElevenLabs
  language_detected text,
  processing_metadata jsonb, -- ElevenLabs processing details
  audio_quality_score float, -- Audio quality analysis
  speaker_count integer,
  created_at timestamptz DEFAULT now()
);

-- Create audio processing jobs table
CREATE TABLE IF NOT EXISTS audio_processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL, -- 'transcription', 'voice_clone', 'tts'
  status text DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  input_data jsonb, -- Job parameters
  output_data jsonb, -- Results
  elevenlabs_job_id text, -- ElevenLabs job reference
  error_message text,
  processing_time_ms integer,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Enable Row Level Security
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_processing_jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for videos
CREATE POLICY "Users can manage videos in their demos"
  ON videos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM demos 
      WHERE demos.id = videos.demo_id 
      AND demos.user_id = auth.uid()
    )
  );

-- Create RLS policies for transcripts
CREATE POLICY "Users can view transcripts for their videos"
  ON transcripts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM videos 
      JOIN demos ON demos.id = videos.demo_id
      WHERE videos.id = transcripts.video_id 
      AND demos.user_id = auth.uid()
    )
  );

-- Create RLS policies for audio processing jobs
CREATE POLICY "Users can view their audio processing jobs"
  ON audio_processing_jobs
  FOR ALL
  TO authenticated
  USING (
    (input_data->>'user_id')::uuid = auth.uid()
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_videos_demo_id ON videos(demo_id);
CREATE INDEX IF NOT EXISTS idx_videos_order_index ON videos(demo_id, order_index);
CREATE INDEX IF NOT EXISTS idx_transcripts_video_id ON transcripts(video_id);
CREATE INDEX IF NOT EXISTS idx_audio_jobs_status ON audio_processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_audio_jobs_type ON audio_processing_jobs(job_type);

-- Create storage bucket for demo videos (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('demo-videos', 'demo-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
CREATE POLICY "Users can upload videos to their demos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'demo-videos' AND
    (storage.foldername(name))[1] IN (
      SELECT demos.id::text FROM demos WHERE demos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view videos from their demos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'demo-videos' AND
    (storage.foldername(name))[1] IN (
      SELECT demos.id::text FROM demos WHERE demos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update videos in their demos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'demo-videos' AND
    (storage.foldername(name))[1] IN (
      SELECT demos.id::text FROM demos WHERE demos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete videos from their demos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'demo-videos' AND
    (storage.foldername(name))[1] IN (
      SELECT demos.id::text FROM demos WHERE demos.user_id = auth.uid()
    )
  );

-- Create function to update video updated_at timestamp
CREATE OR REPLACE FUNCTION update_video_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for videos table
CREATE TRIGGER update_videos_updated_at
  BEFORE UPDATE ON videos
  FOR EACH ROW
  EXECUTE FUNCTION update_video_updated_at();