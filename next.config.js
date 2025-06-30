/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove static export to enable server-side features for Supabase
  // output: 'export', // Commented out to enable API routes and server features
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false
  },
  images: { 
    unoptimized: true,
    domains: ['your-supabase-project.supabase.co'] // Add your Supabase domain for images
  },
  // Enable experimental features for better Supabase compatibility
  experimental: {
    serverComponentsExternalPackages: ['@supabase/supabase-js']
  },
  // Fix Supabase realtime-js webpack warning
  webpack: (config, { isServer }) => {
    // Suppress the critical dependency warning from @supabase/realtime-js
    config.module.exprContextCritical = false;
    
    return config;
  }
};

module.exports = nextConfig;