import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/serverSupabaseClient';

export async function GET(request: NextRequest) {
  try {
    // Initialize Supabase client with enhanced error handling
    const supabase = createServerSupabaseClient();
    
    const { searchParams } = new URL(request.url);
    const demoId = searchParams.get('id');

    if (!demoId) {
      return NextResponse.json({ error: 'Demo ID is required' }, { status: 400 });
    }

    // Get demo details (only published demos)
    const { data: demo, error: demoError } = await supabase
      .from('demos')
      .select('*')
      .eq('id', demoId)
      .eq('status', 'published')
      .single();

    if (demoError || !demo) {
      return NextResponse.json({ 
        error: 'Demo not found or not published' 
      }, { status: 404 });
    }

    // Get videos for this demo
    const { data: videos, error: videosError } = await supabase
      .from('videos')
      .select('*')
      .eq('demo_id', demoId)
      .order('order_index', { ascending: true });

    if (videosError) {
      console.error('Videos fetch error:', videosError);
      return NextResponse.json({ 
        error: 'Failed to fetch videos' 
      }, { status: 500 });
    }

    // Get knowledge base chunks
    const { data: knowledgeBase, error: kbError } = await supabase
      .from('knowledge_base_chunks')
      .select('*')
      .eq('demo_id', demoId)
      .order('chunk_index', { ascending: true });

    if (kbError) {
      console.error('Knowledge base fetch error:', kbError);
      return NextResponse.json({ 
        error: 'Failed to fetch knowledge base' 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        demo,
        videos: videos || [],
        knowledgeBase: knowledgeBase || []
      }
    });

  } catch (error) {
    console.error('View demo API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// Handle preflight requests for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}