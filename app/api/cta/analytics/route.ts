import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/serverSupabaseClient';

export async function POST(request: NextRequest) {
  console.log('=== CTA Analytics API Started ===');
  
  try {
    const { 
      demoId, 
      conversationId, 
      event, 
      ctaData,
      userBehavior,
      outcome 
    } = await request.json();

    if (!demoId || !event) {
      return NextResponse.json({ 
        error: 'Missing required parameters',
        details: 'demoId and event are required'
      }, { status: 400 });
    }

    console.log('Recording CTA analytics event:', event, 'for demo:', demoId);

    const supabase = createServerSupabaseClient();
    
    // Get session ID if conversation ID provided
    let sessionId = null;
    if (conversationId) {
      const { data: session } = await supabase
        .from('tavus_sessions')
        .select('id')
        .eq('tavus_conversation_id', conversationId)
        .single();
      
      sessionId = session?.id;
    }

    // Record CTA analytics event
    const analyticsData = {
      tavus_session_id: sessionId,
      user_message: `CTA Event: ${event}`,
      agent_response: ctaData?.message || null,
      action_taken: `cta_${event}`,
      timestamp: new Date().toISOString()
    };

    await supabase
      .from('conversation_analytics')
      .insert(analyticsData);

    // Update session data with CTA information
    if (sessionId) {
      const updateData: any = {};
      
      switch (event) {
        case 'shown':
          updateData.cta_shown = true;
          break;
        case 'clicked':
          updateData.cta_clicked = true;
          break;
      }

      if (Object.keys(updateData).length > 0) {
        await supabase
          .from('tavus_sessions')
          .update(updateData)
          .eq('id', sessionId);
      }
    }

    // Store detailed CTA analytics
    const ctaAnalyticsData = {
      demo_id: demoId,
      session_id: sessionId,
      event_type: event,
      trigger_reason: ctaData?.triggerReason || 'unknown',
      urgency_level: ctaData?.urgency || 'medium',
      user_behavior: userBehavior || {},
      outcome: outcome || event,
      timestamp: new Date().toISOString()
    };

    // In a real application, you might store this in a dedicated CTA analytics table
    console.log('CTA Analytics Data:', ctaAnalyticsData);

    console.log('CTA analytics event recorded successfully');

    return NextResponse.json({
      success: true,
      event,
      demoId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('=== CTA Analytics API Error ===');
    console.error('Error details:', error);
    
    return NextResponse.json({ 
      error: 'Failed to record CTA analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const demoId = searchParams.get('demoId');
    const timeframe = searchParams.get('timeframe') || '7d';

    if (!demoId) {
      return NextResponse.json({ 
        error: 'Demo ID is required' 
      }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    
    // Calculate date range
    const now = new Date();
    const daysBack = timeframe === '30d' ? 30 : timeframe === '7d' ? 7 : 1;
    const startDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));

    // Get CTA analytics for the demo
    const { data: sessions, error } = await supabase
      .from('tavus_sessions')
      .select(`
        id,
        cta_shown,
        cta_clicked,
        created_at,
        conversation_analytics(
          action_taken,
          timestamp
        )
      `)
      .eq('demo_id', demoId)
      .gte('created_at', startDate.toISOString());

    if (error) {
      throw error;
    }

    // Calculate CTA metrics
    const totalSessions = sessions?.length || 0;
    const ctaShownSessions = sessions?.filter(s => s.cta_shown).length || 0;
    const ctaClickedSessions = sessions?.filter(s => s.cta_clicked).length || 0;
    
    const ctaShowRate = totalSessions > 0 ? (ctaShownSessions / totalSessions) : 0;
    const ctaClickRate = ctaShownSessions > 0 ? (ctaClickedSessions / ctaShownSessions) : 0;
    const overallConversionRate = totalSessions > 0 ? (ctaClickedSessions / totalSessions) : 0;

    // Get daily breakdown
    const dailyData: { [key: string]: { shown: number; clicked: number; sessions: number } } = {};
    
    sessions?.forEach(session => {
      const date = new Date(session.created_at).toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = { shown: 0, clicked: 0, sessions: 0 };
      }
      dailyData[date].sessions++;
      if (session.cta_shown) dailyData[date].shown++;
      if (session.cta_clicked) dailyData[date].clicked++;
    });

    const analytics = {
      summary: {
        totalSessions,
        ctaShownSessions,
        ctaClickedSessions,
        ctaShowRate: Math.round(ctaShowRate * 100),
        ctaClickRate: Math.round(ctaClickRate * 100),
        overallConversionRate: Math.round(overallConversionRate * 100)
      },
      dailyBreakdown: Object.entries(dailyData).map(([date, data]) => ({
        date,
        ...data,
        showRate: data.sessions > 0 ? Math.round((data.shown / data.sessions) * 100) : 0,
        clickRate: data.shown > 0 ? Math.round((data.clicked / data.shown) * 100) : 0
      })),
      trends: {
        improving: ctaClickRate > 0.1, // 10% click rate threshold
        recommendation: ctaClickRate < 0.05 
          ? 'Consider adjusting CTA timing and messaging'
          : ctaClickRate > 0.2 
          ? 'Excellent CTA performance!'
          : 'Good CTA performance, room for optimization'
      }
    };

    return NextResponse.json({
      success: true,
      analytics,
      timeframe,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to get CTA analytics:', error);
    return NextResponse.json({ 
      error: 'Failed to get CTA analytics' 
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