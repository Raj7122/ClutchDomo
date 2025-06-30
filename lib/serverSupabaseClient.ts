import { createClient } from '@supabase/supabase-js';

// Validate environment variables with detailed error messages
function validateEnvironment() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const errors = [];
  
  if (!supabaseUrl) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL is missing');
  } else {
    try {
      new URL(supabaseUrl);
    } catch {
      errors.push('NEXT_PUBLIC_SUPABASE_URL is not a valid URL');
    }
  }
  
  if (!supabaseServiceKey) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY is missing');
  } else if (supabaseServiceKey.length < 100) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY appears to be invalid (too short)');
  }
  
  return { supabaseUrl, supabaseServiceKey, errors };
}

// Create server-side Supabase client with robust error handling and retry logic
export function createServerSupabaseClient() {
  const { supabaseUrl, supabaseServiceKey, errors } = validateEnvironment();
  
  if (errors.length > 0) {
    console.error('Supabase environment validation failed:', errors);
    throw new Error(`Supabase configuration error: ${errors.join(', ')}`);
  }

  return createClient(supabaseUrl!, supabaseServiceKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      fetch: async (url, options = {}) => {
        console.log(`Supabase request: ${options.method || 'GET'} ${url}`);
        
        // Enhanced retry logic with better error handling
        let lastError;
        const maxRetries = 5; // Increased from 3 to 5 for better resilience
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased timeout to 15 seconds
            
            const response = await fetch(url, {
              ...options,
              signal: controller.signal,
              headers: {
                'User-Agent': 'DOMO-App/1.0',
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'apikey': supabaseServiceKey!,
                'Authorization': `Bearer ${supabaseServiceKey!}`,
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache',
                ...options.headers,
              }
            });
            
            clearTimeout(timeoutId);
            console.log(`Attempt ${attempt} successful for ${url} - Status: ${response.status}`);
            return response;
            
          } catch (error) {
            lastError = error;
            console.error(`Attempt ${attempt} failed for ${url}:`, {
              error: error instanceof Error ? error.message : 'Unknown error',
              name: error instanceof Error ? error.name : 'Unknown',
              cause: error instanceof Error && 'cause' in error ? error.cause : undefined
            });
            
            // Enhanced retry logic for specific error types
            if (error instanceof Error) {
              if (error.name === 'AbortError') {
                console.log('Request timed out, will retry...');
              } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
                console.log('DNS/Connection error, will retry...');
              } else if (error.message.includes('other side closed') || error.message.includes('fetch failed')) {
                console.log('Connection closed by server or fetch failed, will retry...');
              } else if (error.message.includes('SocketError')) {
                console.log('Socket error detected, will retry...');
              }
            }
            
            if (attempt < maxRetries) {
              // Progressive backoff with jitter - longer delays for later attempts
              const baseDelay = Math.min(Math.pow(2, attempt) * 1500, 10000); // Cap at 10 seconds
              const jitter = Math.random() * 1000;
              const delay = baseDelay + jitter;
              
              console.log(`Waiting ${Math.round(delay)}ms before retry ${attempt + 1}/${maxRetries}...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        // All retries failed
        const errorMessage = lastError instanceof Error ? lastError.message : 'Unknown error';
        console.error(`All ${maxRetries} attempts failed for ${url}. Final error:`, errorMessage);
        
        throw new Error(`Network request failed after ${maxRetries} attempts: ${errorMessage}`);
      }
    }
  });
}