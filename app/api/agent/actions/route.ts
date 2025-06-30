import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/serverSupabaseClient';
import { TavusClient, updateTavusContext } from '@/lib/tavusClient';

export async function POST(request: NextRequest) {
  console.log('=== Agent Actions API Started ===');
  
  try {
    const { conversationId, action, payload } = await request.json();

    if (!conversationId || !action) {
      return NextResponse.json({ 
        error: 'Missing required parameters',
        details: 'conversationId and action are required'
      }, { status: 400 });
    }

    console.log('Processing agent action:', action, 'for conversation:', conversationId);

    const supabase = createServerSupabaseClient();
    
    // Get conversation session
    const { data: session, error: sessionError } = await supabase
      .from('tavus_sessions')
      .select('*')
      .eq('tavus_conversation_id', conversationId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ 
        error: 'Session not found' 
      }, { status: 404 });
    }

    let result;

    // Handle different action types
    switch (action) {
      case 'trigger_video':
        result = await handleTriggerVideo(conversationId, payload, session);
        break;
        
      case 'show_cta':
        result = await handleShowCTA(conversationId, payload, session);
        break;
        
      case 'request_demo':
        result = await handleRequestDemo(conversationId, payload, session);
        break;
        
      case 'collect_lead':
        result = await handleCollectLead(conversationId, payload, session);
        break;
        
      case 'escalate_to_human':
        result = await handleEscalateToHuman(conversationId, payload, session);
        break;
        
      case 'provide_pricing':
        result = await handleProvidePricing(conversationId, payload, session);
        break;
        
      case 'schedule_meeting':
        result = await handleScheduleMeeting(conversationId, payload, session);
        break;
        
      default:
        return NextResponse.json({ 
          error: 'Unknown action type',
          supportedActions: [
            'trigger_video', 'show_cta', 'request_demo', 'collect_lead',
            'escalate_to_human', 'provide_pricing', 'schedule_meeting'
          ]
        }, { status: 400 });
    }

    // Track action in analytics
    await supabase
      .from('conversation_analytics')
      .insert({
        tavus_session_id: session.id,
        user_message: `Action triggered: ${action}`,
        agent_response: result.message || 'Action completed',
        action_taken: action,
        timestamp: new Date().toISOString()
      });

    console.log('Agent action completed successfully:', action);

    return NextResponse.json({
      success: true,
      action,
      result,
      conversationId
    });

  } catch (error) {
    console.error('=== Agent Actions API Error ===');
    console.error('Error details:', error);
    
    return NextResponse.json({ 
      error: 'Failed to process agent action',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Trigger specific video playback
async function handleTriggerVideo(conversationId: string, payload: any, session: any) {
  console.log('Triggering video:', payload);
  
  const tavus = new TavusClient();
  
  // Send message to trigger video
  await tavus.sendMessage(conversationId, 
    payload.message || `Let me show you this video that demonstrates ${payload.videoTitle || 'our key features'}.`,
    { 
      emotion: 'excited',
      action: 'play_video'
    }
  );

  // Update Tavus context with video index
  await updateTavusContext(conversationId, { 
    last_triggered_video_index: payload.videoIndex 
  });

  // Update session data
  const supabase = createServerSupabaseClient();
  await supabase
    .from('tavus_sessions')
    .update({
      conversation_data: {
        ...session.conversation_data,
        last_triggered_video: payload.videoIndex,
        video_trigger_reason: payload.reason || 'agent_recommendation'
      }
    })
    .eq('id', session.id);

  return {
    message: 'Video trigger sent successfully',
    videoIndex: payload.videoIndex,
    videoTitle: payload.videoTitle
  };
}

// Show call-to-action
async function handleShowCTA(conversationId: string, payload: any, session: any) {
  console.log('Showing CTA:', payload);
  
  const tavus = new TavusClient();
  
  // Send CTA message
  await tavus.sendMessage(conversationId,
    payload.message || "I think you'd be a great fit for our solution! Would you like to get started?",
    { 
      emotion: 'confident',
      action: 'show_cta'
    }
  );

  // Update session with CTA data
  const supabase = createServerSupabaseClient();
  await supabase
    .from('tavus_sessions')
    .update({
      cta_shown: true,
      conversation_data: {
        ...session.conversation_data,
        cta_type: payload.ctaType || 'general',
        cta_message: payload.message,
        cta_urgency: payload.urgency || 'medium'
      }
    })
    .eq('id', session.id);

  return {
    message: 'CTA displayed successfully',
    ctaType: payload.ctaType || 'general'
  };
}

// Request personalized demo
async function handleRequestDemo(conversationId: string, payload: any, session: any) {
  console.log('Requesting demo:', payload);
  
  const tavus = new TavusClient();
  
  await tavus.sendMessage(conversationId,
    "I'd love to show you a personalized demo! Let me connect you with our team to schedule a session tailored to your specific needs.",
    { emotion: 'enthusiastic' }
  );

  return {
    message: 'Demo request initiated',
    demoType: payload.demoType || 'personalized'
  };
}

// Collect lead information
async function handleCollectLead(conversationId: string, payload: any, session: any) {
  console.log('Collecting lead:', payload);
  
  const tavus = new TavusClient();
  
  // Store lead information
  const supabase = createServerSupabaseClient();
  
  if (payload.leadData) {
    await supabase
      .from('tavus_sessions')
      .update({
        visitor_name: payload.leadData.name,
        visitor_email: payload.leadData.email,
        conversation_data: {
          ...session.conversation_data,
          lead_data: payload.leadData,
          lead_source: 'tavus_conversation',
          lead_quality: payload.leadQuality || 'medium'
        }
      })
      .eq('id', session.id);
  }

  await tavus.sendMessage(conversationId,
    `Thank you ${payload.leadData?.name || ''}! I have your information and someone from our team will reach out to you soon.`,
    { emotion: 'grateful' }
  );

  return {
    message: 'Lead information collected',
    leadData: payload.leadData
  };
}

// Escalate to human agent
async function handleEscalateToHuman(conversationId: string, payload: any, session: any) {
  console.log('Escalating to human:', payload);
  
  const tavus = new TavusClient();
  
  await tavus.sendMessage(conversationId,
    "I understand you'd like to speak with someone from our team. Let me connect you with one of our specialists who can provide more detailed assistance.",
    { emotion: 'helpful' }
  );

  // Update session status
  const supabase = createServerSupabaseClient();
  await supabase
    .from('tavus_sessions')
    .update({
      session_status: 'escalated',
      conversation_data: {
        ...session.conversation_data,
        escalation_reason: payload.reason || 'user_request',
        escalation_timestamp: new Date().toISOString()
      }
    })
    .eq('id', session.id);

  return {
    message: 'Escalation to human agent initiated',
    reason: payload.reason || 'user_request'
  };
}

// Provide pricing information
async function handleProvidePricing(conversationId: string, payload: any, session: any) {
  console.log('Providing pricing:', payload);
  
  const tavus = new TavusClient();
  
  // Get demo data to extract pricing info
  const supabase = createServerSupabaseClient();
  const { data: demo } = await supabase
    .from('demos')
    .select('knowledge_base_content')
    .eq('id', session.demo_id)
    .single();

  // Extract pricing from knowledge base
  const pricingInfo = extractPricingInfo(demo?.knowledge_base_content || '');
  
  const pricingMessage = pricingInfo || 
    "Our pricing is designed to scale with your needs. Let me connect you with our team to discuss the best plan for your specific requirements.";

  await tavus.sendMessage(conversationId, pricingMessage, { emotion: 'confident' });

  return {
    message: 'Pricing information provided',
    hasPricingData: !!pricingInfo
  };
}

// Schedule meeting
async function handleScheduleMeeting(conversationId: string, payload: any, session: any) {
  console.log('Scheduling meeting:', payload);
  
  const tavus = new TavusClient();
  
  await tavus.sendMessage(conversationId,
    "Perfect! I'd be happy to help you schedule a meeting with our team. Let me get you connected with our calendar system.",
    { emotion: 'helpful' }
  );

  // Update session with meeting request
  const supabase = createServerSupabaseClient();
  await supabase
    .from('tavus_sessions')
    .update({
      conversation_data: {
        ...session.conversation_data,
        meeting_requested: true,
        meeting_type: payload.meetingType || 'demo',
        preferred_time: payload.preferredTime,
        meeting_timestamp: new Date().toISOString()
      }
    })
    .eq('id', session.id);

  return {
    message: 'Meeting scheduling initiated',
    meetingType: payload.meetingType || 'demo'
  };
}

// Helper function to extract pricing info from knowledge base
function extractPricingInfo(knowledgeBase: string): string | null {
  const pricingKeywords = ['price', 'cost', 'plan', 'subscription', 'billing', '$', 'free', 'premium', 'pricing'];
  const sentences = knowledgeBase.split(/[.!?]+/);
  
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    if (pricingKeywords.some(keyword => lowerSentence.includes(keyword))) {
      return sentence.trim() + '.';
    }
  }
  return null;
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