'use client';

import React, { useState, useRef, useEffect } from 'react';
import ThankYouModal from '@/components/ThankYouModal';
import { createTavusSession } from '@/lib/tavusSessionManager';

// Global Daily.co instance management
declare global {
  interface Window {
    __GLOBAL_DAILY_INSTANCE__?: any;
    __DAILY_CLEANUP_TIMEOUT__?: NodeJS.Timeout;
  }
}

// Global cleanup function
const cleanupAllDailyInstances = () => {
  try {
    // Clear any pending cleanup
    if (typeof window !== 'undefined' && window.__DAILY_CLEANUP_TIMEOUT__) {
      clearTimeout(window.__DAILY_CLEANUP_TIMEOUT__);
      window.__DAILY_CLEANUP_TIMEOUT__ = undefined;
    }

    // Destroy existing global instance
    if (typeof window !== 'undefined' && window.__GLOBAL_DAILY_INSTANCE__) {
      try {
        window.__GLOBAL_DAILY_INSTANCE__.destroy();
      } catch (e) {
        console.warn('Error destroying global Daily instance:', e);
      }
      window.__GLOBAL_DAILY_INSTANCE__ = undefined;
    }

    // Remove all Daily.co iframes from DOM
    if (typeof document !== 'undefined') {
      const existingIframes = document.querySelectorAll('iframe[src*="daily.co"], iframe[src*="tavus"]');
      existingIframes.forEach(iframe => {
        try {
          iframe.remove();
        } catch (e) {
          console.warn('Error removing iframe:', e);
        }
      });
    }

    console.log('Global Daily.co cleanup completed');
  } catch (error) {
    console.warn('Error during global cleanup:', error);
  }
};

interface TavusVideoAgentProps {
  demoData: {
    id: string;
    title: string;
    videos: Array<{ 
      id: string; 
      title: string; 
      video_url: string; 
      order_index: number; 
    }>;
    knowledge_base?: any[];
    ctaLink?: string;
  };
  conversationUrl: string; // The URL is now passed directly as a prop
  onError?: (error: string) => void;
  onVideoStarted?: () => void;
}

interface DragOffset {
  x: number;
  y: number;
}

