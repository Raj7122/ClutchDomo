import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/serverSupabaseClient';

export async function POST(request: NextRequest) {
  try {
    // Initialize Supabase client with enhanced error handling
    const supabase = createServerSupabaseClient();
    
    const { demoId, event, metadata } = await request.json();

    if (!demoId || !event) {
      return NextResponse.json({ 
        error: 'Demo ID and event type are required' 
      }, { status: 400 });
    }

    // Verify demo exists and is published
    const { data: demo, error: demoError } = await supabase
      .from('demos')
      .select('id, status')
      .eq('id', demoId)
      .eq('status', 'published')
      .single();

    if (demoError || !demo) {
      return NextResponse.json({ 
        error: 'Demo not found or not published' 
      }, { status: 404 });
    }

    // For now, we'll simulate analytics tracking
    // In a real application, you'd store this in an analytics table
    console.log('Analytics Event:', {
      demoId,
      event,
      metadata,
      timestamp: new Date().toISOString()
    });

    // Simulate view count (in production, you'd query actual analytics data)
    let totalViews = 0;
    let totalInteractions = 0;

    if (event === 'view') {
      totalViews = Math.floor(Math.random() * 100) + 1;
    }

    if (event === 'video_play' || event === 'chat_message') {
      totalInteractions = Math.floor(Math.random() * 50) + 1;
    }

    return NextResponse.json({
      success: true,
      data: {
        event,
        demoId,
        timestamp: new Date().toISOString(),
        totalViews,
        totalInteractions
      }
    });

  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Initialize Supabase client with enhanced error handling
    const supabase = createServerSupabaseClient();
    
    const { searchParams } = new URL(request.url);
    const demoId = searchParams.get('demoId');

    if (!demoId) {
      return NextResponse.json({ 
        error: 'Demo ID is required' 
      }, { status: 400 });
    }

    // Verify demo exists
    const { data: demo, error: demoError } = await supabase
      .from('demos')
      .select('id, status')
      .eq('id', demoId)
      .single();

    if (demoError || !demo) {
      return NextResponse.json({ 
        error: 'Demo not found' 
      }, { status: 404 });
    }

    // Simulate analytics data (in production, you'd query actual analytics)
    const analyticsData = {
      totalViews: Math.floor(Math.random() * 500) + 50,
      totalInteractions: Math.floor(Math.random() * 200) + 20,
      averageWatchTime: Math.floor(Math.random() * 300) + 60, // seconds
      conversionRate: (Math.random() * 0.1 + 0.02).toFixed(3), // 2-12%
      topVideos: [
        { videoId: 'video-1', title: 'Product Overview', views: 45 },
        { videoId: 'video-2', title: 'Getting Started', views: 32 },
        { videoId: 'video-3', title: 'Advanced Features', views: 28 }
      ],
      commonQuestions: [
        'How much does it cost?',
        'What integrations are available?',
        'How do I get started?',
        'What are the key features?'
      ]
    };

    return NextResponse.json({
      success: true,
      data: analyticsData
    });

  } catch (error) {
    console.error('Analytics GET API error:', error);
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}