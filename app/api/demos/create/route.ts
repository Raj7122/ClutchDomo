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

    // Extract user ID from auth header (Bearer token)
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    const { title, cta_link } = await request.json();

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Create new demo - use .select('*') without .single() for more reliable data return
    const { data: demos, error: createError } = await supabase
      .from('demos')
      .insert({
        user_id: user.id,
        title: title.trim(),
        cta_link: cta_link?.trim() || null,
        status: 'draft'
      })
      .select('*');

    if (createError) {
      console.error('Demo creation error:', createError);
      return NextResponse.json({ 
        error: 'Failed to create demo' 
      }, { status: 500 });
    }

    let demo = null;

    // Check if we got data from the insert
    if (demos && demos.length > 0) {
      demo = demos[0];
    } else {
      // Fallback: Query for the most recently created demo by this user with the given title
      console.log('Insert succeeded but no data returned, attempting fallback query');
      
      const { data: fallbackDemos, error: fallbackError } = await supabase
        .from('demos')
        .select('*')
        .eq('user_id', user.id)
        .eq('title', title.trim())
        .order('created_at', { ascending: false })
        .limit(1);

      if (fallbackError) {
        console.error('Fallback query error:', fallbackError);
        return NextResponse.json({ 
          error: 'Demo created but could not retrieve data' 
        }, { status: 500 });
      }

      if (fallbackDemos && fallbackDemos.length > 0) {
        demo = fallbackDemos[0];
      }
    }

    if (!demo) {
      console.error('Demo creation succeeded but no data could be retrieved');
      return NextResponse.json({ 
        error: 'Demo created but data not returned' 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: demo
    });

  } catch (error) {
    console.error('Create demo API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
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

    // Get user's demos
    const { data: demos, error: fetchError } = await supabase
      .from('demos')
      .select(`
        *,
        videos(count),
        knowledge_base_chunks(count)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Demos fetch error:', fetchError);
      return NextResponse.json({ 
        error: 'Failed to fetch demos' 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: demos || []
    });

  } catch (error) {
    console.error('Get demos API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}