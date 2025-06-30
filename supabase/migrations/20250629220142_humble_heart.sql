/*
  # Tavus CVI Integration Schema

  1. New Tables
    - `tavus_sessions` - Store Tavus conversation sessions
    - `conversation_analytics` - Track conversation interactions
    - `demo_sessions` - Enhanced demo session analytics

  2. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users

  3. Indexes
    - Add performance indexes for analytics queries
*/

-- Create tavus_sessions table
CREATE TABLE IF NOT EXISTS tavus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_id uuid REFERENCES demos(id) ON DELETE CASCADE,
  tavus_conversation_id text UNIQUE NOT NULL,
  llm_model text DEFAULT 'tavus-gpt-4o',
  system_prompt text,
  visitor_name text,
  visitor_email text,
  session_status text DEFAULT 'active' CHECK (session_status IN ('active', 'completed', 'abandoned', 'error')),
  conversation_data jsonb DEFAULT '{}',
  session_duration_seconds integer,
  videos_played integer[] DEFAULT '{}',
  cta_shown boolean DEFAULT false,
  cta_clicked boolean DEFAULT false,
  voice_clone_used text,
  audio_quality_metrics jsonb,
  created_at timestamptz DEFAULT now(),
  ended_at timestamptz
);

-- Create conversation_analytics table
CREATE TABLE IF NOT EXISTS conversation_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tavus_session_id uuid REFERENCES tavus_sessions(id) ON DELETE CASCADE,
  user_message text,
  agent_response text,
  response_time_ms integer,
  user_sentiment float,
  agent_confidence float,
  action_taken text,
  audio_quality_score float,
  voice_emotion_detected text,
  llm_model_used text DEFAULT 'tavus-gpt-4o',
  timestamp timestamptz DEFAULT now()
);

-- Update demo_sessions table to include Tavus integration
DO $$
BEGIN
  -- Add tavus_session_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'demo_sessions' AND column_name = 'tavus_session_id'
  ) THEN
    ALTER TABLE demo_sessions ADD COLUMN tavus_session_id uuid REFERENCES tavus_sessions(id);
  END IF;

  -- Add engagement_score column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'demo_sessions' AND column_name = 'engagement_score'
  ) THEN
    ALTER TABLE demo_sessions ADD COLUMN engagement_score float;
  END IF;

  -- Add audio_interaction_quality column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'demo_sessions' AND column_name = 'audio_interaction_quality'
  ) THEN
    ALTER TABLE demo_sessions ADD COLUMN audio_interaction_quality float;
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE tavus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_analytics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tavus_sessions
CREATE POLICY "Demo owners can view their Tavus sessions"
  ON tavus_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM demos 
      WHERE demos.id = tavus_sessions.demo_id 
      AND demos.user_id = auth.uid()
    )
  );

-- Allow public insert for new sessions (visitors can create sessions)
CREATE POLICY "Anyone can create Tavus sessions"
  ON tavus_sessions FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Allow updates for session completion
CREATE POLICY "Sessions can be updated"
  ON tavus_sessions FOR UPDATE TO anon, authenticated
  USING (true);

-- Create RLS policies for conversation_analytics
CREATE POLICY "Demo owners can view conversation analytics"
  ON conversation_analytics FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tavus_sessions 
      JOIN demos ON demos.id = tavus_sessions.demo_id
      WHERE tavus_sessions.id = conversation_analytics.tavus_session_id 
      AND demos.user_id = auth.uid()
    )
  );

-- Allow public insert for analytics (visitors can create analytics)
CREATE POLICY "Anyone can create conversation analytics"
  ON conversation_analytics FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tavus_sessions_demo_id ON tavus_sessions(demo_id);
CREATE INDEX IF NOT EXISTS idx_tavus_sessions_conversation_id ON tavus_sessions(tavus_conversation_id);
CREATE INDEX IF NOT EXISTS idx_tavus_sessions_status ON tavus_sessions(session_status);
CREATE INDEX IF NOT EXISTS idx_conversation_analytics_session_id ON conversation_analytics(tavus_session_id);
CREATE INDEX IF NOT EXISTS idx_conversation_analytics_timestamp ON conversation_analytics(timestamp);
CREATE INDEX IF NOT EXISTS idx_demo_sessions_tavus_session ON demo_sessions(tavus_session_id);

-- Create function to update session updated timestamp
CREATE OR REPLACE FUNCTION update_tavus_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ended_at = CASE 
    WHEN NEW.session_status IN ('completed', 'abandoned', 'error') THEN now()
    ELSE NEW.ended_at
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for tavus_sessions table
CREATE TRIGGER update_tavus_sessions_ended_at
  BEFORE UPDATE ON tavus_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_tavus_session_updated_at();