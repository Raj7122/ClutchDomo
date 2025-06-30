import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/serverSupabaseClient';

export async function DELETE(request: NextRequest) {
  console.log('=== Delete Video API Started ===');
  
  try {
    // Initialize Supabase client with enhanced error handling
    const supabase = createServerSupabaseClient();

    // Get user from session
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    console.log('User authenticated:', user.id);

    // Get video ID from URL parameters
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('id');
    
    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    console.log('Video ID to delete:', videoId);

    // Get video details and verify ownership through demo
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select(`
        id,
        demo_id,
        filename,
        video_url,
        thumbnail_url,
        demos!inner(user_id)
      `)
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      console.error('Video not found:', videoError);
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Verify user owns the demo
    if ((video.demos as any).user_id !== user.id) {
      console.error('Access denied - user does not own demo');
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    console.log('Video ownership verified');

    // Delete storage files
    const filesToDelete: string[] = [];
    
    // Extract file paths from URLs
    if (video.video_url) {
      try {
        const url = new URL(video.video_url);
        const pathParts = url.pathname.split('/');
        const demoIndex = pathParts.indexOf(video.demo_id);
        if (demoIndex !== -1 && demoIndex < pathParts.length - 1) {
          const filePath = pathParts.slice(demoIndex).join('/');
          filesToDelete.push(filePath);
        }
      } catch (urlError) {
        console.warn('Invalid video URL:', video.video_url);
      }
    }

    if (video.thumbnail_url) {
      try {
        const url = new URL(video.thumbnail_url);
        const pathParts = url.pathname.split('/');
        const demoIndex = pathParts.indexOf(video.demo_id);
        if (demoIndex !== -1 && demoIndex < pathParts.length - 1) {
          const filePath = pathParts.slice(demoIndex).join('/');
          filesToDelete.push(filePath);
        }
      } catch (urlError) {
        console.warn('Invalid thumbnail URL:', video.thumbnail_url);
      }
    }

    // Delete files from storage
    if (filesToDelete.length > 0) {
      console.log('Deleting files from storage:', filesToDelete);
      const { error: storageError } = await supabase.storage
        .from('demo-videos')
        .remove(filesToDelete);
      
      if (storageError) {
        console.warn('Storage cleanup warning:', storageError);
      } else {
        console.log('Storage files deleted successfully');
      }
    }

    // Delete transcripts first (they reference the video)
    const { error: transcriptError } = await supabase
      .from('transcripts')
      .delete()
      .eq('video_id', videoId);

    if (transcriptError) {
      console.warn('Transcript deletion warning:', transcriptError);
    }

    // Delete the video record
    const { error: deleteError } = await supabase
      .from('videos')
      .delete()
      .eq('id', videoId);

    if (deleteError) {
      console.error('Video deletion error:', deleteError);
      return NextResponse.json({ 
        error: 'Failed to delete video',
        details: deleteError.message
      }, { status: 500 });
    }

    console.log('Video deleted successfully');

    // Update order indexes for remaining videos
    const { data: remainingVideos, error: fetchError } = await supabase
      .from('videos')
      .select('id, order_index')
      .eq('demo_id', video.demo_id)
      .order('order_index', { ascending: true });

    if (!fetchError && remainingVideos) {
      // Reorder remaining videos
      const updates = remainingVideos.map((v, index) => ({
        id: v.id,
        order_index: index + 1
      }));

      for (const update of updates) {
        await supabase
          .from('videos')
          .update({ order_index: update.order_index })
          .eq('id', update.id);
      }
    }

    console.log('=== Delete Video API Completed Successfully ===');

    return NextResponse.json({
      success: true,
      message: 'Video deleted successfully',
      deletedVideo: {
        id: video.id,
        filename: video.filename
      }
    });

  } catch (error) {
    console.error('=== Delete Video API Error ===');
    console.error('Error details:', error);
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Handle preflight requests for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}