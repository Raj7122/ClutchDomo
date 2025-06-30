import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Only throw errors if we're in the browser (runtime) and variables are missing
// During build time, these might not be available but that's okay
const isBrowser = typeof window !== 'undefined'

if (isBrowser && !supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
}

if (isBrowser && !supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable')
}

// Provide fallback values during build time to prevent build failures
const fallbackUrl = supabaseUrl || 'https://placeholder.supabase.co'
const fallbackKey = supabaseAnonKey || 'placeholder-key'

export const supabase = createClient(fallbackUrl, fallbackKey)