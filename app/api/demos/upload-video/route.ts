import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/serverSupabaseClient';

export async function POST(request: NextRequest) {
  console.log('=== Upload Video API Started ===');
  
  try {
    // Initialize Supabase client with enhanced error handling
    const supabase = createServerSupabaseClient();

    // Get user from session
    const authHeader = request.headers.get('authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      return NextResponse.json({ 
        error: 'Unauthorized',
        details: 'Missing authorization header'
      }, { status: 401 });
    }

    // Extract user ID from auth header
    const token = authHeader.replace('Bearer ', '');
    console.log('Verifying user token...');
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return NextResponse.json({ 
        error: 'Authentication failed',
        details: authError?.message || 'Invalid token'
      }, { status: 401 });
    }

    console.log('User authenticated:', user.id);

    // Parse form data
    console.log('Parsing form data...');
    const formData = await request.formData();
    const videoFile = formData.get('video') as File;
    const demoId = formData.get('demoId') as string;
    const orderIndex = parseInt(formData.get('orderIndex') as string) || 1;
    const title = formData.get('title') as string;

    console.log('Form data parsed:', {
      hasVideo: !!videoFile,
      videoName: videoFile?.name,
      videoType: videoFile?.type,
      videoSize: videoFile?.size,
      demoId,
      orderIndex,
      title
    });

    if (!videoFile) {
      return NextResponse.json({ 
        error: 'Bad Request',
        details: 'No video file provided'
      }, { status: 400 });
    }

    if (!demoId) {
      return NextResponse.json({ 
        error: 'Bad Request',
        details: 'Demo ID is required'
      }, { status: 400 });
    }

    // Validate file type and size
    const allowedTypes = [
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/quicktime',
      'video/x-msvideo'
    ];
    const maxSize = 100 * 1024 * 1024; // 100MB

    if (!allowedTypes.includes(videoFile.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type',
        details: 'Only MP4, WebM, OGG, MOV, and AVI files are allowed.',
        allowedTypes
      }, { status: 400 });
    }

    if (videoFile.size > maxSize) {
      return NextResponse.json({ 
        error: 'File too large',
        details: 'Maximum file size is 100MB.',
        maxSize: '100MB',
        receivedSize: `${Math.round(videoFile.size / 1024 / 1024)}MB`
      }, { status: 400 });
    }

    // Verify demo ownership
    console.log('Verifying demo ownership...');
    const { data: demo, error: demoError } = await supabase
      .from('demos')
      .select('id, user_id')
      .eq('id', demoId)
      .eq('user_id', user.id)
      .single();

    if (demoError || !demo) {
      console.error('Demo verification failed:', demoError);
      return NextResponse.json({ 
        error: 'Demo not found',
        details: 'Demo not found or you do not have permission to upload videos to it'
      }, { status: 404 });
    }

    console.log('Demo ownership verified');

    // Generate unique filename
    const fileExtension = videoFile.name.split('.').pop();
    const uniqueFilename = `${demoId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExtension}`;

    console.log('Generated unique filename:', uniqueFilename);

    // Upload video to Supabase Storage
    console.log('Uploading video to storage...');
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('demo-videos')
      .upload(uniqueFilename, videoFile, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Video upload error:', uploadError);
      return NextResponse.json({ 
        error: 'Upload failed',
        details: uploadError.message,
        code: uploadError.name
      }, { status: 500 });
    }

    console.log('Video uploaded successfully:', uploadData.path);

    // Get public URL for the uploaded video
    const { data: { publicUrl } } = supabase.storage
      .from('demo-videos')
      .getPublicUrl(uploadData.path);

    console.log('Generated public URL:', publicUrl);

    // Generate thumbnail URL (will be processed later)
    const thumbnailPath = `${demoId}/thumbnails/${Date.now()}-thumb.jpg`;
    const { data: { publicUrl: thumbnailUrl } } = supabase.storage
      .from('demo-videos')
      .getPublicUrl(thumbnailPath);

    // Prepare video record data with proper title handling
    const videoTitle = title || videoFile.name.replace(/\.[^/.]+$/, '') || 'Untitled Video';
    
    const videoData = {
      demo_id: demoId,
      title: videoTitle, // Ensure title is never null
      filename: videoFile.name,
      video_url: publicUrl,
      order_index: orderIndex,
      file_size_bytes: videoFile.size,
      thumbnail_url: thumbnailUrl,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('Preparing to insert video record:', {
      demo_id: videoData.demo_id,
      title: videoData.title,
      filename: videoData.filename,
      order_index: videoData.order_index,
      file_size_bytes: videoData.file_size_bytes,
      hasVideoUrl: !!videoData.video_url,
      hasThumbnailUrl: !!videoData.thumbnail_url
    });

    // Store video record in database with error handling
    console.log('Inserting video record into database...');
    const { data: videoRecord, error: dbError } = await supabase
      .from('videos')
      .insert(videoData)
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      
      // Clean up uploaded file if database insert fails
      console.log('Cleaning up uploaded file due to database error...');
      await supabase.storage
        .from('demo-videos')
        .remove([uploadData.path]);

      // Provide more specific error messages based on the error code
      let errorMessage = 'Failed to save video record';
      if (dbError.code === 'PGRST204') {
        errorMessage = 'Database schema error - please refresh the page and try again';
      } else if (dbError.code === '23505') {
        errorMessage = 'A video with this name already exists';
      } else if (dbError.code === '23503') {
        errorMessage = 'Invalid demo reference';
      } else if (dbError.code === '23502') {
        errorMessage = 'Missing required video information';
      }

      return NextResponse.json({ 
        error: errorMessage,
        details: dbError.message,
        code: dbError.code
      }, { status: 500 });
    }

    // CRITICAL FIX: Check if videoRecord is null even when no explicit error occurred
    if (!videoRecord) {
      console.error('Video record is null despite no database error');
      
      // Clean up uploaded file since we can't create the database record
      console.log('Cleaning up uploaded file due to null video record...');
      await supabase.storage
        .from('demo-videos')
        .remove([uploadData.path]);

      return NextResponse.json({ 
        error: 'Failed to create video record',
        details: 'Database operation completed but returned no data. This may indicate a database configuration issue.',
        troubleshooting: {
          message: 'Video record creation failed unexpectedly',
          suggestions: [
            'Check database table permissions',
            'Verify RLS policies allow insert operations',
            'Ensure all required fields are provided',
            'Try refreshing the page and uploading again'
          ]
        }
      }, { status: 500 });
    }

    console.log('Video record inserted successfully:', videoRecord.id);

    // Trigger transcription processing (async) - but handle errors gracefully
    try {
      console.log('Attempting to trigger transcription processing...');
      await triggerTranscriptionProcessing(videoRecord.id, publicUrl, supabase);
      console.log('Transcription processing triggered successfully');
    } catch (transcriptionError) {
      console.warn('Transcription trigger failed (non-critical):', transcriptionError);
      // Don't fail the request if transcription fails to start
      // This is expected in development environments where edge functions might not be deployed
    }

    // Update demo status to processing
    console.log('Updating demo status to processing...');
    try {
      const { error: updateError } = await supabase
        .from('demos')
        .update({ 
          status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('id', demoId);

      if (updateError) {
        console.warn('Demo status update failed (non-critical):', updateError);
      } else {
        console.log('Demo status updated successfully');
      }
    } catch (updateError) {
      console.warn('Demo status update error (non-critical):', updateError);
    }

    console.log('=== Upload Video API Completed Successfully ===');

    return NextResponse.json({
      success: true,
      data: {
        id: videoRecord.id,
        title: videoRecord.title,
        filename: videoRecord.filename,
        videoUrl: publicUrl,
        thumbnailUrl: thumbnailUrl,
        orderIndex: videoRecord.order_index,
        fileSize: videoFile.size,
        uploadPath: uploadData.path
      }
    });

  } catch (error) {
    console.error('=== Upload Video API Error ===');
    console.error('Error details:', error);
    
    // Determine if this is a network error
    const isNetworkError = error instanceof Error && (
      error.message.includes('fetch failed') ||
      error.message.includes('Network request failed') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('timeout')
    );
    
    return NextResponse.json({ 
      error: isNetworkError ? 'Network connectivity issue' : 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      troubleshooting: isNetworkError ? {
        message: 'Cannot connect to Supabase servers',
        suggestions: [
          'Check your internet connection',
          'Verify NEXT_PUBLIC_SUPABASE_URL environment variable',
          'Verify SUPABASE_SERVICE_ROLE_KEY environment variable',
          'Try refreshing the page or restarting the development server'
        ]
      } : undefined
    }, { 
      status: isNetworkError ? 503 : 500
    });
  }
}