const TavusVideoAgent: React.FC<TavusVideoAgentProps> = ({ 
  demoData,
  conversationUrl, // Use the prop directly
  onError, 
  onVideoStarted 
}) => {
  const callRef = useRef<any>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const pipContainerRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<DragOffset>({ x: 0, y: 0 });
  const [agentStatus, setAgentStatus] = useState<'initializing' | 'ready' | 'active' | 'error'>('initializing');
  const [currentVideo, setCurrentVideo] = useState<number | null>(null);
  const [showThankYou, setShowThankYou] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);
  const [sessionStartTime] = useState(Date.now());
  const [ctaClicked, setCtaClicked] = useState(false);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);

  // Session creation logic is now removed. This component is purely for presentation.

  // Stage 2: Once we have a URL, create and mount the Daily.co iframe
  useEffect(() => {
    if (!conversationUrl || !videoContainerRef.current) {
      return;
    }

    console.log('[AGENT] Conversation URL is ready, initializing Daily.co frame.');

    // Ensure any previous instances are cleaned up before creating a new one
    cleanupAllDailyInstances();

    const container = videoContainerRef.current;
    let callFrame: any = null;

    try {
      const DailyIframe = require('@daily-co/daily-js').default;
      callFrame = DailyIframe.createFrame(container, {
        iframeStyle: {
          position: 'absolute',
          width: '100%',
          height: '100%',
          top: 0,
          left: 0,
          border: '0',
        },
        showLeaveButton: false,
        showFullscreenButton: false,
      });

      callRef.current = callFrame; // Store ref

      // --- Event Listeners ---
      callFrame
        .on('joined-meeting', () => {
          console.log('[AGENT] Successfully joined Tavus conversation');
          setIsLoading(false);
          onVideoStarted?.();
        })
        .on('error', (event: any) => {
          console.error('[AGENT] Daily.co error:', event);
          const errorMsg = event?.error?.msg || 'A connection error occurred.';
          setError(errorMsg);
          onError?.(errorMsg);
        });

      // Join the call
      callFrame.join({ url: conversationUrl });

    } catch (err) {
      console.error('[AGENT] Error creating or joining Daily call:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to create video frame.';
      setError(errorMsg);
      onError?.(errorMsg);
    }

    // --- Cleanup Function ---
    return () => {
      console.log('[AGENT] Cleaning up Daily.co instance.');
      if (callFrame) {
        callFrame.leave().then(() => {
          callFrame.destroy();
          console.log('[AGENT] Daily.co frame destroyed.');
        }).catch((err: any) => {
          console.error('[AGENT] Error during Daily.co cleanup:', err);
          // Force destroy if leave fails
          callFrame.destroy();
        });
      }
    };
  }, [conversationUrl, onVideoStarted, onError]);

  // Build system prompt with demo context
  const buildSystemPrompt = () => {
    let prompt = `You are an AI assistant representing ${demoData.title}. Your role is to provide helpful, engaging demonstrations of our product and answer visitor questions.

`;
    
    // Add videos information
    if (demoData.videos?.length > 0) {
      prompt += `You have access to ${demoData.videos.length} product demonstration video(s): `;
      prompt += demoData.videos.map(v => `"${v.title}"`).join(', ');
      prompt += '.\n\n';
    }

    // Add knowledge base information
    if (demoData.knowledge_base?.length > 0) {
      prompt += `You have detailed product knowledge and documentation to answer questions accurately.\n\n`;
    }

    // Add CTA information if available
    if (demoData.ctaLink) {
      prompt += `When visitors express interest in trying or buying our product, direct them to take action.\n\n`;
    }
    
    // Add tool usage instructions
    prompt += `IMPORTANT: You have access to the following tools that you MUST use by calling them EXACTLY as shown:\n\n`;
    
    prompt += `1. fetch_video(feature) - When a visitor asks to see a demo or video about a specific feature, use this tool to show the relevant video.\n`;
    prompt += `   Example: When they say "Can you show me the dashboard?", silently call fetch_video("dashboard") without announcing it.\n\n`;
    
    prompt += `2. fetch_answer(query) - Use this to answer specific questions using your knowledge base.\n`;
    prompt += `   Example: When asked "What integrations do you support?", silently call fetch_answer("integrations") before answering.\n\n`;
    
    prompt += `3. show_trial_cta(url) - When visitor shows interest in purchasing or trying the product, show them a call-to-action.\n`;
    prompt += `   Example: When they say "How can I get started?", silently call show_trial_cta() without announcing it.\n\n`;
    
    prompt += `CRITICAL: When using these tools, do NOT announce your intention to use them. Do NOT say phrases like "Let me show you a video" or "I'll pull that up for you". Instead, silently make the tool call WITHOUT any text output, and let the tool handle the response.\n\n`;
    
    prompt += `Do not use any functions other than the ones explicitly defined above.\n\n`;
    
    prompt += `Your goal is to help visitors understand the product, answer their questions accurately using the knowledge base, show relevant videos when requested, and guide them toward converting by using the CTA at appropriate moments. Be concise, helpful, and engaging throughout the conversation.`;

    return prompt;
  };

  // Toggle to picture-in-picture mode
  const togglePiP = () => {
    if (isFullscreen && callRef.current) {
      const pipVideoContainer = pipContainerRef.current?.querySelector('.video-container');
      if (pipVideoContainer) {
        pipVideoContainer.appendChild(callRef.current.iframe());
        setIsFullscreen(false);
      }
    }
  };

  // Toggle back to fullscreen
  const toggleFullscreen = () => {
    if (!isFullscreen && callRef.current) {
      const fullscreenVideoContainer = fullscreenContainerRef.current?.querySelector('.video-container');
      if (fullscreenVideoContainer) {
        fullscreenVideoContainer.appendChild(callRef.current.iframe());
        setIsFullscreen(true);
        setShowVideoPlayer(false);
      }
    }
  };

  // End the call
  const endCall = () => {
    cleanupAllDailyInstances();
    callRef.current = null;
    setIsFullscreen(true);
    setShowVideoPlayer(false);
  };

  // Play demo video
  const playVideo = (videoIndex: number) => {
    const video = demoData.videos?.find(v => v.order_index === videoIndex);
    if (video) {
      setCurrentVideo(videoIndex);
      setShowVideoPlayer(true);
      if (isFullscreen) {
        togglePiP(); // Move avatar to PiP when showing video
      }
    }
  };

  // Close video player
  const closeVideo = () => {
    setShowVideoPlayer(false);
    setCurrentVideo(null);
    if (!isFullscreen) {
      toggleFullscreen(); // Return avatar to fullscreen
    }
  };

  // Handle CTA click
  const handleCTAClick = () => {
    if (demoData.ctaLink) {
      window.open(demoData.ctaLink, '_blank');
    }
  };

  // Mouse event handlers for dragging PiP
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('control-btn')) return;
    setIsDragging(true);
    const rect = pipContainerRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging && pipContainerRef.current) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      pipContainerRef.current.style.left = `${newX}px`;
      pipContainerRef.current.style.top = `${newY}px`;
      pipContainerRef.current.style.right = 'auto';
      pipContainerRef.current.style.bottom = 'auto';
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Add global mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Track tool call handlers with refs to avoid dependency issues
  const onToolCallRef = useRef<(name: string, args: any) => void>();
  
  // Set up tool call handlers
  useEffect(() => {
    // Define the tool call handler function
    onToolCallRef.current = (name: string, args: any) => {
      console.log(`[TAVUS AGENT] Tool call received: ${name}`, args);
      
      switch (name) {
        case 'fetch_video':
          // Handle video fetching with enhanced matching
          const feature = args?.feature || 'product demo';
          console.log(`[TAVUS AGENT] Fetching video for: ${feature}`);
          
          // Normalize the search term
          const searchTerm = feature.toLowerCase().trim();
          
          // Define matching score function for ranking video relevance
          const getMatchScore = (videoTitle: string): number => {
            const title = videoTitle.toLowerCase();
            
            // Exact match gets highest score
            if (title === searchTerm) return 100;
            
            // Contains full search term gets high score
            if (title.includes(searchTerm)) return 80;
            
            // Check for word-by-word matches (for multi-word searches)
            const searchWords = searchTerm.split(/\s+/);
            const titleWords = title.split(/\s+/);
            
            // Count matching words
            let matchCount = 0;
            for (const word of searchWords) {
              if (word.length < 3) continue; // Skip short words
              if (titleWords.includes(word) || title.includes(word)) matchCount++;
            }
            
            // If most words match, good score
            if (matchCount > 0 && searchWords.length > 0) {
              return 60 * (matchCount / searchWords.length);
            }
            
            return 0;
          };
          
          // Score all videos
          const scoredVideos = demoData.videos.map(v => ({
            video: v,
            score: getMatchScore(v.title)
          }));
          
          // Sort by score (highest first)
          scoredVideos.sort((a, b) => b.score - a.score);
          
          if (scoredVideos.length > 0 && scoredVideos[0].score > 0) {
            // Play best match
            console.log(`[TAVUS AGENT] Found matching video: ${scoredVideos[0].video.title} (score: ${scoredVideos[0].score})`);
            playVideo(scoredVideos[0].video.order_index);
          } else if (demoData.videos.length > 0) {
            // Default to first video if no match
            console.log(`[TAVUS AGENT] No strong match found, defaulting to first video`);
            playVideo(demoData.videos[0].order_index);
          }
          break;
          
        case 'fetch_answer':
          // This would typically query the knowledge base
          console.log(`[TAVUS AGENT] Knowledge base query: ${args?.query || ''}`);
          // The agent already has access to the knowledge base through the system prompt
          break;
          
        case 'show_trial_cta':
          // Enhanced CTA handling with better analytics and error handling
          const ctaUrl = args?.url || demoData.ctaLink || 'https://www.example.com/trial';
          console.log(`[TAVUS AGENT] Showing CTA with URL: ${ctaUrl}`);
          
          try {
            // Track engagement metrics
            const engagementData = {
              interactionCount,
              sessionDuration: Date.now() - sessionStartTime,
              source: 'agent_cta_call'
            };
            
            console.log(`[TAVUS AGENT] CTA clicked with engagement data:`, engagementData);
            
            // Mark CTA as clicked for tracking
            setCtaClicked(true);
            
            // Display a CTA notification or redirect
            if (typeof window !== 'undefined') {
              // Open in new tab with fallback handling
              const newTab = window.open(ctaUrl, '_blank');
              
              // Handle popup blockers
              if (!newTab) {
                console.warn('[TAVUS AGENT] Popup was blocked, displaying manual CTA link');
                // Here you could update UI to show a direct link instead
              }
              
              // Show thank you modal after a short delay
              // This runs regardless of whether the popup was blocked
              setTimeout(() => {
                setShowThankYou(true);
              }, 1500);
            }
          } catch (err) {
            console.error('[TAVUS AGENT] Error showing CTA:', err);
            // Fallback to showing the modal even if there was an error
            setShowThankYou(true);
          }
          break;
          
        default:
          console.warn(`[TAVUS AGENT] Unknown tool call: ${name}`);
      }
    };
  }, [demoData]);

  // Enhanced interaction tracking to determine when to show thank you modal
  useEffect(() => {
    if (!showThankYou && !isLoading && !ctaClicked) {
      // Progressive engagement thresholds with shorter timeouts for higher engagement
      let timeoutDuration = 300000; // 5 minutes by default
      
      if (interactionCount >= 15) {
        timeoutDuration = 120000; // 2 minutes for highly engaged users
      } else if (interactionCount >= 10) {
        timeoutDuration = 180000; // 3 minutes for moderately engaged users
      } else if (interactionCount >= 5) {
        timeoutDuration = 240000; // 4 minutes for somewhat engaged users
      }
      
      // Only set the timer if we have at least some interaction
      if (interactionCount >= 3) {
        const timer = setTimeout(() => {
          console.log(`[TAVUS AGENT] Showing thank you modal after ${interactionCount} interactions`);
          setShowThankYou(true);
        }, timeoutDuration);
        
        return () => clearTimeout(timer);
      }
    }
  }, [interactionCount, showThankYou, isLoading, ctaClicked]);
  
  // Track message sending as interaction
  const trackInteraction = () => {
    setInteractionCount((prev: number) => prev + 1);
  };

  const currentVideoData = currentVideo ? demoData.videos?.find(v => v.order_index === currentVideo) : null;

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        padding: '20px',
        textAlign: 'center',
        background: '#000',
        color: 'white'
      }}>
        <h2>Connection Error</h2>
        <p>{error}</p>
        <button 
          onClick={() => window.location.reload()}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            background: '#3498DB',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="tavus-video-agent relative h-full w-full flex flex-col">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 z-20">
          <div className="text-center p-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mx-auto"></div>
            <p className="text-white mt-4">Connecting to AI assistant...</p>
          </div>
        </div>
      )}
      
      {/* Thank You Modal */}
      <ThankYouModal
        isOpen={showThankYou}
        onClose={() => setShowThankYou(false)}
        demoTitle={demoData.title}
        ctaLink={demoData.ctaLink || undefined}
      />
      
      {/* Fullscreen Container */}
      <div
        ref={fullscreenContainerRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: '#000',
          zIndex: 1000,
          display: isFullscreen ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div className="video-container" style={{ width: '100%', height: '100%' }}>
          {isLoading && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'white'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '4px solid #F3F3F3',
                borderTop: '4px solid #3498DB',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginBottom: '20px'
              }}></div>
              <p>Connecting to your AI assistant...</p>
            </div>
          )}
        </div>
        
        {!isLoading && (
          <div style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            zIndex: 1002,
            display: 'flex',
            gap: '10px'
          }}>
            <button 
              className="control-btn"
              onClick={togglePiP}
              style={{
                background: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                border: 'none',
                padding: '10px 15px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Picture-in-Picture
            </button>
            <button 
              className="control-btn"
              onClick={endCall}
              style={{
                background: 'rgba(220, 53, 69, 0.8)',
                color: 'white',
                border: 'none',
                padding: '10px 15px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              End Call
            </button>
          </div>
        )}

        {/* Demo Actions */}
        {!isLoading && demoData.videos?.length > 0 && (
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            right: '20px',
            display: 'flex',
            gap: '10px',
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            {demoData.videos.map((video, index) => (
              <button
                key={video.id}
                onClick={() => playVideo(video.order_index)}
                style={{
                  background: 'rgba(0, 123, 255, 0.8)',
                  color: 'white',
                  border: 'none',
                  padding: '8px 12px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Play: {video.title}
              </button>
            ))}
            {demoData.ctaLink && (
              <button
                onClick={handleCTAClick}
                style={{
                  background: 'rgba(40, 167, 69, 0.8)',
                  color: 'white',
                  border: 'none',
                  padding: '8px 12px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Learn More
              </button>
            )}
          </div>
        )}
      </div>

      {/* Picture-in-Picture Container */}
      <div
        ref={pipContainerRef}
        onMouseDown={handleMouseDown}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '300px',
          height: '200px',
          background: '#000',
          borderRadius: '10px',
          overflow: 'hidden',
          zIndex: 1001,
          cursor: 'move',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          display: !isFullscreen ? 'block' : 'none'
        }}
      >
        <div className="video-container" style={{ width: '100%', height: '100%' }}></div>
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 1002,
          display: 'flex',
          gap: '5px'
        }}>
          <button 
            className="control-btn"
            onClick={toggleFullscreen}
            style={{
              background: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              border: 'none',
              padding: '5px 8px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '10px'
            }}
          >
            ⛶
          </button>
          <button 
            className="control-btn"
            onClick={endCall}
            style={{
              background: 'rgba(220, 53, 69, 0.8)',
              color: 'white',
              border: 'none',
              padding: '5px 8px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '10px'
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Product Video Player Overlay */}
      {showVideoPlayer && currentVideoData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.9)',
          zIndex: 1500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            position: 'relative',
            width: '90%',
            maxWidth: '800px',
            // Using height instead of aspectRatio for better TypeScript compatibility
            height: '0',
            paddingTop: '56.25%', // 16:9 aspect ratio (9/16 = 0.5625)
            background: '#000',
            borderRadius: '10px',
            overflow: 'hidden'
          }}>
            <video
              src={currentVideoData.video_url}
              controls
              autoPlay
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'
              }}
            />
            <button
              onClick={closeVideo}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                border: 'none',
                padding: '8px 12px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default TavusVideoAgent;