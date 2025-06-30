import { NextRequest, NextResponse } from 'next/server';
import { TavusClient, generateTavusSystemPrompt } from '@/lib/tavusClient';
import { createServerSupabaseClient } from '@/lib/serverSupabaseClient';
import { SupabaseClient } from '@supabase/supabase-js';
import { getDefaultReplicaId, validateReplicaId } from '@/lib/replicaUtils';

interface TavusSessionData {
  id?: string;
  conversation_id?: string;
  replica_id?: string;
  status?: string;
  conversation_url?: string;
  demo_id?: string;
  agent_id?: string;
  created_at?: string;
  updated_at?: string;
  is_active?: boolean;
  is_mock?: boolean;
  metadata?: any;
}

interface DemoData {
  title: string;
  videos: any[];
  ctaLink?: string;
  persona_id?: string;
  replica_id?: string;
  context?: string;
  max_call_duration?: number;
  enable_recording?: boolean;
  knowledgeBase: string;
}

interface RequestBody {
  demoId: string;
  demoData: DemoData;
}

/**
 * Tavus Session API with Enterprise-Grade Concurrency Control
 *
 * This implementation uses multiple layers of race condition prevention:
 * 1. In-memory mutex locks to prevent parallel processing of same demo ID
 * 2. Request deduplication cache to prevent duplicate API calls
 * 3. Database checks for existing sessions before creating new ones
 * 4. Double-check after lock acquisition to handle race conditions
 */

// Strong concurrency control using process-wide locks
const activeLocks = new Map<string, boolean>();

// Request deduplication cache with TTL
const sessionCache = new Map<string, {timestamp: number, data: any}>();
const CACHE_TTL_MS = 10000; // 10 second deduplication window

// Helper function to generate consistent keys
const getSessionCacheKey = (demoId: string): string => `session-${demoId}`;
const getLockKey = (demoId: string): string => `lock-${demoId}`;

