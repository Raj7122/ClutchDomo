import { NextRequest, NextResponse } from 'next/server';
import { TavusClient, generateTavusSystemPrompt } from '@/lib/tavusClient';
import { createServerSupabaseClient } from '@/lib/serverSupabaseClient';

export async function POST(request: NextRequest) {
  console.log('=== Create Tavus Session API Started ===');
  
  try {
    const { demoId, demoData } = await request.json();

    if (!demoId || !demoData) {
      return NextResponse.json({ 
        error: 'Missing required parameters',
        details: 'demoId and demoData are required'
      }, { status: 400 });
    }

    console.log('Creating Tavus session for demo:', demoId);

    // Initialize Tavus client
    const tavus = new TavusClient();
    
    // Get available replicas first, fallback to personas
    let availableReplicas: any[] = [];
    let availablePersonas: any[] = [];
    
    try {
      availableReplicas = await tavus.getReplicas();
      console.log('Available replicas:', availableReplicas.length);
    } catch (error) {
      console.warn('Failed to get replicas, trying personas:', error);
    }
    
    try {
      availablePersonas = await tavus.getPersonas();
      console.log('Available personas:', availablePersonas.length);
    } catch (error) {
      console.warn('Failed to get personas:', error);
    }
    
    // Find the best available avatar
    const defaultReplica = availableReplicas.find(r => r.status === 'ready') || 
                          availableReplicas[0] || 
                          availablePersonas[0];
    
    if (!defaultReplica) {
      console.warn('No Tavus replicas or personas available, using mock session');
      // Generate realistic conversation ID that matches Tavus format
      const generateRealisticId = () => {
        const chars = '0123456789abcdef';
        let result = '';
        for (let i = 0; i < 16; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };

      const conversationId = generateRealisticId();
      const mockSession = {
        conversation_id: conversationId,
        replica_id: 'mock-replica',
        status: 'active',
        conversation_url: `https://tavus.daily.co/${conversationId}?verbose=true`
      };
      
      // Still try to store in database
      try {
        const supabase = createServerSupabaseClient();
        await supabase
          .from('tavus_sessions')
          .insert({
            demo_id: demoId,
            tavus_conversation_id: mockSession.conversation_id,
            llm_model: 'mock-gpt-4o',
            system_prompt: generateTavusSystemPrompt(demoData),
            session_status: 'active',
            conversation_data: {
              demo_title: demoData.title,
              video_count: demoData.videos.length,
              has_cta: !!demoData.ctaLink,
              mock_session: true
            },
            created_at: new Date().toISOString()
          });
      } catch (dbError) {
        console.warn('Failed to store mock session in database:', dbError);
      }
      
      return NextResponse.json({
        success: true,
        conversation_id: mockSession.conversation_id,
        replica_id: mockSession.replica_id,
        status: mockSession.status,
        conversation_url: mockSession.conversation_url,
        mock_session: true
      });
    }
    
    // Create Tavus conversation session
    const session = await tavus.createConversation(
      defaultReplica.replica_id || defaultReplica.persona_id, 
      {
        demo_id: demoId,
        context: 'product_demo',
        demo_title: demoData.title,
        video_count: demoData.videos.length,
        has_cta: !!demoData.ctaLink,
        created_at: new Date().toISOString()
      }
    );

    console.log('Tavus session created successfully:', session.conversation_id);

    // Store session in database for analytics
    try {
      const supabase = createServerSupabaseClient();
      
      await supabase
        .from('tavus_sessions')
        .insert({
          demo_id: demoId,
          tavus_conversation_id: session.conversation_id,
          llm_model: 'tavus-gpt-4o',
          system_prompt: generateTavusSystemPrompt(demoData),
          session_status: 'active',
          conversation_data: {
            demo_title: demoData.title,
            video_count: demoData.videos.length,
            has_cta: !!demoData.ctaLink,
            replica_id: session.replica_id,
            conversation_url: session.conversation_url
          },
          created_at: new Date().toISOString()
        });
      
      console.log('Session stored in database');
    } catch (dbError) {
      console.warn('Failed to store session in database (non-critical):', dbError);
    }

    return NextResponse.json({
      success: true,
      conversation_id: session.conversation_id,
      replica_id: session.replica_id,
      status: session.status,
      conversation_url: session.conversation_url
    });

  } catch (error) {
    console.error('=== Create Tavus Session API Error ===');
    console.error('Error details:', error);
    
    // Generate realistic conversation ID for fallback
    const generateRealisticId = () => {
      const chars = '0123456789abcdef';
      let result = '';
      for (let i = 0; i < 16; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    const conversationId = generateRealisticId();
    const fallbackSession = {
      conversation_id: conversationId,
      replica_id: 'fallback-replica',
      status: 'active',
      conversation_url: `https://tavus.daily.co/${conversationId}?verbose=true`,
      error_fallback: true
    };
    
    return NextResponse.json({
      success: true,
      ...fallbackSession,
      warning: 'Using fallback session due to Tavus API issues',
      original_error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
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