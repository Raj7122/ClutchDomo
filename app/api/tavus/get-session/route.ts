import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/serverSupabaseClient';

/**
 * GET API handler to retrieve an existing Tavus session for a demo
 * This route is used by the frontend to check for existing sessions
 * during race conditions
 */
export async function GET(request: NextRequest) {
  // Get demo ID from query params
  const url = new URL(request.url);
  const demoId = url.searchParams.get('demoId');
  
  if (!demoId) {
    return Response.json({ error: 'Missing demoId parameter' }, { status: 400 });
  }
  
  try {
    console.log(`Checking for existing session for demo: ${demoId}`);
    
    // Initialize Supabase client
    const supabase = createServerSupabaseClient();
    
    // Query for existing sessions with graceful handling of is_active column
    const response = await supabase
      .from('tavus_sessions')
      .select('*')
      .eq('demo_id', demoId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    // Check if session exists and is active (if column exists)
    let session = null;
    if (response.data && response.data.length > 0) {
      // If is_active column exists and is false, consider no session
      const isActive = response.data[0].hasOwnProperty('is_active') 
        ? response.data[0].is_active 
        : true;
      
      session = isActive ? response.data[0] : null;
    }
    
    if (session) {
      // Parse JSON string back to object if needed
      if (typeof session.conversation_data === 'string') {
        try {
          session.conversation_data = JSON.parse(session.conversation_data);
        } catch (e) {
          console.warn('Failed to parse conversation_data JSON:', e);
        }
      }
      
      console.log(`Found existing session: ${session.conversation_id}`);
      return Response.json(session);
    } else {
      console.log('No active session found');
      return Response.json({ error: 'No active session found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error getting session:', error);
    return Response.json({ error: 'Failed to get session' }, { status: 500 });
  }
}

/**
 * Handle preflight requests for CORS
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}
