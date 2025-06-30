'use client';

import React, { useState, useEffect, useRef } from 'react';
import DailyIframe from '@daily-co/daily-js';

// Global tracking to prevent duplicate instances
let globalDailyInstance: any = null;
let isCreatingInstance = false;
let initializationCount = 0;

interface VideoAvatarProps {
  conversationUrl: string;
  agentStatus?: 'ready' | 'initializing' | 'error';
  onVideoStarted?: () => void;
  isShowingProductVideo?: boolean;
  demoData?: {
    title: string;
    videos: Array<{ id: string; title: string; video_url: string; order_index: number }>;
    ctaLink?: string;
  };
}

const VideoAvatar: React.FC<VideoAvatarProps> = ({ 
  conversationUrl, 
  agentStatus = 'ready',
  onVideoStarted = () => {},
  isShowingProductVideo = false,
  demoData
}) => {
  const iframeRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<any>(null);
  const [displayMode, setDisplayMode] = useState<'fullscreen' | 'pip'>('fullscreen');
  const [currentVideo, setCurrentVideo] = useState<number | null>(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);

  // Initialize Daily.co call when ready
  useEffect(() => {
    let isMounted = true;
    const currentCount = ++initializationCount;
    
    const cleanupAll = () => {
      // Remove all existing Daily iframes from DOM
      const existingIframes = document.querySelectorAll('iframe[src*="daily.co"], iframe[src*="tavus"]');
      existingIframes.forEach(iframe => {
        try {
          iframe.remove();
        } catch (e) {
          console.warn('Error removing existing iframe:', e);
        }
      });

      // Cleanup global instance
      if (globalDailyInstance) {
        try {
          globalDailyInstance.destroy();
        } catch (e) {
          console.warn('Error destroying global instance:', e);
        }
        globalDailyInstance = null;
      }

      // Cleanup local reference
      if (callRef.current) {
        try {
          callRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying local instance:', e);
        }
        callRef.current = null;
      }
    };

    const initializeDaily = async () => {
      if (!isMounted || isCreatingInstance) {
        console.log(`Skipping initialization ${currentCount} - mounted: ${isMounted}, creating: ${isCreatingInstance}`);
        return;
      }

      console.log(`Starting Daily initialization ${currentCount}`);
      isCreatingInstance = true;

      try {
        // Aggressive cleanup first
        cleanupAll();

        if (agentStatus === 'ready' && conversationUrl && iframeRef.current && isMounted) {
          // Clear container
          if (iframeRef.current) {
            iframeRef.current.innerHTML = '';
          }

          // Longer delay to ensure cleanup is complete
          await new Promise(resolve => setTimeout(resolve, 500));
          
          if (!isMounted) {
            console.log(`Initialization ${currentCount} cancelled - component unmounted`);
            return;
          }

          console.log(`Creating Daily frame ${currentCount} with URL:`, conversationUrl);
          
          // Create the frame
          const dailyCallObject = DailyIframe.createFrame(iframeRef.current, {
            url: conversationUrl,
            showLeaveButton: false,
            iframeStyle: {
              width: '100%',
              height: '100%',
              border: '0',
              borderRadius: '0px'
            },
            showFullscreenButton: false
          });
          
          if (!isMounted) {
            dailyCallObject.destroy();
            return;
          }
          
          // Setup event handlers
          dailyCallObject.on('joined-meeting', () => {
            console.log(`Avatar ${currentCount} joined the meeting`);
            onVideoStarted();
          });

          dailyCallObject.on('participant-joined', (event) => {
            console.log(`Participant joined ${currentCount}:`, event.participant.user_name);
          });

          dailyCallObject.on('error', (event) => {
            console.error(`Daily.co error ${currentCount}:`, event);
          });
          
          // Store references
          callRef.current = dailyCallObject;
          globalDailyInstance = dailyCallObject;
          
          console.log(`Daily.co frame ${currentCount} created successfully`);
        }
      } catch (error) {
        console.error(`Failed to create Daily.co frame ${currentCount}:`, error);
        
        // If creation fails, try one more aggressive cleanup
        cleanupAll();
      } finally {
        isCreatingInstance = false;
      }
    };

    // Delay initial creation to avoid React Strict Mode conflicts
    const timeout = setTimeout(initializeDaily, 200);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      
      console.log(`Cleaning up initialization ${currentCount}`);
      
      if (callRef.current) {
        try {
          callRef.current.destroy();
        } catch (e) {
          console.warn('Error in cleanup:', e);
        }
        callRef.current = null;
      }
      
      if (globalDailyInstance === callRef.current) {
        globalDailyInstance = null;
      }
    };
  }, [agentStatus, conversationUrl]);
  
  // Handle display mode changes
  useEffect(() => {
    if (isShowingProductVideo && displayMode !== 'pip') {
      setDisplayMode('pip');
    } else if (!isShowingProductVideo && displayMode !== 'fullscreen') {
      setDisplayMode('fullscreen');
    }
  }, [isShowingProductVideo]);

  // Handle video playback requests
  const playVideo = (videoIndex: number) => {
    if (demoData?.videos && demoData.videos[videoIndex - 1]) {
      setCurrentVideo(videoIndex);
      setShowVideoPlayer(true);
      setDisplayMode('pip');
    }
  };

  const closeVideo = () => {
    setShowVideoPlayer(false);
    setCurrentVideo(null);
    setDisplayMode('fullscreen');
  };

  // Handle CTA click
  const handleCTAClick = () => {
    if (demoData?.ctaLink) {
      window.open(demoData.ctaLink, '_blank');
    }
  };

  const currentVideoData = currentVideo ? demoData?.videos.find(v => v.order_index === currentVideo) : null;

  return (
    <div className="video-avatar-container">
      {/* Main Avatar Container */}
      <div
        className={`avatar-container ${displayMode === 'pip' ? 'pip-mode' : 'fullscreen-mode'}`}
        role="complementary"
        aria-label="AI Assistant"
      >
        <div 
          className={`avatar-frame ${displayMode}`}
          style={displayMode === 'pip' ? {
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '280px',
            height: '180px',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            transition: 'all 0.3s ease-in-out',
            zIndex: 1000,
            background: '#000'
          } : {
            width: '100%',
            height: '100vh',
            position: 'relative',
            background: '#000'
          }}
        >
          {agentStatus === 'ready' ? (
            <div 
              ref={iframeRef}
              className="daily-iframe-container"
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <div className="avatar-loading" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'white',
              fontSize: '18px'
            }}>
              {agentStatus === 'initializing' ? (
                <div>
                  <div className="loading-spinner" style={{
                    border: '3px solid #f3f3f3',
                    borderTop: '3px solid #3498db',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 10px'
                  }} />
                  Initializing AI Assistant...
                </div>
              ) : (
                <div>Connection Error - Please refresh</div>
              )}
            </div>
          )}

          {/* PiP Controls */}
          {displayMode === 'pip' && (
            <button
              onClick={() => setDisplayMode('fullscreen')}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: 'rgba(0,0,0,0.7)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Expand
            </button>
          )}
        </div>
      </div>

      {/* Product Video Player Overlay */}
      {showVideoPlayer && currentVideoData && (
        <div className="video-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.9)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div className="video-player-container" style={{
            position: 'relative',
            width: '90%',
            maxWidth: '800px',
            background: '#000',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            {/* Close Button */}
            <button
              onClick={closeVideo}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(0,0,0,0.7)',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                zIndex: 1001,
                fontSize: '18px'
              }}
            >
              ×
            </button>

            {/* Video Title */}
            <div style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              color: 'white',
              fontSize: '18px',
              fontWeight: 'bold',
              zIndex: 1001
            }}>
              {currentVideoData.title}
            </div>

            {/* Video Element */}
            <video
              src={currentVideoData.video_url}
              controls
              autoPlay
              style={{
                width: '100%',
                height: 'auto',
                minHeight: '400px'
              }}
              onEnded={closeVideo}
            />
          </div>
        </div>
      )}

      {/* Demo Info Panel (when in fullscreen) */}
      {displayMode === 'fullscreen' && demoData && (
        <div className="demo-info-panel" style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          right: '20px',
          background: 'rgba(255,255,255,0.95)',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          zIndex: 100
        }}>
          <h1 style={{ margin: '0 0 10px 0', fontSize: '24px', color: '#333' }}>
            {demoData.title}
          </h1>
          <p style={{ margin: '0 0 15px 0', color: '#666' }}>
            Ask me anything about our product, or request to see specific features!
          </p>
          
          {/* Quick Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {demoData.videos.map((video) => (
              <button
                key={video.id}
                onClick={() => playVideo(video.order_index)}
                style={{
                  background: '#3498db',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                View: {video.title}
              </button>
            ))}
            
            {demoData.ctaLink && (
              <button
                onClick={handleCTAClick}
                style={{
                  background: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                Get Started
              </button>
            )}
          </div>
        </div>
      )}

      {/* CSS Animation */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .avatar-container {
          transition: all 0.4s ease;
        }
        
        .fullscreen-mode {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          z-index: 100;
        }
        
        @media (max-width: 768px) {
          .avatar-frame.pip {
            width: 160px !important;
            height: 120px !important;
            bottom: 80px !important;
          }
          
          .demo-info-panel {
            position: static !important;
            margin: 10px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default VideoAvatar; 