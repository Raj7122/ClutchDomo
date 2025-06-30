'use client';

import React, { useEffect, useRef, useState } from 'react';

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
  onError?: (error: string) => void;
  onVideoStarted?: () => void;
}

interface DragOffset {
  x: number;
  y: number;
}

const TavusVideoAgent: React.FC<TavusVideoAgentProps> = ({ 
  demoData, 
  onError, 
  onVideoStarted 
}) => {
  const callRef = useRef<any>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const pipContainerRef = useRef<HTMLDivElement>(null);
  const initializationRef = useRef<boolean>(false);
  
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<DragOffset>({ x: 0, y: 0 });
  const [conversationUrl, setConversationUrl] = useState<string | null>(null);
  const [currentVideo, setCurrentVideo] = useState<number | null>(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);

  // Create conversation and initialize call
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const initializeCall = async () => {
      // Prevent multiple initializations
      if (initializationRef.current) {
        console.log('Initialization already in progress, skipping...');
        return;
      }

      initializationRef.current = true;

      try {
        setIsLoading(true);
        setError(null);

        console.log('Initializing Tavus conversation for demo:', demoData.id);

        // Aggressive cleanup before starting
        cleanupAllDailyInstances();

        // Wait a bit to ensure cleanup is complete
        await new Promise(resolve => setTimeout(resolve, 500));

        if (!isMounted) return;

        // Build system prompt with demo context
        const systemPrompt = buildSystemPrompt();

        // Create a new conversation
        const response = await fetch('/api/tavus/create-conversation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            demoId: demoData.id,
            systemPrompt
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || 'Failed to create conversation');
        }

        const data = await response.json();
        
        if (!isMounted) return;

        setConversationUrl(data.conversation_url);

        console.log('Conversation created:', data.conversation_id);
        console.log('Conversation URL:', data.conversation_url);

        // Wait another moment before creating iframe
        await new Promise(resolve => setTimeout(resolve, 300));

        if (!isMounted) return;

        // Load Daily SDK dynamically
        const DailyIframe = (await import('@daily-co/daily-js')).default;

        // Final cleanup check
        cleanupAllDailyInstances();

        // Create call frame with unique identifier
        const uniqueId = `daily-frame-${demoData.id}-${Date.now()}`;
        
        const dailyCallObject = DailyIframe.createFrame({
          id: uniqueId,
          iframeStyle: {
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: '0px'
          },
          showLeaveButton: false,
          showFullscreenButton: false
        });

        if (!isMounted) {
          dailyCallObject.destroy();
          return;
        }

        // Store globally
        if (typeof window !== 'undefined') {
          window.__GLOBAL_DAILY_INSTANCE__ = dailyCallObject;
        }

        // Add event listeners
        dailyCallObject.on('joined-meeting', (event: any) => {
          if (isMounted) {
            console.log('Successfully joined Tavus conversation');
            setIsLoading(false);
            onVideoStarted?.();
          }
        });

        dailyCallObject.on('participant-joined', (event: any) => {
          console.log('Participant joined:', event.participant?.user_name);
        });

        dailyCallObject.on('participant-left', (event: any) => {
          console.log('Participant left:', event.participant?.user_name);
        });

        dailyCallObject.on('error', (event: any) => {
          console.error('Daily.co error:', event);
          if (isMounted) {
            const errorMsg = 'Connection error occurred';
            setError(errorMsg);
            onError?.(errorMsg);
          }
        });

        // Join the conversation
        await dailyCallObject.join({ url: data.conversation_url });

        if (!isMounted) {
          dailyCallObject.destroy();
          return;
        }

        // Append to fullscreen container
        if (fullscreenContainerRef.current) {
          const videoContainer = fullscreenContainerRef.current.querySelector('.video-container');
          if (videoContainer) {
            videoContainer.appendChild(dailyCallObject.iframe());
          }
        }

        // Store local reference
        callRef.current = dailyCallObject;

      } catch (err) {
        console.error('Error initializing Tavus call:', err);
        if (isMounted) {
          const errorMsg = err instanceof Error ? err.message : 'Failed to initialize video call';
          setError(errorMsg);
          setIsLoading(false);
          onError?.(errorMsg);
        }
      } finally {
        initializationRef.current = false;
      }
    };

    if (demoData?.id) {
      // Delay initialization to avoid React Strict Mode double-mounting issues
      timeoutId = setTimeout(initializeCall, 100);
    }

    // Cleanup
    return () => {
      isMounted = false;
      
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Schedule cleanup for after component unmount
      if (typeof window !== 'undefined') {
        window.__DAILY_CLEANUP_TIMEOUT__ = setTimeout(() => {
          cleanupAllDailyInstances();
        }, 100);
      }
    };
  }, [demoData.id]);

  // Build system prompt with demo context
  const buildSystemPrompt = () => {
    let prompt = `You are an AI assistant representing ${demoData.title}. `;
    
    if (demoData.videos?.length > 0) {
      prompt += `You have access to ${demoData.videos.length} product demonstration video(s): `;
      prompt += demoData.videos.map(v => `"${v.title}"`).join(', ');
      prompt += '. You can reference these videos when discussing the product. ';
    }

    if (demoData.knowledge_base?.length > 0) {
      prompt += `You also have access to detailed product knowledge and documentation. `;
    }

    if (demoData.ctaLink) {
      prompt += `When appropriate, you can direct users to take action at: ${demoData.ctaLink}. `;
    }

    prompt += `Your goal is to help visitors understand the product, answer their questions, and guide them toward making a decision. Be helpful, informative, and engaging.`;

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
    <>
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
            aspectRatio: '16 / 9',
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
    </>
  );
};

export default TavusVideoAgent; 