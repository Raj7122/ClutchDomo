import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/serverSupabaseClient';

// Test user credentials for demo purposes
const TEST_USERS = [
  {
    email: 'demo@domo.ai',
    password: 'demo123456',
    name: 'Demo User'
  },
  {
    email: 'test@domo.ai', 
    password: 'test123456',
    name: 'Test User'
  }
];

export async function POST(request: NextRequest) {
  console.log('=== Test Login API Started ===');
  
  try {
    // Initialize Supabase client with enhanced error handling
    const supabase = createServerSupabaseClient();

    const { email, password } = await request.json();
    
    console.log('Test login attempt for:', email);
    
    // Check if this is a test user
    const testUser = TEST_USERS.find(user => 
      user.email === email && user.password === password
    );
    
    if (!testUser) {
      console.error('Invalid test credentials provided');
      return NextResponse.json({ 
        error: 'Invalid test credentials' 
      }, { status: 401 });
    }

    console.log('Valid test user found:', testUser.name);

    console.log('Supabase client initialized, attempting sign in...');

    // Try to sign in the test user
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testUser.email,
      password: testUser.password,
    });

    if (signInError) {
      console.log('Sign in failed, attempting to create user:', signInError.message);
      
      // If user doesn't exist, create them
      const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
        email: testUser.email,
        password: testUser.password,
        email_confirm: true,
        user_metadata: {
          name: testUser.name,
          is_test_user: true
        }
      });

      if (signUpError) {
        console.error('Failed to create test user:', signUpError);
        return NextResponse.json({ 
          error: 'Failed to create test user',
          details: signUpError.message
        }, { status: 500 });
      }

      console.log('Test user created successfully, attempting sign in...');

      // Now sign them in
      const { data: newAuthData, error: newSignInError } = await supabase.auth.signInWithPassword({
        email: testUser.email,
        password: testUser.password,
      });

      if (newSignInError) {
        console.error('Failed to sign in newly created test user:', newSignInError);
        return NextResponse.json({ 
          error: 'Failed to sign in test user',
          details: newSignInError.message
        }, { status: 500 });
      }

      console.log('Test user signed in successfully after creation');

      return NextResponse.json({
        success: true,
        user: newAuthData.user,
        session: newAuthData.session,
        message: 'Test user created and signed in'
      });
    }

    console.log('Test user signed in successfully');

    return NextResponse.json({
      success: true,
      user: authData.user,
      session: authData.session,
      message: 'Test user signed in successfully'
    });

  } catch (error) {
    console.error('=== Test Login API Error ===');
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