'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabaseClient';
import TavusVideoChat from '@/components/TavusVideoChat';
import TavusAvatar from '@/src/components/TavusAvatar';
import { useSharedAppState } from '@/src/contexts/AppStateProvider';
import { toolCallService } from '@/src/services/toolCallService';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  SkipForward, 
  SkipBack,
  Share,
  Bookmark,
  Star,
  ExternalLink,
  ArrowLeft,
  Clock,
  Users,
  Eye,
  ThumbsUp,
  Download,
  Settings,
  Loader2,
  MessageCircle,
  Video as VideoIcon,
  Zap,
  Bot,
  PlayCircle,
  PauseCircle,
  RotateCcw,
  RotateCw,
  Maximize2,
  Minimize2,
  AlertTriangle
} from 'lucide-react';

interface Demo {
  id: string;
  title: string;
  status: string;
  cta_link: string | null;
  knowledge_base_content: string | null;
  created_at: string;
  user_id: string;
}

interface Video {
  id: string;
  title: string;
  filename: string;
  video_url: string;
  thumbnail_url: string | null;
  order_index: number;
  duration_seconds: number | null;
  created_at: string;
}

interface KnowledgeBaseChunk {
  id: string;
  content: string;
  chunk_index: number;
}

export default function DemoViewPage() {
  const params = useParams();
  const demoId = params.id as string;
  
  // App state integration
  const { actions } = useSharedAppState();
  
  // Demo data
  const [demo, setDemo] = useState<Demo | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBaseChunk[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Video player state
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [videoError, setVideoError] = useState(false);
  
  // UI state
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [rating, setRating] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const [showTavusChat, setShowTavusChat] = useState(false);
  const [showCTA, setShowCTA] = useState(false);
  const [ctaMessage, setCTAMessage] = useState('');
  const [showVideoList, setShowVideoList] = useState(true);
  const [aiTriggeredVideo, setAiTriggeredVideo] = useState<number | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const playerContainerRef = useRef<HTMLDivElement>(null);

  // Load demo data
  useEffect(() => {
    if (demoId) {
      loadDemoData();
      trackView();
    }
  }, [demoId]);

  // Initialize first video
  useEffect(() => {
    if (videos.length > 0 && !currentVideo) {
      setCurrentVideo(videos[0]);
    }
  }, [videos, currentVideo]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      playNextVideo();
    };
    const handleLoadedData = () => setDuration(video.duration);
    const handleError = () => {
      console.error('Video error:', video.error);
      setVideoError(true);
      setIsPlaying(false);
    };
    const handleLoadStart = () => {
      setVideoError(false);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);
    video.addEventListener('loadstart', handleLoadStart);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
      video.removeEventListener('loadstart', handleLoadStart);
    };
  }, [currentVideo]);

  // Auto-hide controls
  useEffect(() => {
    if (showControls) {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        if (isPlaying) {
          setShowControls(false);
        }
      }, 3000);
    }
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [showControls, isPlaying]);

  // Fullscreen handling
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const loadDemoData = async () => {
    try {
      setIsLoading(true);
      
      // Load demo details
      const { data: demoData, error: demoError } = await supabase
        .from('demos')
        .select('*')
        .eq('id', demoId)
        .eq('status', 'published')
        .single();

      if (demoError || !demoData) {
        setError('Demo not found or not published');
        return;
      }

      setDemo(demoData);

      // Load videos
      const { data: videosData, error: videosError } = await supabase
        .from('videos')
        .select('*')
        .eq('demo_id', demoId)
        .order('order_index', { ascending: true });

      if (!videosError && videosData) {
        setVideos(videosData);
      }

      // Load knowledge base
      const { data: kbData, error: kbError } = await supabase
        .from('knowledge_base_chunks')
        .select('*')
        .eq('demo_id', demoId)
        .order('chunk_index', { ascending: true });

      if (!kbError && kbData) {
        setKnowledgeBase(kbData);
      }

    } catch (error) {
      console.error('Failed to load demo:', error);
      setError('Failed to load demo');
    } finally {
      setIsLoading(false);
    }
  };

  const trackView = async () => {
    try {
      const response = await fetch('/api/demos/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          demoId,
          event: 'view',
          metadata: {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            referrer: document.referrer
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        setViewCount(result.data?.totalViews || Math.floor(Math.random() * 100) + 50);
      }
    } catch (error) {
      console.error('Failed to track view:', error);
    }
  };

  // Helper function to validate video URL
  const isValidVideoUrl = (url: string | null | undefined): boolean => {
    if (!url || typeof url !== 'string' || url.trim() === '') {
      return false;
    }
    
    // Basic URL validation
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Video player controls
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || videoError || !currentVideo || !isValidVideoUrl(currentVideo.video_url)) return;

    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(console.error);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !duration || videoError) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const skipTime = (seconds: number) => {
    const video = videoRef.current;
    if (!video || videoError) return;

    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video || videoError) return;

    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video || videoError) return;

    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleFullscreen = async () => {
    if (!playerContainerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await playerContainerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  const changePlaybackRate = () => {
    const video = videoRef.current;
    if (!video || videoError) return;

    const rates = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    
    video.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const playVideo = (video: Video) => {
    setCurrentVideo(video);
    setCurrentTime(0);
    setVideoError(false);
    setAiTriggeredVideo(null); // Clear AI trigger indicator
    
    // Track video play
    fetch('/api/demos/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        demoId,
        event: 'video_play',
        metadata: { videoId: video.id, videoTitle: video.title }
      })
    }).catch(console.error);
  };

  const playNextVideo = () => {
    if (!currentVideo) return;
    
    const currentIndex = videos.findIndex(v => v.id === currentVideo.id);
    const nextIndex = (currentIndex + 1) % videos.length;
    playVideo(videos[nextIndex]);
  };

  const playPreviousVideo = () => {
    if (!currentVideo) return;
    
    const currentIndex = videos.findIndex(v => v.id === currentVideo.id);
    const prevIndex = currentIndex === 0 ? videos.length - 1 : currentIndex - 1;
    playVideo(videos[prevIndex]);
  };

  // Tavus integration handlers
  const handleVideoPlayFromAI = (videoIndex: number) => {
    const video = videos[videoIndex - 1]; // Convert 1-based to 0-based index
    if (video) {
      setAiTriggeredVideo(videoIndex);
      playVideo(video);
      console.log('AI triggered video play:', video.title);
      
      // Show notification
      setTimeout(() => setAiTriggeredVideo(null), 5000);
    }
  };

  const handleCTAFromAI = (message: string) => {
    setCTAMessage(message);
    setShowCTA(true);
    console.log('AI triggered CTA:', message);
  };

  const handleAnalyticsEvent = (event: string, data: any) => {
    // Track Tavus-related analytics
    fetch('/api/demos/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        demoId,
        event,
        metadata: data
      })
    }).catch(console.error);
  };

  // Tool call handler for the new TavusAvatar
  const routeToolCall = async (name: string, args: any) => {
    console.log(`[DEMO PAGE] Tool call received: ${name}`, args);
    
    try {
      const result = await toolCallService.executeToolCall(name, args, actions);
      
      // Handle specific tool calls that affect the demo page
      if (name === 'play_video' && args.videoIndex !== undefined) {
        const targetVideo = videos[args.videoIndex];
        if (targetVideo) {
          playVideo(targetVideo);
          setAiTriggeredVideo(args.videoIndex);
        }
      }
      
      if (name === 'show_cta' && args.message) {
        handleCTAFromAI(args.message);
      }
      
      return result;
    } catch (error) {
      console.error('[DEMO PAGE] Tool call failed:', error);
      throw error;
    }
  };

  // Utility functions
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleShare = async () => {
    const shareData = {
      title: demo?.title || 'Check out this demo',
      text: `Take a look at this interactive demo: ${demo?.title}`,
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        // Show copied notification
      }
    } catch (error) {
      console.error('Failed to share:', error);
    }
  };

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
  };

  const handleRating = (newRating: number) => {
    setRating(newRating);
  };

  // Prepare demo data for Tavus
  const demoDataForTavus = demo ? {
    title: demo.title,
    knowledgeBase: knowledgeBase.map(chunk => chunk.content).join('\n\n'),
    videos: videos.map(video => ({
      id: video.id,
      title: video.title,
      order_index: video.order_index
    })),
    ctaLink: demo.cta_link || undefined
  } : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-slate-600" />
          <p className="text-slate-600">Loading interactive demo...</p>
        </div>
      </div>
    );
  }

  if (error || !demo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm max-w-md">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Eye className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-800 mb-2">Demo Not Found</h2>
            <p className="text-slate-600 mb-6">
              {error || 'The demo you\'re looking for could not be found or is not published.'}
            </p>
            <Link href="/">
              <Button className="bg-slate-800 hover:bg-slate-700">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-2xl font-bold text-slate-800">
                DOMO
              </Link>
              <div className="h-6 w-px bg-slate-200" />
              <h1 className="text-xl font-semibold text-slate-800">{demo.title}</h1>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <Zap className="w-3 h-3 mr-1" />
                AI-Powered
              </Badge>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-4 text-sm text-slate-600">
                <div className="flex items-center space-x-1">
                  <Eye className="w-4 h-4" />
                  <span>{viewCount} views</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="w-4 h-4" />
                  <span>{Math.round(videos.reduce((acc, v) => acc + (v.duration_seconds || 0), 0) / 60)} min total</span>
                </div>
                <div className="flex items-center space-x-1">
                  <VideoIcon className="w-4 h-4" />
                  <span>{videos.length} videos</span>
                </div>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
              >
                <Share className="w-4 h-4 mr-2" />
                Share
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleBookmark}
                className={isBookmarked ? 'bg-blue-50 text-blue-600' : ''}
              >
                <Bookmark className="w-4 h-4" />
              </Button>

              <Button
                onClick={() => setShowTavusChat(!showTavusChat)}
                className="bg-slate-800 hover:bg-slate-700"
              >
                <Bot className="w-4 h-4 mr-2" />
                {showTavusChat ? 'Hide' : 'Chat with'} AI
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Main Video Player */}
          <div className="lg:col-span-3 space-y-6">
            {/* AI Triggered Video Notification */}
            {aiTriggeredVideo && (
              <Alert className="border-blue-200 bg-blue-50">
                <Bot className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <strong>AI Assistant:</strong> Playing video {aiTriggeredVideo} as requested - {currentVideo?.title}
                </AlertDescription>
              </Alert>
            )}

            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm overflow-hidden">
              <div 
                ref={playerContainerRef}
                className={`relative ${isFullscreen ? 'h-screen' : 'aspect-video'} bg-black`}
              >
                {currentVideo && isValidVideoUrl(currentVideo.video_url) && !videoError ? (
                  <>
                    <video
                      ref={videoRef}
                      src={currentVideo.video_url}
                      poster={currentVideo.thumbnail_url || undefined}
                      className="w-full h-full object-contain"
                      onMouseMove={() => setShowControls(true)}
                      onClick={togglePlay}
                    />
                    
                    {/* Video Controls Overlay */}
                    <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity duration-300 ${
                      showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}>
                      {/* Play/Pause Button */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Button
                          variant="ghost"
                          size="lg"
                          onClick={togglePlay}
                          className="w-16 h-16 rounded-full bg-black/50 hover:bg-black/70 text-white pointer-events-auto"
                        >
                          {isPlaying ? (
                            <PauseCircle className="w-8 h-8" />
                          ) : (
                            <PlayCircle className="w-8 h-8" />
                          )}
                        </Button>
                      </div>

                      {/* Bottom Controls */}
                      <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2 pointer-events-auto">
                        {/* Progress Bar */}
                        <div 
                          className="w-full h-2 bg-white/20 rounded-full cursor-pointer"
                          onClick={handleSeek}
                        >
                          <div 
                            className="h-full bg-white rounded-full transition-all duration-150"
                            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                          />
                        </div>

                        {/* Control Buttons */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={playPreviousVideo}
                              className="text-white hover:bg-white/20"
                            >
                              <SkipBack className="w-4 h-4" />
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => skipTime(-10)}
                              className="text-white hover:bg-white/20"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={togglePlay}
                              className="text-white hover:bg-white/20"
                            >
                              {isPlaying ? (
                                <Pause className="w-4 h-4" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => skipTime(10)}
                              className="text-white hover:bg-white/20"
                            >
                              <RotateCw className="w-4 h-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={playNextVideo}
                              className="text-white hover:bg-white/20"
                            >
                              <SkipForward className="w-4 h-4" />
                            </Button>

                            <div className="flex items-center space-x-2 ml-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={toggleMute}
                                className="text-white hover:bg-white/20"
                              >
                                {isMuted ? (
                                  <VolumeX className="w-4 h-4" />
                                ) : (
                                  <Volume2 className="w-4 h-4" />
                                )}
                              </Button>
                              
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={isMuted ? 0 : volume}
                                onChange={handleVolumeChange}
                                className="w-20 h-1 bg-white/20 rounded-full appearance-none slider"
                              />
                            </div>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={changePlaybackRate}
                              className="text-white hover:bg-white/20 text-xs"
                            >
                              {playbackRate}x
                            </Button>
                          </div>

                          <div className="flex items-center space-x-2">
                            <span className="text-white text-sm">
                              {formatTime(currentTime)} / {formatTime(duration)}
                            </span>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={toggleFullscreen}
                              className="text-white hover:bg-white/20"
                            >
                              {isFullscreen ? (
                                <Minimize2 className="w-4 h-4" />
                              ) : (
                                <Maximize2 className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-white">
                    <div className="text-center">
                      {videoError || (currentVideo && !isValidVideoUrl(currentVideo.video_url)) ? (
                        <>
                          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-400" />
                          <p className="text-lg mb-2">Video Unavailable</p>
                          <p className="text-sm text-gray-300">
                            {currentVideo ? 'The video source is invalid or cannot be loaded.' : 'No video selected.'}
                          </p>
                          {videos.length > 1 && (
                            <Button
                              variant="outline"
                              onClick={playNextVideo}
                              className="mt-4 text-white border-white hover:bg-white hover:text-black"
                            >
                              Try Next Video
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          <Play className="w-16 h-16 mx-auto mb-4 opacity-50" />
                          <p className="text-lg">No videos available</p>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Video Info */}
            {currentVideo && (
              <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-800 mb-2">
                        {currentVideo.title}
                      </h2>
                      <div className="flex items-center space-x-4 text-sm text-slate-600">
                        <span>{formatTime(currentVideo.duration_seconds || 0)}</span>
                        <span>•</span>
                        <span>Video {videos.findIndex(v => v.id === currentVideo.id) + 1} of {videos.length}</span>
                        <span>•</span>
                        <span>{new Date(currentVideo.created_at).toLocaleDateString()}</span>
                        {!isValidVideoUrl(currentVideo.video_url) && (
                          <>
                            <span>•</span>
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Invalid Source
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => handleRating(star)}
                          className={`transition-colors ${
                            star <= rating ? 'text-yellow-400' : 'text-slate-300'
                          }`}
                        >
                          <Star className="w-5 h-5 fill-current" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {demo.cta_link && (
                    <div className="pt-4 border-t">
                      <a
                        href={demo.cta_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg transition-colors"
                      >
                        Get Started
                        <ExternalLink className="w-4 h-4 ml-2" />
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Tavus AI Avatar */}
            {showTavusChat && demoDataForTavus && (
              <div className="space-y-4">
                <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-lg text-slate-800 flex items-center">
                      <Bot className="w-5 h-5 mr-2" />
                      AI Video Assistant
                    </CardTitle>
                    <CardDescription>
                      Interactive AI agent with real-time conversation
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TavusAvatar
                      onToolCall={routeToolCall}
                      demoData={demoDataForTavus}
                      autoStart={true}
                      className="w-full"
                    />
                  </CardContent>
                </Card>
                
                {/* Legacy TavusVideoChat for comparison */}
                <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-lg text-slate-800">Legacy Chat Interface</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TavusVideoChat
                      demoId={demoId}
                      demoData={demoDataForTavus}
                      onVideoPlay={handleVideoPlayFromAI}
                      onCTAShow={handleCTAFromAI}
                      onAnalyticsEvent={handleAnalyticsEvent}
                    />
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* AI Assistant Toggle for Mobile */}
            <div className="lg:hidden">
              <Button
                onClick={() => setShowTavusChat(!showTavusChat)}
                className="w-full bg-slate-800 hover:bg-slate-700"
              >
                <Bot className="w-4 h-4 mr-2" />
                {showTavusChat ? 'Hide' : 'Chat with'} AI Assistant
              </Button>
            </div>

            {/* Video Playlist */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-slate-800">Video Playlist</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowVideoList(!showVideoList)}
                  >
                    {showVideoList ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </Button>
                </div>
                <CardDescription>
                  {videos.length} videos • {Math.round(videos.reduce((acc, v) => acc + (v.duration_seconds || 0), 0) / 60)} min total
                </CardDescription>
              </CardHeader>
              {showVideoList && (
                <CardContent className="p-0">
                  <div className="space-y-1">
                    {videos.map((video, index) => (
                      <button
                        key={video.id}
                        onClick={() => playVideo(video)}
                        className={`w-full p-3 text-left hover:bg-slate-50 transition-colors border-l-4 ${
                          currentVideo?.id === video.id
                            ? 'border-slate-800 bg-slate-50'
                            : 'border-transparent'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-semibold text-slate-600">
                              {index + 1}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-slate-800 truncate">
                              {video.title}
                            </h4>
                            <div className="flex items-center space-x-2">
                              <p className="text-sm text-slate-500">
                                {formatTime(video.duration_seconds || 0)}
                              </p>
                              {!isValidVideoUrl(video.video_url) && (
                                <Badge variant="destructive" className="text-xs">
                                  <AlertTriangle className="w-2 h-2 mr-1" />
                                  Invalid
                                </Badge>
                              )}
                            </div>
                          </div>
                          {currentVideo?.id === video.id && (
                            <div className="w-2 h-2 bg-slate-800 rounded-full flex-shrink-0" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Demo Stats */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg text-slate-800">Demo Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Eye className="w-4 h-4 text-slate-600" />
                    <span className="text-sm text-slate-600">Views</span>
                  </div>
                  <span className="font-semibold text-slate-800">{viewCount}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ThumbsUp className="w-4 h-4 text-slate-600" />
                    <span className="text-sm text-slate-600">Rating</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-3 h-3 ${
                          star <= 4 ? 'text-yellow-400 fill-current' : 'text-slate-300'
                        }`}
                      />
                    ))}
                    <span className="text-sm text-slate-600 ml-1">4.0</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-slate-600" />
                    <span className="text-sm text-slate-600">Interactions</span>
                  </div>
                  <span className="font-semibold text-slate-800">{Math.floor(viewCount * 0.3)}</span>
                </div>
              </CardContent>
            </Card>

            {/* AI Features */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg text-slate-800 flex items-center">
                  <Bot className="w-5 h-5 mr-2" />
                  AI Features
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-2">Tavus Video Avatar</h4>
                  <div className="space-y-2 text-sm text-blue-700">
                    <p>• Real-time video conversations</p>
                    <p>• Natural lip-sync and expressions</p>
                    <p>• Context-aware responses</p>
                    <p>• Smart video recommendations</p>
                  </div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-800 mb-2">Smart Interactions</h4>
                  <div className="space-y-2 text-sm text-green-700">
                    <p>• Voice-to-voice communication</p>
                    <p>• Intelligent video playback</p>
                    <p>• Personalized recommendations</p>
                    <p>• Real-time analytics</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* CTA Modal */}
      {showCTA && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full shadow-2xl">
            <CardHeader>
              <CardTitle className="text-xl text-slate-800 flex items-center">
                <Bot className="w-5 h-5 mr-2" />
                AI Recommendation
              </CardTitle>
              <CardDescription>{ctaMessage}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {demo.cta_link && (
                <a
                  href={demo.cta_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-full px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Get Started Now
                  <ExternalLink className="w-4 h-4 ml-2" />
                </a>
              )}
              <Button
                variant="outline"
                onClick={() => setShowCTA(false)}
                className="w-full"
              >
                Continue Watching
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}