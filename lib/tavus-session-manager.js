/**
 * Tavus Session Manager - Intelligent session management with knowledge base integration
 * 
 * This module provides optimized functions for managing Tavus video agent conversations,
 * linking them with knowledge base content and video data, and storing the session
 * metadata in the newly created tavus_sessions table.
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Tavus API client
import TavusClient from './tavusClient';
const tavusClient = new TavusClient();

/**
 * Creates a new Tavus session and links it with knowledge base content and video data
 * 
 * @param {Object} params - Parameters for creating the Tavus session
 * @param {string} params.demoId - ID of the demo to link the session to
 * @param {string} params.visitorName - Optional name of the visitor
 * @param {string} params.visitorEmail - Optional email of the visitor
 * @param {Array<Object>} params.knowledgeBaseItems - Array of knowledge base items to link
 * @param {Array<Object>} params.videoItems - Array of video items to link
 * @returns {Promise<Object>} - The created session object
 */
export async function createTavusSessionWithContent({
  demoId,
  visitorName,
  visitorEmail,
  knowledgeBaseItems = [],
  videoItems = []
}) {
  try {
    console.log(`Creating Tavus session for demo: ${demoId}`);
    
    // Get available replicas and personas from Tavus
    const [replicas, personas] = await Promise.all([
      tavusClient.getReplicas(),
      tavusClient.getPersonas()
    ]);
    
    console.log(`Available replicas: ${replicas.length}`);
    console.log(`Available personas: ${personas.length}`);
    
    // Select first replica and persona or use mock data if none available
    const replicaId = replicas[0]?.replica_id || 'mock-replica-1';
    const personaId = personas[0]?.persona_id || 'mock-persona-1';
    
    console.log(`Using replica: ${replicaId}`);
    console.log(`Using persona: ${personaId}`);
    
    // Create conversation with Tavus API
    const conversation = await tavusClient.createConversation({
      replica_id: replicaId,
      persona_id: personaId
    });
    
    const conversationId = conversation.conversation_id;
    console.log(`Tavus conversation created: ${conversationId}`);
    
    // Prepare knowledge base and video content to embed in the conversation context
    const contextualKnowledge = knowledgeBaseItems.map(item => ({
      type: 'knowledge_base',
      id: item.id,
      content: item.content,
      title: item.title
    }));
    
    const videoContent = videoItems.map(video => ({
      type: 'video',
      id: video.id,
      title: video.title,
      url: video.url,
      thumbnail: video.thumbnail,
      duration: video.duration
    }));
    
    // Create combined conversation data
    const conversationData = {
      context: [...contextualKnowledge, ...videoContent],
      metadata: {
        demo_id: demoId,
        created_at: new Date().toISOString()
      }
    };
    
    // Store the session in Supabase
    const { data: session, error } = await supabase
      .from('tavus_sessions')
      .insert([{
        demo_id: demoId,
        tavus_conversation_id: conversationId,
        visitor_name: visitorName,
        visitor_email: visitorEmail,
        conversation_data: conversationData,
        videos_played: [],
        session_status: 'active',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) {
      console.error('Error storing Tavus session:', error);
      throw new Error(`Failed to store Tavus session: ${error.message}`);
    }
    
    console.log('Tavus session stored successfully:', session.id);
    
    return {
      sessionId: session.id,
      conversationId: conversationId,
      replicaId: replicaId,
      personaId: personaId,
      knowledgeBaseCount: contextualKnowledge.length,
      videoCount: videoContent.length
    };
  } catch (error) {
    console.error('Error creating Tavus session:', error);
    throw error;
  }
}

/**
 * Updates a Tavus session with information about video playback and CTAs
 * 
 * @param {Object} params - Parameters for updating the session
 * @param {string} params.sessionId - ID of the session to update
 * @param {string} params.videoId - ID of the video that was played
 * @param {boolean} params.ctaShown - Whether a CTA was shown
 * @param {boolean} params.ctaClicked - Whether a CTA was clicked
 * @returns {Promise<Object>} - The updated session
 */
export async function updateTavusSessionActivity({
  sessionId,
  videoId,
  ctaShown = false, 
  ctaClicked = false
}) {
  try {
    // First get the current session data
    const { data: currentSession, error: fetchError } = await supabase
      .from('tavus_sessions')
      .select('videos_played, cta_shown, cta_clicked')
      .eq('id', sessionId)
      .single();
    
    if (fetchError) {
      console.error('Error fetching session:', fetchError);
      throw new Error(`Failed to fetch session ${sessionId}: ${fetchError.message}`);
    }
    
    // Update the videos played array if a new video ID was provided
    let videosPlayed = [...(currentSession.videos_played || [])];
    if (videoId && !videosPlayed.includes(videoId)) {
      videosPlayed.push(videoId);
    }
    
    // Update the session with new data
    const { data: updatedSession, error: updateError } = await supabase
      .from('tavus_sessions')
      .update({
        videos_played: videosPlayed,
        cta_shown: ctaShown || currentSession.cta_shown,
        cta_clicked: ctaClicked || currentSession.cta_clicked,
      })
      .eq('id', sessionId)
      .select()
      .single();
    
    if (updateError) {
      console.error('Error updating session:', updateError);
      throw new Error(`Failed to update session ${sessionId}: ${updateError.message}`);
    }
    
    console.log(`Session ${sessionId} updated successfully`);
    
    return updatedSession;
  } catch (error) {
    console.error('Error updating Tavus session activity:', error);
    throw error;
  }
}

/**
 * Completes a Tavus session and calculates engagement metrics
 * 
 * @param {string} sessionId - ID of the session to complete
 * @returns {Promise<Object>} - Session completion status and metrics
 */
export async function completeTavusSession(sessionId) {
  try {
    // Update the session status to completed
    const { data: completedSession, error } = await supabase
      .from('tavus_sessions')
      .update({
        session_status: 'completed',
        ended_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single();
    
    if (error) {
      console.error('Error completing session:', error);
      throw new Error(`Failed to complete session ${sessionId}: ${error.message}`);
    }
    
    // The session_duration_seconds will be automatically calculated by our database trigger
    console.log(`Session ${sessionId} completed successfully`);
    console.log(`Session duration: ${completedSession.session_duration_seconds || 'calculating...'} seconds`);
    
    return {
      sessionId: completedSession.id,
      status: completedSession.session_status,
      duration: completedSession.session_duration_seconds,
      videosPlayed: completedSession.videos_played?.length || 0,
      ctaEngagement: completedSession.cta_clicked ? 'clicked' : (completedSession.cta_shown ? 'shown' : 'none')
    };
  } catch (error) {
    console.error('Error completing Tavus session:', error);
    throw error;
  }
}
