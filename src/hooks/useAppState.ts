import { useState, useCallback, useMemo } from 'react';

interface AppState {
  currentVideoIndex: number;
  isVideoPlaying: boolean;
  showCtaModal: boolean;
  ctaMessage: string;
  error: string | null;
  videoUrl: string | null;
  userActivity: any[];
  isLoading: boolean;
}

export function useAppState() {
  const [state, setState] = useState<AppState>({
    currentVideoIndex: 0,
    isVideoPlaying: false,
    showCtaModal: false,
    ctaMessage: '',
    error: null,
    videoUrl: null,
    userActivity: [],
    isLoading: false,
  });

  const logActivity = useCallback((activity: any) => {
    console.log('[APP STATE] Logging activity:', activity);
    setState(prev => ({
      ...prev,
      userActivity: [...prev.userActivity, {
        ...activity,
        timestamp: new Date().toISOString()
      }]
    }));
  }, []);

  const handleVideoEnd = useCallback(() => {
    console.log('[APP STATE] Video ended');
    setState(prev => ({
      ...prev,
      isVideoPlaying: false
    }));
    logActivity({ type: 'video_ended', videoIndex: state.currentVideoIndex });
  }, [logActivity, state.currentVideoIndex]);

  const handleVideoClose = useCallback(() => {
    console.log('[APP STATE] Video closed');
    setState(prev => ({
      ...prev,
      isVideoPlaying: false,
      videoUrl: null
    }));
    logActivity({ type: 'video_closed', videoIndex: state.currentVideoIndex });
  }, [logActivity, state.currentVideoIndex]);

  const hideCtaModal = useCallback(() => {
    console.log('[APP STATE] Hiding CTA modal');
    setState(prev => ({
      ...prev,
      showCtaModal: false,
      ctaMessage: ''
    }));
  }, []);

  const clearError = useCallback(() => {
    console.log('[APP STATE] Clearing error');
    setState(prev => ({
      ...prev,
      error: null
    }));
  }, []);

  const setVideoUrl = useCallback((url: string) => {
    console.log('[APP STATE] Setting video URL:', url);
    setState(prev => ({
      ...prev,
      videoUrl: url,
      isVideoPlaying: true
    }));
  }, []);

  const setCurrentVideoIndex = useCallback((index: number) => {
    console.log('[APP STATE] Setting current video index:', index);
    setState(prev => ({
      ...prev,
      currentVideoIndex: index
    }));
    logActivity({ type: 'video_selected', videoIndex: index });
  }, [logActivity]);

  const setIsVideoPlaying = useCallback((playing: boolean) => {
    console.log('[APP STATE] Setting video playing:', playing);
    setState(prev => ({
      ...prev,
      isVideoPlaying: playing
    }));
  }, []);

  const showCTA = useCallback((message: string) => {
    console.log('[APP STATE] Showing CTA:', message);
    setState(prev => ({
      ...prev,
      showCtaModal: true,
      ctaMessage: message
    }));
    logActivity({ type: 'cta_shown', message });
  }, [logActivity]);

  const setError = useCallback((error: string) => {
    console.log('[APP STATE] Setting error:', error);
    setState(prev => ({
      ...prev,
      error
    }));
  }, []);

  // CRITICAL: useMemo fix to prevent white screen crashes
  const actions = useMemo(() => ({
    logActivity,
    handleVideoEnd,
    handleVideoClose,
    hideCtaModal,
    clearError,
    setVideoUrl,
    setCurrentVideoIndex,
    setIsVideoPlaying,
    showCTA,
    setError,
  }), [
    logActivity,
    handleVideoEnd,
    handleVideoClose,
    hideCtaModal,
    clearError,
    setVideoUrl,
    setCurrentVideoIndex,
    setIsVideoPlaying,
    showCTA,
    setError,
  ]);

  return {
    state,
    actions,
  };
} 