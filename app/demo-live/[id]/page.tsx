'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import TavusVideoAgent from '@/components/TavusVideoAgent';
import { supabase } from '@/lib/supabaseClient';

interface Demo {
  id: string;
  title: string;
  status: string;
  cta_link: string | null;
  created_at: string;
  updated_at: string;
}

interface Video {
  id: string;
  title: string;
  filename: string;
  video_url: string;
  thumbnail_url: string | null;
  order_index: number;
  duration_seconds: number | null;
  file_size_bytes: number;
}

interface KnowledgeBaseChunk {
  id: string;
  content: string;
  chunk_index: number;
}

interface TavusSession {
  conversation_id: string;
  conversation_url: string;
  status: string;
}

export default function LiveDemoPage() {
  const params = useParams();
  const demoId = params.id as string;
  
  const [demo, setDemo] = useState<Demo | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBaseChunk[]>([]);
  const [tavusSession, setTavusSession] = useState<TavusSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<'initializing' | 'ready' | 'error'>('initializing');



  useEffect(() => {
    if (demoId) {
      loadDemoData();
    }
  }, [demoId]);

  const loadDemoData = async () => {
    try {
      setLoading(true);
      
      // Load demo details
      const { data: demoData, error: demoError } = await supabase
        .from('demos')
        .select('*')
        .eq('id', demoId)
        .eq('status', 'published')
        .single();

      if (demoError || !demoData) {
        throw new Error('Demo not found or not published');
      }

      setDemo(demoData);

      // Load videos
      const { data: videosData, error: videosError } = await supabase
        .from('videos')
        .select('*')
        .eq('demo_id', demoId)
        .order('order_index', { ascending: true });

      if (videosError) {
        console.error('Error loading videos:', videosError);
      } else {
        setVideos(videosData || []);
      }

      // Load knowledge base
      const { data: kbData, error: kbError } = await supabase
        .from('knowledge_base_chunks')
        .select('*')
        .eq('demo_id', demoId)
        .order('chunk_index', { ascending: true });

      if (kbError) {
        console.error('Error loading knowledge base:', kbError);
      } else {
        setKnowledgeBase(kbData || []);
      }

      // Check for existing Tavus session
      const { data: sessionData, error: sessionError } = await supabase
        .from('tavus_sessions')
        .select('*')
        .eq('demo_id', demoId)
        .eq('session_status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);

      if (sessionError) {
        console.error('Error loading Tavus session:', sessionError);
      }

      let conversationUrl = null;

      if (sessionData && sessionData.length > 0) {
        // Use existing session
        const session = sessionData[0];
        conversationUrl = session.conversation_data?.conversation_url;
        console.log('Using existing Tavus session:', session.tavus_conversation_id);
        
        setTavusSession({
          conversation_id: session.tavus_conversation_id,
          conversation_url: conversationUrl,
          status: session.session_status
        });
      } else {
        // Create new Tavus session
        console.log('Creating new Tavus session for demo:', demoId);
        
        const demoDataForTavus = {
          title: demoData.title,
          videos: videosData?.map(video => ({
            id: video.id,
            title: video.title,
            order_index: video.order_index
          })) || [],
          knowledgeBase: kbData?.map(chunk => chunk.content).join('\n') || '',
          ctaLink: demoData.cta_link
        };

        try {
          const response = await fetch('/api/tavus/create-session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              demoId: demoId,
              demoData: demoDataForTavus
            })
          });

          if (response.ok) {
            const result = await response.json();
            conversationUrl = result.conversation_url;
            
            setTavusSession({
              conversation_id: result.conversation_id,
              conversation_url: conversationUrl,
              status: result.status
            });
            
            console.log('New Tavus session created:', result.conversation_id);
          } else {
            throw new Error('Failed to create Tavus session');
          }
        } catch (sessionCreationError) {
          console.error('Error creating Tavus session:', sessionCreationError);
          setError('Failed to initialize AI assistant');
          setAgentStatus('error');
          return;
        }
      }

      // Check if conversation URL is valid
      if (conversationUrl) {
        setAgentStatus('ready');
      } else {
        setError('AI assistant is not available for this demo');
        setAgentStatus('error');
      }

    } catch (error) {
      console.error('Error loading demo data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load demo');
      setAgentStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const handleVideoStarted = () => {
    console.log('Avatar video started successfully');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-12 h-12 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg">Loading your AI assistant...</p>
        </div>
      </div>
    );
  }

  if (error || !demo || !tavusSession?.conversation_url) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center text-white max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-4">Demo Not Available</h1>
          <p className="text-gray-300 mb-6">
            {error || 'This demo is not available or the AI assistant could not be initialized.'}
          </p>
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const demoData = {
    id: demo.id,
    title: demo.title,
    videos: videos.map(video => ({
      id: video.id,
      title: video.title,
      video_url: video.video_url,
      order_index: video.order_index
    })),
    knowledge_base: knowledgeBase,
    ctaLink: demo.cta_link || undefined
  };

  return (
    <div className="demo-live-container">
      <TavusVideoAgent
        demoData={demoData}
        onVideoStarted={handleVideoStarted}
        onError={(error) => {
          console.error('TavusVideoAgent error:', error);
          setError(error);
          setAgentStatus('error');
        }}
      />
      
      {/* Hidden metadata for SEO */}
      <div style={{ display: 'none' }}>
        <h1>{demo.title} - Live AI Demo</h1>
        <p>Interactive AI-powered demo with {videos.length} product videos</p>
      </div>
    </div>
  );
} 