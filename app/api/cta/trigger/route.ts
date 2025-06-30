import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/serverSupabaseClient';
import { ctaLogicEngine, UserBehavior } from '@/lib/ctaLogic';

export async function POST(request: NextRequest) {
  console.log('=== CTA Trigger API Started ===');
  
  try {
    const { 
      demoId, 
      conversationId, 
      userBehavior, 
      userMessage, 
      aiResponse,
      forceShow = false 
    } = await request.json();

    if (!demoId) {
      return NextResponse.json({ 
        error: 'Missing required parameters',
        details: 'demoId is required'
      }, { status: 400 });
    }

    console.log('Processing CTA trigger for demo:', demoId);

    const supabase = createServerSupabaseClient();
    
    // Get demo data for context
    const { data: demo, error: demoError } = await supabase
      .from('demos')
      .select('*')
      .eq('id', demoId)
      .single();

    if (demoError || !demo) {
      return NextResponse.json({ 
        error: 'Demo not found' 
      }, { status: 404 });
    }

    // Process conversation for CTA signals if provided
    let conversionSignals: string[] = [];
    if (userMessage && aiResponse) {
      conversionSignals = ctaLogicEngine.processConversationForCTA(userMessage, aiResponse);
    }

    // Enhanced user behavior with conversion signals
    const enhancedBehavior: UserBehavior = {
      sessionDuration: userBehavior?.sessionDuration || 0,
      videosWatched: userBehavior?.videosWatched || 0,
      questionsAsked: userBehavior?.questionsAsked || 0,
      engagementScore: userBehavior?.engagementScore || 0,
      lastInteractionTime: Date.now(),
      messagesSent: userBehavior?.messagesSent || 0,
      specificInterests: userBehavior?.specificInterests || [],
      conversionSignals: [...(userBehavior?.conversionSignals || []), ...conversionSignals]
    };

    // Determine if CTA should be triggered
    let ctaTrigger = null;
    if (forceShow) {
      ctaTrigger = {
        type: 'ai_recommended' as const,
        urgency: 'medium' as const,
        reason: 'AI recommendation',
        confidence: 0.8,
        timing: 'immediate' as const
      };
    } else {
      ctaTrigger = ctaLogicEngine.shouldTriggerCTA(enhancedBehavior);
    }

    if (!ctaTrigger) {
      return NextResponse.json({
        shouldShow: false,
        reason: 'No trigger conditions met',
        userBehavior: enhancedBehavior
      });
    }

    // Track CTA trigger analytics
    ctaLogicEngine.trackCTAEvent({
      triggerType: ctaTrigger.type,
      userBehavior: enhancedBehavior,
      outcome: 'shown'
    });

    // Store CTA event in database for analytics
    if (conversationId) {
      try {
        const { data: session } = await supabase
          .from('tavus_sessions')
          .select('id')
          .eq('tavus_conversation_id', conversationId)
          .single();

        if (session) {
          await supabase
            .from('conversation_analytics')
            .insert({
              tavus_session_id: session.id,
              user_message: userMessage || null,
              agent_response: aiResponse || null,
              action_taken: 'cta_triggered',
              timestamp: new Date().toISOString()
            });
        }
      } catch (analyticsError) {
        console.warn('Failed to store CTA analytics (non-critical):', analyticsError);
      }
    }

    console.log('CTA trigger determined:', ctaTrigger);

    return NextResponse.json({
      shouldShow: true,
      trigger: ctaTrigger,
      userBehavior: enhancedBehavior,
      demoData: {
        title: demo.title,
        ctaLink: demo.cta_link
      }
    });

  } catch (error) {
    console.error('=== CTA Trigger API Error ===');
    console.error('Error details:', error);
    
    return NextResponse.json({ 
      error: 'Failed to process CTA trigger',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const demoId = searchParams.get('demoId');

    if (!demoId) {
      return NextResponse.json({ 
        error: 'Demo ID is required' 
      }, { status: 400 });
    }

    // Get CTA performance metrics for the demo
    const metrics = ctaLogicEngine.getCTAMetrics();

    return NextResponse.json({
      success: true,
      metrics,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to get CTA metrics:', error);
    return NextResponse.json({ 
      error: 'Failed to get CTA metrics' 
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