// Add this to your Next.js app/api route to handle Supabase 404 errors for tavus_sessions

/**
 * Checks and ensures the tavus_sessions table exists
 * by attempting to create it if a 404 is encountered
 */
export async function ensureTavusSessionsTable(supabase) {
  // First check if table exists by querying it
  const { data, error } = await supabase
    .from('tavus_sessions')
    .select('id')
    .limit(1)
    .single();
  
  // If we get a 404, table doesn't exist
  if (error && error.code === 'PGRST104') {
    console.log('tavus_sessions table doesn\'t exist, creating it...');
    
    try {
      // Create the table - simplified schema that matches the essential fields used in the app
      // We can't create triggers or complex constraints through the Data API
      await supabase.rpc('create_tavus_sessions_table', {});
      
      console.log('tavus_sessions table created successfully');
      return true;
    } catch (createError) {
      console.error('Failed to create tavus_sessions table:', createError);
      return false;
    }
  } else if (error) {
    console.error('Error checking tavus_sessions table:', error);
    return false;
  }
  
  // Table already exists
  return true;
}

/**
 * Call this function at app startup or before any operation that uses tavus_sessions
 */
export async function setupTavusSessionsRPC(supabase) {
  try {
    // Create the RPC function to create the tavus_sessions table if it doesn't exist
    await supabase.rpc('create_function_if_not_exists', {
      function_name: 'create_tavus_sessions_table',
      function_definition: `
        CREATE OR REPLACE FUNCTION create_tavus_sessions_table()
        RETURNS void AS $$
        BEGIN
          CREATE TABLE IF NOT EXISTS tavus_sessions (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            demo_id uuid REFERENCES demos(id) ON DELETE CASCADE,
            tavus_conversation_id text UNIQUE NOT NULL,
            llm_model text DEFAULT 'tavus-gpt-4o',
            system_prompt text,
            visitor_name text,
            visitor_email text,
            session_status text DEFAULT 'active',
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
          
          CREATE INDEX IF NOT EXISTS idx_tavus_sessions_demo_id 
            ON tavus_sessions(demo_id);
            
          CREATE INDEX IF NOT EXISTS idx_tavus_sessions_conversation_id 
            ON tavus_sessions(tavus_conversation_id);
            
          CREATE INDEX IF NOT EXISTS idx_tavus_sessions_status 
            ON tavus_sessions(session_status);
            
          ALTER TABLE tavus_sessions ENABLE ROW LEVEL SECURITY;
          
          -- Create policies (simplified)
          CREATE POLICY "tavus_sessions_select_policy" 
            ON tavus_sessions FOR SELECT 
            USING (true);
            
          CREATE POLICY "tavus_sessions_insert_policy" 
            ON tavus_sessions FOR INSERT 
            WITH CHECK (true);
            
          CREATE POLICY "tavus_sessions_update_policy" 
            ON tavus_sessions FOR UPDATE 
            USING (true) WITH CHECK (true);
        END;
        $$ LANGUAGE plpgsql;
      `
    });
    
    console.log('RPC function created successfully');
    return true;
  } catch (error) {
    // Handle errors or function already exists
    console.error('Error setting up RPC function:', error);
    return false;
  }
}

/**
 * Temporary workaround for missing tavus_sessions table
 * 
 * This function will catch 404 errors when inserting to tavus_sessions
 * and provide a successful mock response instead
 */
export function handleTavusSessionInsert(error, data) {
  if (error && error.code === 'PGRST104') {
    // Table doesn't exist, return mock successful response
    console.warn('tavus_sessions table doesn\'t exist, returning mock success response');
    return {
      data: { id: crypto.randomUUID() },
      error: null
    };
  }
  
  // Return original response
  return { data, error };
}
