import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/serverSupabaseClient';

export async function POST(request: NextRequest) {
  console.log('=== Agent Analytics API Started ===');
  
  try {
    const { conversationId, event, data } = await request.json();

    if (!conversationId || !event) {
      return NextResponse.json({ 
        error: 'Missing required parameters',
        details: 'conversationId and event are required'
      }, { status: 400 });
    }

    console.log('Recording analytics event:', event, 'for conversation:', conversationId);

    const supabase = createServerSupabaseClient();
    
    // Get session ID
    const { data: session, error: sessionError } = await supabase
      .from('tavus_sessions')
      .select('id, demo_id')
      .eq('tavus_conversation_id', conversationId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ 
        error: 'Session not found' 
      }, { status: 404 });
    }

    // Record analytics event
    await supabase
      .from('conversation_analytics')
      .insert({
        tavus_session_id: session.id,
        user_message: data.userMessage || null,
        agent_response: data.agentResponse || null,
        response_time_ms: data.responseTime || null,
        user_sentiment: data.userSentiment || null,
        agent_confidence: data.agentConfidence || null,
        action_taken: event,
        audio_quality_score: data.audioQuality || null,
        voice_emotion_detected: data.voiceEmotion || null,
        llm_model_used: data.llmModel || 'tavus-gpt-4o',
        timestamp: new Date().toISOString()
      });

    // Update session statistics
    await updateSessionStatistics(session.id, event, data);

    console.log('Analytics event recorded successfully');

    return NextResponse.json({
      success: true,
      event,
      conversationId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('=== Agent Analytics API Error ===');
    console.error('Error details:', error);
    
    return NextResponse.json({ 
      error: 'Failed to record analytics event',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const demoId = searchParams.get('demoId');

    if (!conversationId && !demoId) {
      return NextResponse.json({ 
        error: 'Either conversationId or demoId is required' 
      }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    
    let analytics;

    if (conversationId) {
      // Get analytics for specific conversation
      analytics = await getConversationAnalytics(conversationId, supabase);
    } else if (demoId) {
      // Get analytics for all conversations in a demo
      analytics = await getDemoAnalytics(demoId, supabase);
    }

    return NextResponse.json({
      success: true,
      analytics,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to get analytics:', error);
    return NextResponse.json({ 
      error: 'Failed to get analytics' 
    }, { status: 500 });
  }
}

// Update session statistics based on events
async function updateSessionStatistics(sessionId: string, event: string, data: any) {
  const supabase = createServerSupabaseClient();
  
  // Get current session data
  const { data: session } = await supabase
    .from('tavus_sessions')
    .select('conversation_data')
    .eq('id', sessionId)
    .single();

  if (!session) return;

  const currentData = session.conversation_data || {};
  const updates: any = {};

  // Update statistics based on event type
  switch (event) {
    case 'message_sent':
      updates.total_messages = (currentData.total_messages || 0) + 1;
      updates.last_message_time = new Date().toISOString();
      break;
      
    case 'video_played':
      updates.videos_watched = (currentData.videos_watched || 0) + 1;
      updates.last_video_time = new Date().toISOString();
      break;
      
    case 'cta_shown':
      updates.cta_shown_count = (currentData.cta_shown_count || 0) + 1;
      break;
      
    case 'cta_clicked':
      updates.cta_clicked_count = (currentData.cta_clicked_count || 0) + 1;
      break;
      
    case 'user_engaged':
      updates.engagement_events = (currentData.engagement_events || 0) + 1;
      updates.last_engagement_time = new Date().toISOString();
      break;
  }

  // Calculate engagement score
  if (Object.keys(updates).length > 0) {
    const engagementScore = calculateEngagementScore({
      ...currentData,
      ...updates
    });
    updates.engagement_score = engagementScore;
  }

  // Update session
  await supabase
    .from('tavus_sessions')
    .update({
      conversation_data: {
        ...currentData,
        ...updates
      }
    })
    .eq('id', sessionId);
}

// Get analytics for a specific conversation
async function getConversationAnalytics(conversationId: string, supabase: any) {
  // Get session data
  const { data: session } = await supabase
    .from('tavus_sessions')
    .select('*')
    .eq('tavus_conversation_id', conversationId)
    .single();

  if (!session) {
    throw new Error('Session not found');
  }

  // Get conversation events
  const { data: events } = await supabase
    .from('conversation_analytics')
    .select('*')
    .eq('tavus_session_id', session.id)
    .order('timestamp', { ascending: true });

  // Calculate metrics
  const metrics = calculateConversationMetrics(session, events || []);

  return {
    session: {
      id: session.id,
      conversationId: session.tavus_conversation_id,
      status: session.session_status,
      duration: session.session_duration_seconds,
      startTime: session.created_at,
      endTime: session.ended_at
    },
    metrics,
    events: events || [],
    summary: generateConversationSummary(session, events || [])
  };
}

// Get analytics for all conversations in a demo
async function getDemoAnalytics(demoId: string, supabase: any) {
  // Get all sessions for the demo
  const { data: sessions } = await supabase
    .from('tavus_sessions')
    .select('*')
    .eq('demo_id', demoId)
    .order('created_at', { ascending: false });

  if (!sessions || sessions.length === 0) {
    return {
      totalSessions: 0,
      metrics: {},
      sessions: []
    };
  }

  // Get all analytics events for these sessions
  const sessionIds = sessions.map((s: any) => s.id);
  const { data: allEvents } = await supabase
    .from('conversation_analytics')
    .select('*')
    .in('tavus_session_id', sessionIds)
    .order('timestamp', { ascending: true });

  // Calculate aggregate metrics
  const aggregateMetrics = calculateAggregateMetrics(sessions, allEvents || []);

  return {
    totalSessions: sessions.length,
    metrics: aggregateMetrics,
    sessions: sessions.map((session: any) => ({
      id: session.id,
      conversationId: session.tavus_conversation_id,
      status: session.session_status,
      duration: session.session_duration_seconds,
      engagementScore: session.conversation_data?.engagement_score || 0,
      startTime: session.created_at,
      endTime: session.ended_at
    })),
    summary: generateDemoSummary(sessions, allEvents || [])
  };
}

// Calculate conversation metrics
function calculateConversationMetrics(session: any, events: any[]) {
  const data = session.conversation_data || {};
  
  return {
    duration: session.session_duration_seconds || 0,
    messageCount: events.filter(e => e.user_message).length,
    responseCount: events.filter(e => e.agent_response).length,
    avgResponseTime: calculateAverageResponseTime(events),
    engagementScore: data.engagement_score || 0,
    videosWatched: data.videos_watched || 0,
    ctaShown: data.cta_shown_count || 0,
    ctaClicked: data.cta_clicked_count || 0,
    conversionRate: calculateConversionRate(data),
    userSentiment: calculateAverageSentiment(events),
    agentConfidence: calculateAverageConfidence(events)
  };
}

// Calculate aggregate metrics for demo
function calculateAggregateMetrics(sessions: any[], events: any[]) {
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter(s => s.session_status === 'completed').length;
  const totalDuration = sessions.reduce((sum, s) => sum + (s.session_duration_seconds || 0), 0);
  const totalMessages = events.filter(e => e.user_message).length;
  const totalVideosWatched = sessions.reduce((sum, s) => sum + (s.conversation_data?.videos_watched || 0), 0);
  const totalCTAClicks = sessions.reduce((sum, s) => sum + (s.conversation_data?.cta_clicked_count || 0), 0);
  
  return {
    totalSessions,
    completedSessions,
    completionRate: totalSessions > 0 ? (completedSessions / totalSessions) : 0,
    avgDuration: totalSessions > 0 ? (totalDuration / totalSessions) : 0,
    avgMessagesPerSession: totalSessions > 0 ? (totalMessages / totalSessions) : 0,
    avgVideosPerSession: totalSessions > 0 ? (totalVideosWatched / totalSessions) : 0,
    ctaConversionRate: totalSessions > 0 ? (totalCTAClicks / totalSessions) : 0,
    avgEngagementScore: calculateAverageEngagement(sessions),
    avgResponseTime: calculateAverageResponseTime(events),
    userSatisfaction: calculateUserSatisfaction(events)
  };
}

// Helper functions for calculations
function calculateAverageResponseTime(events: any[]): number {
  const responseTimes = events
    .filter(e => e.response_time_ms)
    .map(e => e.response_time_ms);
  
  return responseTimes.length > 0 
    ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
    : 0;
}

function calculateConversionRate(data: any): number {
  const ctaShown = data.cta_shown_count || 0;
  const ctaClicked = data.cta_clicked_count || 0;
  return ctaShown > 0 ? (ctaClicked / ctaShown) : 0;
}

function calculateAverageSentiment(events: any[]): number {
  const sentiments = events
    .filter(e => e.user_sentiment !== null)
    .map(e => e.user_sentiment);
  
  return sentiments.length > 0 
    ? sentiments.reduce((sum, sentiment) => sum + sentiment, 0) / sentiments.length 
    : 0;
}

function calculateAverageConfidence(events: any[]): number {
  const confidences = events
    .filter(e => e.agent_confidence !== null)
    .map(e => e.agent_confidence);
  
  return confidences.length > 0 
    ? confidences.reduce((sum, confidence) => sum + confidence, 0) / confidences.length 
    : 0;
}

function calculateAverageEngagement(sessions: any[]): number {
  const engagementScores = sessions
    .map(s => s.conversation_data?.engagement_score || 0)
    .filter(score => score > 0);
  
  return engagementScores.length > 0 
    ? engagementScores.reduce((sum, score) => sum + score, 0) / engagementScores.length 
    : 0;
}

function calculateUserSatisfaction(events: any[]): number {
  // Simple satisfaction calculation based on sentiment and engagement
  const avgSentiment = calculateAverageSentiment(events);
  const avgConfidence = calculateAverageConfidence(events);
  
  // Normalize to 0-1 scale
  const sentimentScore = (avgSentiment + 1) / 2; // Convert from -1,1 to 0,1
  const confidenceScore = avgConfidence; // Already 0-1
  
  return (sentimentScore + confidenceScore) / 2;
}

function calculateEngagementScore(data: any): number {
  let score = 0.5; // Base score
  
  // Message engagement
  const messageCount = data.total_messages || 0;
  if (messageCount > 5) score += 0.1;
  if (messageCount > 10) score += 0.1;
  
  // Video engagement
  const videosWatched = data.videos_watched || 0;
  if (videosWatched > 0) score += 0.2;
  if (videosWatched > 2) score += 0.1;
  
  // CTA engagement
  const ctaClicked = data.cta_clicked_count || 0;
  if (ctaClicked > 0) score += 0.2;
  
  // Time engagement (if available)
  const engagementEvents = data.engagement_events || 0;
  if (engagementEvents > 3) score += 0.1;
  
  return Math.min(1.0, score);
}

function generateConversationSummary(session: any, events: any[]) {
  const data = session.conversation_data || {};
  
  return {
    status: session.session_status,
    outcome: determineConversationOutcome(session, events),
    keyMoments: identifyKeyMoments(events),
    userIntent: inferUserIntent(events),
    nextSteps: suggestNextSteps(session, events)
  };
}

function generateDemoSummary(sessions: any[], events: any[]) {
  return {
    performance: 'good', // Simplified for now
    topPerformingFeatures: identifyTopFeatures(events),
    commonUserQuestions: identifyCommonQuestions(events),
    improvementAreas: identifyImprovementAreas(sessions, events),
    conversionFunnel: analyzeConversionFunnel(sessions)
  };
}

// Simplified helper functions
function determineConversationOutcome(session: any, events: any[]): string {
  if (session.cta_clicked) return 'converted';
  if (session.session_status === 'escalated') return 'escalated';
  if (events.length > 5) return 'engaged';
  return 'browsed';
}

function identifyKeyMoments(events: any[]): any[] {
  return events
    .filter(e => ['cta_shown', 'video_played', 'escalate_to_human'].includes(e.action_taken))
    .map(e => ({
      action: e.action_taken,
      timestamp: e.timestamp,
      context: e.user_message || e.agent_response
    }));
}

function inferUserIntent(events: any[]): string {
  const messages = events.map(e => e.user_message).filter(Boolean).join(' ').toLowerCase();
  
  if (messages.includes('price') || messages.includes('cost')) return 'pricing_inquiry';
  if (messages.includes('demo') || messages.includes('show')) return 'product_demo';
  if (messages.includes('buy') || messages.includes('purchase')) return 'purchase_intent';
  if (messages.includes('compare') || messages.includes('alternative')) return 'comparison';
  
  return 'general_inquiry';
}

function suggestNextSteps(session: any, events: any[]): string[] {
  const suggestions = [];
  
  if (!session.cta_clicked && session.conversation_data?.engagement_score > 0.7) {
    suggestions.push('Follow up with personalized demo offer');
  }
  
  if (session.session_status === 'escalated') {
    suggestions.push('Ensure human agent follows up within 24 hours');
  }
  
  if (session.conversation_data?.videos_watched > 2) {
    suggestions.push('Send detailed product information');
  }
  
  return suggestions;
}

function identifyTopFeatures(events: any[]): string[] {
  // Simplified - would analyze video plays and user questions
  return ['Dashboard', 'Analytics', 'Integrations'];
}

function identifyCommonQuestions(events: any[]): string[] {
  // Simplified - would analyze user messages
  return [
    'How much does it cost?',
    'What integrations are available?',
    'How do I get started?'
  ];
}

function identifyImprovementAreas(sessions: any[], events: any[]): string[] {
  const areas = [];
  
  const avgEngagement = calculateAverageEngagement(sessions);
  if (avgEngagement < 0.5) {
    areas.push('Improve initial engagement');
  }
  
  const avgResponseTime = calculateAverageResponseTime(events);
  if (avgResponseTime > 3000) {
    areas.push('Reduce response time');
  }
  
  return areas;
}

function analyzeConversionFunnel(sessions: any[]): any {
  const total = sessions.length;
  const engaged = sessions.filter(s => (s.conversation_data?.engagement_score || 0) > 0.5).length;
  const ctaShown = sessions.filter(s => s.cta_shown).length;
  const converted = sessions.filter(s => s.cta_clicked).length;
  
  return {
    total,
    engaged,
    ctaShown,
    converted,
    engagementRate: total > 0 ? engaged / total : 0,
    ctaRate: engaged > 0 ? ctaShown / engaged : 0,
    conversionRate: ctaShown > 0 ? converted / ctaShown : 0
  };
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