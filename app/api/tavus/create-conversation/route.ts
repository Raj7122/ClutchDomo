import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/serverSupabaseClient';
import { TavusClient } from '@/lib/tavusClient';

export async function POST(request: Request) {
  console.log('=== Create Tavus Conversation API Started ===');
  
  try {
    const { demoId, systemPrompt } = await request.json();
    
    if (!demoId) {
      return NextResponse.json({ error: 'Demo ID is required' }, { status: 400 });
    }

    console.log('Creating conversation for demo:', demoId);

    // Initialize Tavus client
    const tavusClient = new TavusClient();
    
    // Get replicas and personas
    const [replicas, personas] = await Promise.all([
      tavusClient.getReplicas(),
      tavusClient.getPersonas()
    ]);

    if (!replicas || replicas.length === 0) {
      throw new Error('No Tavus replicas available');
    }

    if (!personas || personas.length === 0) {
      throw new Error('No Tavus personas available');
    }

    const replica = replicas[0];
    const persona = personas[0];

    console.log('Using replica:', replica.replica_id);
    console.log('Using persona:', persona.persona_id);

    // Create conversation with custom system prompt
    const conversation = await tavusClient.createConversation(replica.replica_id, {
      demo_id: demoId,
      persona_id: persona.persona_id,
      custom_greeting: "Hello! I'm here to help you learn about our product. Feel free to ask me anything!",
      system_prompt: systemPrompt || "You are a helpful AI assistant representing this company. Answer questions about the products and services based on the provided context.",
      max_call_duration: 3600, // 1 hour
      participant_left_timeout: 60,
      participant_absent_timeout: 300,
      enable_recording: false
    });

    if (!conversation || !conversation.conversation_url) {
      throw new Error('Failed to create Tavus conversation');
    }

    console.log('Conversation created:', conversation.conversation_id);

    // Store conversation in database
    const supabase = createServerSupabaseClient();
    
    const { error: dbError } = await supabase
      .from('tavus_sessions')
      .insert({
        demo_id: demoId,
        conversation_id: conversation.conversation_id,
        conversation_url: conversation.conversation_url,
        session_status: 'active',
        created_at: new Date().toISOString()
      });

    if (dbError) {
      console.warn('Failed to store conversation in database:', dbError);
      // Don't fail the request if DB storage fails
    }

    return NextResponse.json({
      success: true,
      conversation_url: conversation.conversation_url,
      conversation_id: conversation.conversation_id
    });

  } catch (error) {
    console.error('Error creating Tavus conversation:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to create conversation',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
} 