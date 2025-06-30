import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/serverSupabaseClient';

export async function POST(request: NextRequest) {
  try {
    // Initialize Supabase client with enhanced error handling
    const supabase = createServerSupabaseClient();

    // Get user from session
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract user ID from auth header
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    const { videoId, duration, width, height, thumbnailBlob } = await request.json();

    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    // Verify video ownership through demo
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select(`
        id,
        demo_id,
        demos!inner(user_id)
      `)
      .eq('id', videoId)
      .single();

    if (videoError || !video || (video.demos as any).user_id !== user.id) {
      return NextResponse.json({ error: 'Video not found or access denied' }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {};
    
    if (duration !== undefined) {
      updateData.duration_seconds = Math.round(duration);
    }

    // Upload thumbnail if provided
    if (thumbnailBlob) {
      try {
        // Convert base64 to blob
        const base64Data = thumbnailBlob.split(',')[1];
        const binaryData = atob(base64Data);
        const bytes = new Uint8Array(binaryData.length);
        for (let i = 0; i < binaryData.length; i++) {
          bytes[i] = binaryData.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'image/jpeg' });

        // Upload thumbnail
        const thumbnailPath = `${video.demo_id}/thumbnails/${videoId}-thumb.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('demo-videos')
          .upload(thumbnailPath, blob, {
            cacheControl: '3600',
            upsert: true
          });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('demo-videos')
            .getPublicUrl(thumbnailPath);
          
          updateData.thumbnail_url = publicUrl;
        }
      } catch (thumbnailError) {
        console.error('Thumbnail upload error:', thumbnailError);
        // Don't fail the request if thumbnail upload fails
      }
    }

    // Update video metadata
    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = new Date().toISOString();
      
      const { error: updateError } = await supabase
        .from('videos')
        .update(updateData)
        .eq('id', videoId);

      if (updateError) {
        console.error('Video metadata update error:', updateError);
        return NextResponse.json({ 
          error: 'Failed to update video metadata' 
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        videoId,
        updatedFields: Object.keys(updateData)
      }
    });

  } catch (error) {
    console.error('Update video metadata API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
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