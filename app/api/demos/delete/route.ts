import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/serverSupabaseClient';

export async function DELETE(request: NextRequest) {
  console.log('=== Delete Demo API Started ===');
  
  try {
    // Initialize Supabase client with enhanced error handling
    const supabase = createServerSupabaseClient();

    // Get user from session with enhanced error handling
    const authHeader = request.headers.get('authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('No authorization header provided');
      return NextResponse.json({ 
        error: 'Unauthorized', 
        details: 'Missing authorization header'
      }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      console.error('Invalid token format');
      return NextResponse.json({ 
        error: 'Unauthorized', 
        details: 'Invalid token format'
      }, { status: 401 });
    }

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

    // Get demo ID from URL parameters
    const { searchParams } = new URL(request.url);
    const demoId = searchParams.get('id');
    
    console.log('Demo ID to delete:', demoId);

    if (!demoId) {
      console.error('No demo ID provided');
      return NextResponse.json({ 
        error: 'Bad Request', 
        details: 'Demo ID is required'
      }, { status: 400 });
    }

    // Verify demo ownership and get demo details
    console.log('Verifying demo ownership...');
    const { data: demos, error: demoError } = await supabase
      .from('demos')
      .select('id, user_id, status, title')
      .eq('id', demoId)
      .eq('user_id', user.id);

    if (demoError) {
      console.error('Demo query error:', demoError);
      return NextResponse.json({ 
        error: 'Database query failed',
        details: demoError.message
      }, { status: 500 });
    }

    console.log('Demo query result:', {
      found: demos?.length || 0,
      demos: demos
    });

    if (!demos || demos.length === 0) {
      console.error('Demo not found for user');
      return NextResponse.json({ 
        error: 'Not Found',
        details: 'Demo not found or you do not have permission to delete it'
      }, { status: 404 });
    }

    const demo = demos[0];
    console.log('Demo found:', {
      id: demo.id,
      title: demo.title,
      status: demo.status,
      userId: demo.user_id
    });

    // Only allow deletion of draft demos for safety
    if (demo.status !== 'draft') {
      console.log('Attempted to delete non-draft demo, status:', demo.status);
      return NextResponse.json({ 
        error: 'Operation Not Allowed',
        details: 'Only draft demos can be deleted. Published demos should be unpublished first.',
        currentStatus: demo.status
      }, { status: 400 });
    }

    // Start deletion process
    console.log('Starting deletion process...');

    // Step 1: Get all videos associated with this demo for cleanup
    console.log('Step 1: Getting associated videos...');
    const { data: videos, error: videosError } = await supabase
      .from('videos')
      .select('id, video_url, thumbnail_url')
      .eq('demo_id', demoId);

    if (videosError) {
      console.warn('Error fetching videos for cleanup (continuing anyway):', videosError);
    }

    const videoList = videos || [];
    console.log('Found videos for cleanup:', videoList.length);

    // Step 2: Delete storage files if they exist
    if (videoList.length > 0) {
      console.log('Step 2: Cleaning up storage files...');
      const filesToDelete: string[] = [];
      
      videoList.forEach((video, index) => {
        console.log(`Processing video ${index + 1}:`, {
          id: video.id,
          hasVideoUrl: !!video.video_url,
          hasThumbnailUrl: !!video.thumbnail_url
        });

        // Extract file paths for deletion
        if (video.video_url) {
          try {
            let filePath = '';
            if (video.video_url.startsWith('http')) {
              const url = new URL(video.video_url);
              const pathParts = url.pathname.split('/');
              const demoIndex = pathParts.indexOf(demoId);
              if (demoIndex !== -1 && demoIndex < pathParts.length - 1) {
                filePath = pathParts.slice(demoIndex).join('/');
              } else {
                const fileName = pathParts[pathParts.length - 1];
                if (fileName && fileName !== 'undefined') {
                  filePath = `${demoId}/${fileName}`;
                }
              }
            } else {
              filePath = video.video_url;
            }
            
            if (filePath) {
              filesToDelete.push(filePath);
              console.log('Added video file for deletion:', filePath);
            }
          } catch (urlError) {
            console.warn('Invalid video URL:', video.video_url, urlError);
          }
        }

        if (video.thumbnail_url) {
          try {
            let filePath = '';
            if (video.thumbnail_url.startsWith('http')) {
              const url = new URL(video.thumbnail_url);
              const pathParts = url.pathname.split('/');
              const demoIndex = pathParts.indexOf(demoId);
              if (demoIndex !== -1 && demoIndex < pathParts.length - 1) {
                filePath = pathParts.slice(demoIndex).join('/');
              } else {
                const fileName = pathParts[pathParts.length - 1];
                if (fileName && fileName !== 'undefined') {
                  filePath = `${demoId}/thumbnails/${fileName}`;
                }
              }
            } else {
              filePath = video.thumbnail_url;
            }
            
            if (filePath) {
              filesToDelete.push(filePath);
              console.log('Added thumbnail file for deletion:', filePath);
            }
          } catch (urlError) {
            console.warn('Invalid thumbnail URL:', video.thumbnail_url, urlError);
          }
        }
      });

      // Delete files from storage (ignore errors as files might not exist)
      if (filesToDelete.length > 0) {
        console.log('Attempting to delete files from storage:', filesToDelete);
        try {
          const { error: storageError } = await supabase.storage
            .from('demo-videos')
            .remove(filesToDelete);
          
          if (storageError) {
            console.warn('Storage cleanup warning (continuing anyway):', storageError);
          } else {
            console.log('Storage files deleted successfully');
          }
        } catch (storageError) {
          console.warn('Storage cleanup error (continuing anyway):', storageError);
        }
      }
    }

    // Step 3: Delete related records in correct order
    console.log('Step 3: Deleting related database records...');
    
    // Delete transcripts first (they reference videos)
    if (videoList.length > 0) {
      const videoIds = videoList.map(v => v.id);
      console.log('Deleting transcripts for video IDs:', videoIds);
      
      try {
        const { error: transcriptsError } = await supabase
          .from('transcripts')
          .delete()
          .in('video_id', videoIds);
        
        if (transcriptsError) {
          console.error('Error deleting transcripts (continuing anyway):', transcriptsError);
        } else {
          console.log('Transcripts deleted successfully');
        }
      } catch (transcriptDeleteError) {
        console.error('Transcript deletion failed (continuing anyway):', transcriptDeleteError);
      }
    }

    // Delete knowledge base chunks
    console.log('Deleting knowledge base chunks...');
    try {
      const { error: chunksError } = await supabase
        .from('knowledge_base_chunks')
        .delete()
        .eq('demo_id', demoId);
      
      if (chunksError) {
        console.error('Error deleting knowledge base chunks (continuing anyway):', chunksError);
      } else {
        console.log('Knowledge base chunks deleted successfully');
      }
    } catch (chunksDeleteError) {
      console.error('Knowledge base chunks deletion failed (continuing anyway):', chunksDeleteError);
    }

    // Delete videos
    console.log('Deleting videos...');
    try {
      const { error: videosDeleteError } = await supabase
        .from('videos')
        .delete()
        .eq('demo_id', demoId);
      
      if (videosDeleteError) {
        console.error('Error deleting videos (continuing anyway):', videosDeleteError);
      } else {
        console.log('Videos deleted successfully');
      }
    } catch (videosDeleteError) {
      console.error('Videos deletion failed (continuing anyway):', videosDeleteError);
    }

    // Step 4: Finally, delete the demo
    console.log('Step 4: Deleting demo...');
    const { error: deleteError } = await supabase
      .from('demos')
      .delete()
      .eq('id', demoId)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Demo deletion error:', deleteError);
      return NextResponse.json({ 
        error: 'Delete operation failed',
        details: deleteError.message
      }, { status: 500 });
    }

    console.log('Demo deleted successfully');
    console.log('=== Delete Demo API Completed Successfully ===');

    return NextResponse.json({
      success: true,
      message: 'Demo deleted successfully',
      deletedDemo: {
        id: demo.id,
        title: demo.title
      }
    });

  } catch (error) {
    console.error('=== Delete Demo API Error ===');
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