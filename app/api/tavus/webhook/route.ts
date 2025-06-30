import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/serverSupabaseClient';
import { TavusClient } from '@/lib/tavusClient';

// Verify webhook signature (implement based on Tavus documentation)
function verifyWebhookSignature(payload: string, signature: string): boolean {
  // TODO: Implement signature verification based on Tavus webhook security
  // For now, we'll skip verification in development
  if (process.env.NODE_ENV === 'development') {
    return true;
  }
  
  // In production, implement proper signature verification
  const expectedSignature = process.env.TAVUS_WEBHOOK_SECRET;
  return signature === expectedSignature;
}

export async function POST(request: NextRequest) {
  console.log('=== Tavus Webhook Received ===');
  
  try {
    const signature = request.headers.get('x-tavus-signature') || '';
    const payload = await request.text();
    
    // Verify webhook signature
    if (!verifyWebhookSignature(payload, signature)) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(payload);
    console.log('Webhook event:', event.event_type, event);

    const supabase = createServerSupabaseClient();
    const tavus = new TavusClient();

    switch (event.event_type) {
      case 'conversation.started':
        console.log('Conversation started:', event.conversation_id);
        
        // Update session status in database
        await supabase
          .from('tavus_sessions')
          .update({ 
            session_status: 'active',
            conversation_data: {
              ...event.properties,
              started_at: new Date().toISOString()
            }
          })
          .eq('tavus_conversation_id', event.conversation_id);
        
        // Send welcome message
        await tavus.sendMessage(event.conversation_id, 
          `Hello! I'm your AI sales assistant for ${event.properties?.demo_title || 'this product'}. I'm here to answer any questions you have and show you how our solution can help you. What would you like to know?`
        );
        
        break;

      case 'user.spoke':
        console.log('User spoke:', event.transcript);
        
        // Store user message in analytics
        await supabase
          .from('conversation_analytics')
          .insert({
            tavus_session_id: await getSessionId(event.conversation_id),
            user_message: event.transcript,
            timestamp: new Date().toISOString()
          });
        
        // Check for custom logic triggers
        const customResponse = await processCustomLogic(
          event.transcript,
          event.conversation_id,
          event.properties
        );
        
        if (customResponse) {
          // Send custom response
          await tavus.sendMessage(event.conversation_id, customResponse.text);
        }
        
        break;

      case 'agent.spoke':
        console.log('Agent spoke:', event.text);
        
        // Store AI response in analytics
        const sessionId = await getSessionId(event.conversation_id);
        await supabase
          .from('conversation_analytics')
          .insert({
            tavus_session_id: sessionId,
            agent_response: event.text,
            response_time_ms: event.response_time || 0,
            agent_confidence: event.confidence || 0.9,
            action_taken: event.action || 'speak',
            llm_model_used: 'tavus-gpt-4o',
            timestamp: new Date().toISOString()
          });
        
        break;

      case 'conversation.ended':
        console.log('Conversation ended:', event.conversation_id);
        
        // Update session with final data
        await supabase
          .from('tavus_sessions')
          .update({
            session_status: 'completed',
            session_duration_seconds: event.duration_seconds || 0,
            ended_at: new Date().toISOString(),
            conversation_data: {
              ...event.properties,
              ended_at: new Date().toISOString(),
              total_messages: event.message_count || 0
            }
          })
          .eq('tavus_conversation_id', event.conversation_id);
        
        // Create demo session record for analytics
        await supabase
          .from('demo_sessions')
          .insert({
            demo_id: event.properties?.demo_id,
            tavus_session_id: await getSessionId(event.conversation_id),
            session_duration_seconds: event.duration_seconds || 0,
            questions_asked: event.user_message_count || 0,
            videos_watched: event.videos_played?.length || 0,
            cta_clicked: event.cta_clicked || false,
            engagement_score: calculateEngagementScore(event),
            created_at: new Date().toISOString()
          });
        
        break;

      case 'error':
        console.error('Tavus error:', event.error);
        
        // Update session with error status
        await supabase
          .from('tavus_sessions')
          .update({
            session_status: 'error',
            conversation_data: {
              error: event.error,
              error_timestamp: new Date().toISOString()
            }
          })
          .eq('tavus_conversation_id', event.conversation_id);
        
        break;

      default:
        console.log('Unhandled event type:', event.event_type);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('=== Tavus Webhook Error ===');
    console.error('Error details:', error);
    
    return NextResponse.json({ 
      error: 'Webhook processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper function to get session ID from conversation ID
async function getSessionId(conversationId: string): Promise<string | null> {
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('tavus_sessions')
      .select('id')
      .eq('tavus_conversation_id', conversationId)
      .single();
    
    if (error || !data) {
      console.warn('Session not found for conversation:', conversationId);
      return null;
    }
    
    return data.id;
  } catch (error) {
    console.error('Error getting session ID:', error);
    return null;
  }
}

// Process custom logic for specific user inputs
async function processCustomLogic(
  userMessage: string, 
  conversationId: string, 
  properties: any
): Promise<{ text: string; emotion: string } | null> {
  const message = userMessage.toLowerCase();
  
  // Custom responses for specific triggers
  if (message.includes('price') || message.includes('cost') || message.includes('pricing')) {
    return {
      text: "Great question about pricing! Let me show you our pricing structure and help you find the plan that's perfect for your needs.",
      emotion: 'confident'
    };
  }
  
  if (message.includes('demo') || message.includes('show me')) {
    return {
      text: "I'd love to show you! Let me play a video that demonstrates exactly what you're asking about.",
      emotion: 'excited'
    };
  }
  
  if (message.includes('buy') || message.includes('purchase') || message.includes('get started')) {
    return {
      text: "That's fantastic! I'm excited to help you get started. Let me connect you with our team to set up your account.",
      emotion: 'excited'
    };
  }
  
  // No custom logic needed, let standard processing handle it
  return null;
}

// Calculate engagement score based on conversation metrics
function calculateEngagementScore(event: any): number {
  let score = 0;
  
  // Base score for completing conversation
  score += 20;
  
  // Points for duration (max 30 points for 5+ minutes)
  const durationMinutes = (event.duration_seconds || 0) / 60;
  score += Math.min(30, durationMinutes * 6);
  
  // Points for user messages (max 25 points for 10+ messages)
  const messageCount = event.user_message_count || 0;
  score += Math.min(25, messageCount * 2.5);
  
  // Points for videos watched (max 15 points for 3+ videos)
  const videosWatched = event.videos_played?.length || 0;
  score += Math.min(15, videosWatched * 5);
  
  // Bonus for CTA interaction
  if (event.cta_clicked) {
    score += 10;
  }
  
  return Math.min(100, Math.round(score));
}

// Handle preflight requests for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Tavus-Signature',
    },
  });
}