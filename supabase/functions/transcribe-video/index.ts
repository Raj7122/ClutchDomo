import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validate environment variables
function validateEnvironment() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const elevenlabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
  
  const errors = [];
  
  if (!supabaseUrl) {
    errors.push('SUPABASE_URL is missing');
  }
  
  if (!supabaseServiceKey) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY is missing');
  }
  
  if (!elevenlabsApiKey) {
    errors.push('ELEVENLABS_API_KEY is missing');
  }
  
  return { supabaseUrl, supabaseServiceKey, elevenlabsApiKey, errors };
}

serve(async (req) => {
  console.log('=== Transcribe Video Edge Function Started ===');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate environment variables
    const { supabaseUrl, supabaseServiceKey, elevenlabsApiKey, errors } = validateEnvironment();
    
    console.log('Environment validation:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      hasElevenlabsKey: !!elevenlabsApiKey,
      errors
    });
    
    if (errors.length > 0) {
      console.error('Environment validation failed:', errors);
      return new Response(
        JSON.stringify({ 
          error: 'Configuration error',
          details: 'Missing required environment variables',
          missingVariables: errors
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { video_id, video_url } = await req.json();

    if (!video_id || !video_url) {
      return new Response(
        JSON.stringify({ 
          error: 'Bad Request',
          details: 'Missing video_id or video_url parameters'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Processing transcription request:', {
      videoId: video_id,
      videoUrl: video_url
    });

    // Initialize Supabase client with enhanced error handling
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
      global: {
        fetch: (url, options = {}) => {
          console.log(`Supabase request: ${options.method || 'GET'} ${url}`);
          return fetch(url, {
            ...options,
            signal: AbortSignal.timeout(30000) // 30 second timeout
          }).catch(error => {
            console.error(`Supabase fetch failed for ${url}:`, error);
            throw new Error(`Network request failed: ${error.message}`);
          });
        }
      }
    });

    // Test Supabase connectivity
    console.log('Testing Supabase connectivity...');
    try {
      const { data: testData, error: testError } = await supabase
        .from('videos')
        .select('id')
        .eq('id', video_id)
        .single();
      
      if (testError && testError.code !== 'PGRST116') { // PGRST116 is "not found" which is ok for testing
        console.error('Supabase connectivity test failed:', testError);
        throw new Error(`Supabase connection failed: ${testError.message}`);
      }
      
      console.log('Supabase connectivity test passed');
    } catch (connectivityError) {
      console.error('Supabase connectivity error:', connectivityError);
      return new Response(
        JSON.stringify({ 
          error: 'Database connectivity issue',
          details: connectivityError instanceof Error ? connectivityError.message : 'Unknown connectivity error'
        }),
        { 
          status: 503, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Download video file for processing with timeout and error handling
    console.log(`Starting video download for transcription: ${video_id}`);
    
    let videoBlob;
    try {
      const videoResponse = await fetch(video_url, {
        signal: AbortSignal.timeout(60000) // 60 second timeout for video download
      });
      
      if (!videoResponse.ok) {
        throw new Error(`Failed to download video: ${videoResponse.status} ${videoResponse.statusText}`);
      }

      videoBlob = await videoResponse.blob();
      console.log(`Downloaded video blob: ${videoBlob.size} bytes`);
      
      if (videoBlob.size === 0) {
        throw new Error('Downloaded video file is empty');
      }
      
    } catch (downloadError) {
      console.error('Video download failed:', downloadError);
      return new Response(
        JSON.stringify({ 
          error: 'Video download failed',
          details: downloadError instanceof Error ? downloadError.message : 'Unknown download error'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Use ElevenLabs API for transcription with enhanced error handling
    let transcriptionResult;
    try {
      transcriptionResult = await transcribeWithElevenLabs(videoBlob, elevenlabsApiKey!);
      console.log('Transcription completed successfully');
    } catch (transcriptionError) {
      console.error('Transcription failed:', transcriptionError);
      
      // Use fallback transcription
      console.log('Using fallback transcription due to service failure');
      transcriptionResult = createFallbackTranscription(transcriptionError);
    }

    // Store transcription results with error handling
    console.log('Storing transcription results in database...');
    try {
      const { data: transcript, error: insertError } = await supabase
        .from('transcripts')
        .insert({
          video_id: video_id,
          transcript_text: transcriptionResult.text,
          confidence_score: transcriptionResult.confidence,
          timestamps: transcriptionResult.segments,
          language_detected: transcriptionResult.language,
          processing_metadata: {
            model: transcriptionResult.model || 'elevenlabs-whisper',
            processing_time_ms: transcriptionResult.processing_time,
            audio_quality_score: transcriptionResult.audio_quality,
            speaker_count: transcriptionResult.speaker_count || 1,
            fallback_used: transcriptionResult.fallback_used || false
          },
          audio_quality_score: transcriptionResult.audio_quality,
          speaker_count: transcriptionResult.speaker_count || 1,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error('Failed to insert transcript:', insertError);
        throw new Error(`Database insert failed: ${insertError.message}`);
      }

      console.log('Transcript stored successfully:', transcript.id);

      // Update video status
      const { error: updateError } = await supabase
        .from('videos')
        .update({
          duration_seconds: transcriptionResult.duration,
          updated_at: new Date().toISOString()
        })
        .eq('id', video_id);

      if (updateError) {
        console.warn('Video status update failed (non-critical):', updateError);
      }

      console.log(`Transcription completed for video ${video_id}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          transcript_id: transcript.id,
          text_length: transcriptionResult.text.length,
          confidence: transcriptionResult.confidence,
          fallback_used: transcriptionResult.fallback_used || false
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );

    } catch (dbError) {
      console.error('Database operation failed:', dbError);
      return new Response(
        JSON.stringify({ 
          error: 'Database operation failed',
          details: dbError instanceof Error ? dbError.message : 'Unknown database error'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

  } catch (error) {
    console.error('=== Transcribe Video Edge Function Error ===');
    console.error('Error details:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Transcription processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// ElevenLabs transcription implementation with enhanced error handling
async function transcribeWithElevenLabs(videoBlob: Blob, elevenlabsApiKey: string) {
  const startTime = Date.now();

  try {
    console.log('Starting ElevenLabs transcription...');
    
    // Convert video blob to audio format that ElevenLabs accepts
    const formData = new FormData();
    formData.append('audio', videoBlob, 'video.mp4');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    
    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': elevenlabsApiKey,
      },
      body: formData,
      signal: AbortSignal.timeout(120000) // 2 minute timeout for transcription
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const result = await response.json();
    const processingTime = Date.now() - startTime;
    
    console.log('ElevenLabs transcription successful:', {
      textLength: result.text?.length || 0,
      confidence: result.confidence || 0,
      processingTime
    });
    
    return {
      text: result.text || 'No transcription available',
      confidence: result.confidence || 0.9,
      language: result.language || 'en',
      duration: result.duration || 0,
      processing_time: processingTime,
      audio_quality: result.audio_quality || 0.8,
      speaker_count: result.speaker_count || 1,
      segments: result.segments || [],
      model: 'elevenlabs-whisper',
      fallback_used: false
    };

  } catch (error) {
    console.error('ElevenLabs transcription error:', error);
    throw error;
  }
}

// Create fallback transcription when service fails
function createFallbackTranscription(originalError: any) {
  console.log('Creating fallback transcription due to service failure');
  
  const processingTime = 1000; // Simulate processing time
  
  return {
    text: "Transcription service temporarily unavailable. Please try again later or contact support if this issue persists.",
    confidence: 0.0,
    language: 'en',
    duration: 60,
    processing_time: processingTime,
    audio_quality: 0.5,
    speaker_count: 1,
    segments: [
      {
        start: 0,
        end: 60,
        text: "Transcription service temporarily unavailable.",
        confidence: 0.0
      }
    ],
    model: 'fallback',
    fallback_used: true,
    original_error: originalError instanceof Error ? originalError.message : 'Unknown error'
  };
}