// Trigger transcription processing via Supabase Edge Function with better error handling
async function triggerTranscriptionProcessing(videoId: string, videoUrl: string, supabase: any) {
  try {
    console.log('Invoking transcribe-video edge function...');
    
    const { data, error } = await supabase.functions.invoke('transcribe-video', {
      body: {
        video_id: videoId,
        video_url: videoUrl
      }
    });

    if (error) {
      console.error('Transcription function error:', error);
      
      // Check if it's a 404 error (function not deployed)
      if (error.context?.status === 404) {
        console.warn('Transcription function not deployed - this is expected in development');
        return; // Don't throw error for missing function in development
      }
      
      // Check if it's a network connectivity issue
      if (error.message?.includes('fetch failed') || error.message?.includes('Network')) {
        console.warn('Network connectivity issue with edge function - this may be temporary');
        return; // Don't throw error for network issues
      }
      
      throw error;
    }

    console.log('Transcription function response:', data);
    return data;
  } catch (error) {
    console.error('Failed to trigger transcription:', error);
    
    // In development, edge functions might not be deployed, so don't fail the upload
    if (process.env.NODE_ENV === 'development') {
      console.warn('Transcription failed in development environment - this is expected');
      return;
    }
    
    // For production, log the error but don't fail the upload
    console.warn('Transcription service unavailable - video uploaded successfully but transcription will be skipped');
    return;
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