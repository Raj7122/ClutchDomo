-- Create tavus_sessions table
CREATE TABLE IF NOT EXISTS tavus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_id uuid REFERENCES demos(id) ON DELETE CASCADE,
  conversation_id text UNIQUE NOT NULL,
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
  updated_at timestamptz,
  ended_at timestamptz,
  is_active BOOLEAN DEFAULT true,
  replica_id TEXT
);

-- Create indexes for tavus_sessions
CREATE INDEX IF NOT EXISTS idx_tavus_sessions_demo_id ON tavus_sessions(demo_id);
CREATE INDEX IF NOT EXISTS idx_tavus_sessions_conversation_id ON tavus_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_tavus_sessions_status ON tavus_sessions(session_status);
CREATE INDEX IF NOT EXISTS idx_tavus_sessions_is_active ON tavus_sessions(is_active);

-- Create RLS policies for tavus_sessions
CREATE POLICY "Users can view tavus sessions for their demos"
  ON tavus_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM demos 
      WHERE demos.id = tavus_sessions.demo_id 
      AND demos.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can insert tavus sessions"
  ON tavus_sessions FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update tavus sessions"
  ON tavus_sessions FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Enable Row Level Security
ALTER TABLE tavus_sessions ENABLE ROW LEVEL SECURITY;

-- Create trigger for tavus_sessions table
CREATE OR REPLACE FUNCTION set_ended_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.session_status IN ('completed', 'abandoned', 'error') AND OLD.session_status = 'active' THEN
    NEW.ended_at = NOW();
    NEW.is_active = false;
    
    -- Calculate session duration if ending the session
    IF NEW.created_at IS NOT NULL THEN
      NEW.session_duration_seconds = EXTRACT(EPOCH FROM (NOW() - NEW.created_at))::integer;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tavus_sessions_ended_at
  BEFORE UPDATE ON tavus_sessions
  FOR EACH ROW
  EXECUTE FUNCTION set_ended_at();