// Generate a realistic-looking conversation ID for fallbacks
const generateRealisticId = (): string => {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Mutex lock implementation
const acquireLock = (demoId: string): boolean => {
  const lockKey = getLockKey(demoId);
  if (activeLocks.has(lockKey)) {
    console.log(`CONCURRENCY: Lock exists for demo ${demoId}, preventing concurrent creation`);
    return false;
  }
  activeLocks.set(lockKey, true);
  console.log(`CONCURRENCY: Lock acquired for demo ${demoId}`);
  return true;
};

const releaseLock = (demoId: string): void => {
  const lockKey = getLockKey(demoId);
  if (activeLocks.has(lockKey)) {
    activeLocks.delete(lockKey);
    console.log(`CONCURRENCY: Lock released for demo ${demoId}`);
  }
};

// Helper function to end all active Tavus conversations to manage concurrency
const endAllActiveConversations = async (supabase: SupabaseClient): Promise<void> => {
  console.log('CONCURRENCY: Checking for and ending all active Tavus conversations.');
  const tavus = new TavusClient();

  try {
    // Query for all active sessions
    const { data: activeSessions, error } = await supabase
      .from('tavus_sessions')
      .select('conversation_id, is_active')
      .eq('is_active', true);

    if (error) {
      // Gracefully handle if the 'is_active' column doesn't exist
      if (error.code === '42703') { // "column does not exist" in PostgreSQL
        console.warn('CONCURRENCY: `is_active` column not found, cannot clean up sessions automatically. Skipping cleanup.');
        return;
      }
      console.error('CONCURRENCY: Error querying for active sessions:', error);
      return;
    }

    if (!activeSessions || activeSessions.length === 0) {
      console.log('CONCURRENCY: No active sessions found to clean up.');
      return;
    }

    console.log(`CONCURRENCY: Found ${activeSessions.length} active session(s) to end.`);

    // Create an array of promises for ending conversations and updating DB
    const cleanupPromises = activeSessions.map(async (session) => {
      try {
        console.log(`CONCURRENCY: Ending conversation ${session.conversation_id}`);
        await tavus.endConversation(session.conversation_id);

        console.log(`CONCURRENCY: Updating session ${session.conversation_id} to inactive in DB.`);
        await supabase
          .from('tavus_sessions')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('conversation_id', session.conversation_id);
      } catch (cleanupError) {
        console.error(`CONCURRENCY: Failed to clean up session ${session.conversation_id}:`, cleanupError);
        // Also mark as inactive in DB even if API call fails, to prevent retries
        try {
          await supabase
            .from('tavus_sessions')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('conversation_id', session.conversation_id);
        } catch (dbError) {
          console.error(`CONCURRENCY: DB update failed for ${session.conversation_id} after API error:`, dbError);
        }
      }
    });

    // Wait for all cleanup tasks to complete
    await Promise.all(cleanupPromises);
    console.log('CONCURRENCY: Finished cleaning up all active sessions.');

  } catch (e) {
    console.error('CONCURRENCY: An unexpected error occurred during active session cleanup:', e);
  }
};

export async function GET(request: NextRequest) {
  console.log('=== Get Tavus Session API Started ===');
  const { searchParams } = new URL(request.url);
  const demoId = searchParams.get('demoId');

  if (!demoId) {
    return NextResponse.json({ error: 'Missing demoId parameter' }, { status: 400 });
  }

  console.log(`GET: Checking for active session for demo: ${demoId}`);

  try {
    const supabase = createServerSupabaseClient();
    
    const { data: sessions, error } = await supabase
      .from('tavus_sessions')
      .select('*')
      .eq('demo_id', demoId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('GET: Database query error:', error);
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
    }

    if (sessions && sessions.length > 0) {
      const latestSession = sessions[0];
      
      // If is_active column exists, check its value. If not, assume active.
      const isActive = latestSession.hasOwnProperty('is_active') 
        ? latestSession.is_active 
        : true;

      if (isActive) {
        console.log('GET: Found existing active session:', latestSession.conversation_id);
        return NextResponse.json(latestSession);
      }
    }
    
    // If no sessions found, or the latest is not active
    console.log('GET: No active session found for demo:', demoId);
    return NextResponse.json({ message: 'No active session found' }, { status: 404 });

  } catch (error) {
    console.error('GET: Unhandled error fetching Tavus session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  console.log('=== Create Tavus Session API Started ===');
  let demoId: string | null = null;
  let lockAcquired = false;

  try {
    // 1. PARSE AND VALIDATE REQUEST
    const requestBody = await request.json() as RequestBody;
    const { demoId: parsedDemoId, demoData } = requestBody;
    demoId = parsedDemoId;

    if (!demoId || !demoData || !demoData.title || !demoData.videos || !demoData.knowledgeBase) {
      return NextResponse.json({
        error: 'Missing required parameters',
        details: 'demoId, title, videos and knowledgeBase are required'
      }, { status: 400 });
    }
    console.log('Creating Tavus session for demo:', demoId);

    const supabase = createServerSupabaseClient();

    // 2. CHECK FOR EXISTING ACTIVE SESSION (PRE-LOCK)
    const { data: existingSessions } = await supabase
      .from('tavus_sessions')
      .select('*')
      .eq('demo_id', demoId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (existingSessions && existingSessions.length > 0) {
      console.log('Found existing active session in database:', existingSessions[0].conversation_id);
      return NextResponse.json({ success: true, ...existingSessions[0] });
    }

    // 3. CHECK CACHE
    const cachedSession = sessionCache.get(getSessionCacheKey(demoId));
    if (cachedSession && (Date.now() - cachedSession.timestamp < CACHE_TTL_MS)) {
      console.log('Using cached session from recent request:', cachedSession.data.conversation_id);
      return NextResponse.json(cachedSession.data);
    }

    // 4. ACQUIRE LOCK
    if (!acquireLock(demoId)) {
      return NextResponse.json({
        success: false,
        error: 'Session creation already in progress',
      }, { status: 409 });
    }
    lockAcquired = true;

    // 5. CLEAN UP OLD SESSIONS
    await endAllActiveConversations(supabase);

    // 6. DOUBLE-CHECK FOR SESSION (POST-LOCK)
    const { data: raceConditionSessions } = await supabase
      .from('tavus_sessions')
      .select('*')
      .eq('demo_id', demoId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (raceConditionSessions && raceConditionSessions.length > 0) {
      console.log('After lock: found session that was just created:', raceConditionSessions[0].conversation_id);
      return NextResponse.json({ success: true, ...raceConditionSessions[0] });
    }

    // This inner try-catch specifically handles failures in the Tavus API call,
    // allowing for a graceful fallback to a mock session.
    try {
      // 7. CREATE NEW TAVUS CONVERSATION
      console.log('Creating new Tavus conversation');
      const tavus = new TavusClient();
      const defaultReplicaId = getDefaultReplicaId();
      let replicaId = demoData.replica_id || defaultReplicaId;
      if (demoData.replica_id && demoData.replica_id !== defaultReplicaId) {
        const isValid = await validateReplicaId(demoData.replica_id);
        if (!isValid) {
          console.warn(`Provided replica ID ${demoData.replica_id} is invalid, falling back to default.`);
          replicaId = defaultReplicaId;
        }
      }
      
      const newTavusSession = await tavus.createConversation(
        replicaId,
        {
          demo_id: demoId,
          persona_id: demoData.persona_id,
          context: demoData.context || 'product_demo',
          demo_title: demoData.title,
          video_count: demoData.videos?.length || 0,
          has_cta: !!demoData.ctaLink,
          created_at: new Date().toISOString()
        }
      );
      console.log('Tavus session created successfully:', newTavusSession.conversation_id);

      // 8. STORE NEW SESSION IN DATABASE
      const sessionDataToStore = {
        demo_id: demoId,
        conversation_id: newTavusSession.conversation_id,
        conversation_url: newTavusSession.conversation_url || '',
        replica_id: newTavusSession.replica_id || replicaId,
        llm_model: 'tavus-gpt-4o',
        system_prompt: generateTavusSystemPrompt(demoData),
        conversation_data: JSON.stringify({
          demo_title: demoData.title,
          video_count: demoData.videos?.length || 0,
          has_cta: !!demoData.ctaLink,
          replica_id: newTavusSession.replica_id,
          conversation_url: newTavusSession.conversation_url
        }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true,
        is_mock: false,
      };

      const { error: dbError } = await supabase
        .from('tavus_sessions')
        .insert(sessionDataToStore);

      if (dbError) {
        console.error('CRITICAL: Failed to store session in database.', dbError);
        await tavus.endConversation(newTavusSession.conversation_id);
        throw new Error(`Database insertion failed: ${dbError.message}`);
      }
      console.log('Session stored in database');

      // 9. PREPARE AND CACHE RESPONSE
      const responseData = { success: true, ...sessionDataToStore };
      sessionCache.set(getSessionCacheKey(demoId), { data: responseData, timestamp: Date.now() });
      return NextResponse.json(responseData);

    } catch (tavusError) {
      console.warn('Tavus API call or subsequent DB write failed, creating a mock session.', tavusError);

      const mockSession = {
        conversation_id: generateRealisticId(),
        replica_id: 'mock-replica',
        status: 'active',
        conversation_url: `https://tavus.daily.co/${generateRealisticId()}?mock=true`,
        is_mock: true,
      };
      
      console.warn('Database insertion for mock session is temporarily disabled.');

      return NextResponse.json({
        ...mockSession,
        warning: 'Using mock session due to Tavus API issues. DB insert disabled.',
        original_error: tavusError instanceof Error ? tavusError.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('An unexpected error occurred in the create-session endpoint:', error);
    
    return NextResponse.json({
      success: false,
      error: 'An internal server error occurred.',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });

  } finally {
    if (lockAcquired && demoId) {
      releaseLock(demoId);
    }
  }
}


// Handle preflight requests for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
