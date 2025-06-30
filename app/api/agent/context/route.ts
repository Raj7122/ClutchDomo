import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/serverSupabaseClient';
import { TavusClient, updateTavusContext } from '@/lib/tavusClient';

export async function POST(request: NextRequest) {
  console.log('=== Agent Context Update API Started ===');
  
  try {
    const { conversationId, context, action } = await request.json();

    if (!conversationId) {
      return NextResponse.json({ 
        error: 'Missing required parameters',
        details: 'conversationId is required'
      }, { status: 400 });
    }

    console.log('Updating agent context for conversation:', conversationId);

    const supabase = createServerSupabaseClient();
    
    // Get conversation session from database
    const { data: session, error: sessionError } = await supabase
      .from('tavus_sessions')
      .select('*')
      .eq('tavus_conversation_id', conversationId)
      .single();

    if (sessionError || !session) {
      console.error('Session not found:', sessionError);
      return NextResponse.json({ 
        error: 'Session not found' 
      }, { status: 404 });
    }

    // Handle different context update actions
    switch (action) {
      case 'update_demo_state':
        await handleDemoStateUpdate(conversationId, context, session);
        break;
        
      case 'video_played':
        await handleVideoPlayed(conversationId, context, session);
        break;
        
      case 'user_engagement':
        await handleUserEngagement(conversationId, context, session);
        break;
        
      case 'cta_interaction':
        await handleCTAInteraction(conversationId, context, session);
        break;
        
      default:
        // Generic context update
        await updateTavusContext(conversationId, context);
    }

    // Update session data in database
    const updatedConversationData = {
      ...session.conversation_data,
      ...context,
      last_updated: new Date().toISOString()
    };

    await supabase
      .from('tavus_sessions')
      .update({
        conversation_data: updatedConversationData,
        session_status: context.status || session.session_status
      })
      .eq('id', session.id);

    console.log('Agent context updated successfully');

    return NextResponse.json({
      success: true,
      message: 'Context updated successfully',
      conversationId,
      action
    });

  } catch (error) {
    console.error('=== Agent Context Update API Error ===');
    console.error('Error details:', error);
    
    return NextResponse.json({ 
      error: 'Failed to update agent context',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Handle demo state updates (video progress, current section, etc.)
async function handleDemoStateUpdate(conversationId: string, context: any, session: any) {
  console.log('Handling demo state update:', context);
  
  const tavus = new TavusClient();
  
  // Update Tavus conversation with new demo state
  await tavus.updateConversation(conversationId, {
    properties: {
      ...session.conversation_data,
      current_video_index: context.currentVideoIndex,
      video_progress: context.videoProgress,
      user_interests: context.userInterests || [],
      engagement_level: context.engagementLevel || 'medium',
      demo_section: context.demoSection || 'introduction'
    }
  });

  // If user has shown specific interests, update the system prompt context
  if (context.userInterests && context.userInterests.length > 0) {
    const contextualPrompt = generateContextualPrompt(context.userInterests, session);
    
    // Send contextual message to guide conversation
    await tavus.sendMessage(conversationId, 
      `Based on your interests in ${context.userInterests.join(', ')}, let me show you the most relevant features.`,
      { emotion: 'excited' }
    );
  }
}

// Handle video playback events
async function handleVideoPlayed(conversationId: string, context: any, session: any) {
  console.log('Handling video played event:', context);
  
  const supabase = createServerSupabaseClient();
  
  // Track video play in analytics
  await supabase
    .from('conversation_analytics')
    .insert({
      tavus_session_id: session.id,
      user_message: `Video ${context.videoIndex} played: ${context.videoTitle}`,
      agent_response: 'Video playback initiated',
      action_taken: 'play_video',
      timestamp: new Date().toISOString()
    });

  // Update session with played videos
  const playedVideos = session.conversation_data.videos_played || [];
  if (!playedVideos.includes(context.videoIndex)) {
    playedVideos.push(context.videoIndex);
    
    await updateTavusContext(conversationId, {
      videos_played: playedVideos,
      last_video_played: context.videoIndex,
      last_video_title: context.videoTitle
    });
  }
}

// Handle user engagement metrics
async function handleUserEngagement(conversationId: string, context: any, session: any) {
  console.log('Handling user engagement update:', context);
  
  const supabase = createServerSupabaseClient();
  
  // Calculate engagement score
  const engagementScore = calculateEngagementScore(context, session);
  
  // Update session with engagement data
  await supabase
    .from('tavus_sessions')
    .update({
      conversation_data: {
        ...session.conversation_data,
        engagement_score: engagementScore,
        interaction_count: (session.conversation_data.interaction_count || 0) + 1,
        last_interaction: new Date().toISOString()
      }
    })
    .eq('id', session.id);

  // Adjust AI behavior based on engagement
  if (engagementScore > 0.8) {
    // High engagement - be more detailed and technical
    await updateTavusContext(conversationId, {
      response_style: 'detailed',
      technical_level: 'advanced',
      enthusiasm: 'high'
    });
  } else if (engagementScore < 0.4) {
    // Low engagement - try to re-engage
    await updateTavusContext(conversationId, {
      response_style: 'concise',
      technical_level: 'basic',
      enthusiasm: 'moderate',
      re_engagement_needed: true
    });
  }
}

// Handle CTA interactions
async function handleCTAInteraction(conversationId: string, context: any, session: any) {
  console.log('Handling CTA interaction:', context);
  
  const supabase = createServerSupabaseClient();
  
  // Track CTA interaction
  await supabase
    .from('conversation_analytics')
    .insert({
      tavus_session_id: session.id,
      user_message: `CTA interaction: ${context.ctaType}`,
      agent_response: 'CTA engagement tracked',
      action_taken: 'cta_interaction',
      timestamp: new Date().toISOString()
    });

  // Update session with CTA data
  await supabase
    .from('tavus_sessions')
    .update({
      cta_shown: true,
      cta_clicked: context.clicked || false,
      conversation_data: {
        ...session.conversation_data,
        cta_type: context.ctaType,
        cta_timestamp: new Date().toISOString(),
        conversion_intent: context.clicked ? 'high' : 'medium'
      }
    })
    .eq('id', session.id);

  // If CTA was clicked, trigger follow-up
  if (context.clicked) {
    const tavus = new TavusClient();
    await tavus.sendMessage(conversationId,
      "That's fantastic! I'm excited to help you get started. Let me connect you with our team to ensure you have everything you need.",
      { emotion: 'excited' }
    );
  }
}

// Generate contextual prompt based on user interests
function generateContextualPrompt(interests: string[], session: any): string {
  const basePrompt = session.system_prompt || '';
  
  const contextualAddition = `

CURRENT USER CONTEXT:
- Expressed interests: ${interests.join(', ')}
- Engagement level: High (actively exploring specific features)
- Recommendation: Focus on ${interests[0]} and related capabilities
- Tone: Enthusiastic and detailed for interested topics

PRIORITY RESPONSES:
1. Address ${interests[0]} specifically with relevant video demonstrations
2. Connect features to user's expressed needs
3. Provide detailed explanations for areas of interest
4. Suggest next steps based on their interests`;

  return basePrompt + contextualAddition;
}

// Calculate engagement score based on user behavior
function calculateEngagementScore(context: any, session: any): number {
  let score = 0.5; // Base score
  
  // Video engagement
  if (context.videosWatched > 0) score += 0.2;
  if (context.videoCompletionRate > 0.7) score += 0.1;
  
  // Message engagement
  if (context.messagesExchanged > 5) score += 0.1;
  if (context.avgMessageLength > 20) score += 0.1;
  
  // Time engagement
  if (context.sessionDuration > 120) score += 0.1; // 2+ minutes
  if (context.sessionDuration > 300) score += 0.1; // 5+ minutes
  
  // Interaction quality
  if (context.questionsAsked > 2) score += 0.1;
  if (context.specificFeatureInquiries > 0) score += 0.1;
  
  // Cap at 1.0
  return Math.min(1.0, score);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ 
        error: 'Missing conversationId parameter' 
      }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    
    // Get current context
    const { data: session, error } = await supabase
      .from('tavus_sessions')
      .select('*')
      .eq('tavus_conversation_id', conversationId)
      .single();

    if (error || !session) {
      return NextResponse.json({ 
        error: 'Session not found' 
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      context: session.conversation_data,
      status: session.session_status,
      lastUpdated: session.conversation_data?.last_updated
    });

  } catch (error) {
    console.error('Failed to get agent context:', error);
    return NextResponse.json({ 
      error: 'Failed to get context' 
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