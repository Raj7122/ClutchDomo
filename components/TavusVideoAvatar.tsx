'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TavusClient } from '@/lib/tavusClient';
import { 
  Mic, 
  MicOff, 
  Video as VideoIcon, 
  VideoOff, 
  Volume2, 
  VolumeX,
  Maximize,
  Minimize,
  Phone,
  PhoneOff,
  Loader2,
  AlertCircle,
  CheckCircle,
  MessageCircle,
  Zap,
  Camera,
  CameraOff,
  Users,
  Play,
  Pause,
  RefreshCw,
  Settings,
  Monitor,
  Smartphone,
  Bot,
  User
} from 'lucide-react';

interface TavusVideoAvatarProps {
  conversationId: string;
  replicaId: string;
  conversationUrl?: string;
  onMessage?: (message: any) => void;
  onStatusChange?: (status: string) => void;
  onError?: (error: Error) => void;
  className?: string;
  autoStart?: boolean;
  enableCamera?: boolean;
  enableMicrophone?: boolean;
  theme?: 'light' | 'dark' | 'auto';
}

interface MediaDevices {
  camera: boolean;
  microphone: boolean;
  speaker: boolean;
}

interface ConnectionStats {
  latency: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  bandwidth: number;
  packetsLost: number;
}

export default function TavusVideoAvatar({
  conversationId,
  replicaId,
  conversationUrl,
  onMessage,
  onStatusChange,
  onError,
  className = '',
  autoStart = false,
  enableCamera = true,
  enableMicrophone = true,
  theme = 'auto'
}: TavusVideoAvatarProps) {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionStats, setConnectionStats] = useState<ConnectionStats>({
    latency: 0,
    quality: 'excellent',
    bandwidth: 0,
    packetsLost: 0
  });
  
  // Media state
  const [mediaDevices, setMediaDevices] = useState<MediaDevices>({
    camera: false,
    microphone: false,
    speaker: true
  });
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Avatar state
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [avatarEmotion, setAvatarEmotion] = useState<string>('neutral');
  const [conversationActive, setConversationActive] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [isDemoMode, setIsDemoMode] = useState(false);
  
  // UI state
  const [showControls, setShowControls] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [devicePermissions, setDevicePermissions] = useState({
    camera: 'prompt' as PermissionState,
    microphone: 'prompt' as PermissionState
  });
  
  // Refs
  const avatarContainerRef = useRef<HTMLDivElement>(null);
  const avatarIframeRef = useRef<HTMLIFrameElement>(null);
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const userStreamRef = useRef<MediaStream | null>(null);
  const tavusClientRef = useRef<TavusClient | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const sessionStartTime = useRef<Date | null>(null);
  const statsInterval = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;

  // Initialize Tavus client and connection
  useEffect(() => {
    initializeTavusConnection();
    
    if (autoStart) {
      startConversation();
    }
    
    return () => {
      cleanup();
    };
  }, [conversationId, replicaId]);

  // Auto-hide controls
  useEffect(() => {
    if (showControls && isConnected) {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 5000);
    }
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [showControls, isConnected]);

  // Session duration tracking
  useEffect(() => {
    if (conversationActive && !statsInterval.current) {
      sessionStartTime.current = new Date();
      statsInterval.current = setInterval(() => {
        if (sessionStartTime.current) {
          const duration = Math.floor((Date.now() - sessionStartTime.current.getTime()) / 1000);
          setSessionDuration(duration);
        }
        
        // Update connection stats (simulated for demo)
        setConnectionStats(prev => ({
          ...prev,
          latency: Math.floor(Math.random() * 50) + 20,
          bandwidth: Math.floor(Math.random() * 1000) + 500,
          packetsLost: Math.floor(Math.random() * 5)
        }));
      }, 1000);
    }
    
    return () => {
      if (statsInterval.current) {
        clearInterval(statsInterval.current);
      }
    };
  }, [conversationActive]);

  // Check device permissions
  useEffect(() => {
    checkDevicePermissions();
  }, []);

  const cleanup = () => {
    if (userStreamRef.current) {
      userStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (statsInterval.current) {
      clearInterval(statsInterval.current);
    }
  };

  const checkDevicePermissions = async () => {
    try {
      if (navigator.permissions) {
        const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
        const microphonePermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        
        setDevicePermissions({
          camera: cameraPermission.state,
          microphone: microphonePermission.state
        });
        
        // Update media devices availability
        const devices = await navigator.mediaDevices.enumerateDevices();
        setMediaDevices({
          camera: devices.some(device => device.kind === 'videoinput'),
          microphone: devices.some(device => device.kind === 'audioinput'),
          speaker: devices.some(device => device.kind === 'audiooutput')
        });
      }
    } catch (error) {
      console.warn('Failed to check device permissions:', error);
    }
  };

  const initializeTavusConnection = async () => {
    setIsConnecting(true);
    setConnectionError(null);
    
    try {
      console.log('Initializing Tavus connection:', { conversationId, replicaId });
      
      // Initialize Tavus client
      tavusClientRef.current = new TavusClient();
      
      // Check if client is properly configured
      const configStatus = tavusClientRef.current.getConfigurationStatus();
      console.log('Tavus configuration status:', configStatus);
      
      if (!configStatus.isConfigured && configStatus.isDevelopment) {
        console.log('Running in demo mode - Tavus API not configured');
        setIsDemoMode(true);
        setIsConnected(true);
        onStatusChange?.('connected');
        return;
      }
      
      // Check conversation status
      const status = await tavusClientRef.current.getConversationStatus(conversationId);
      console.log('Conversation status:', status);
      
      if (status.error && !status.mock) {
        throw new Error(status.error || 'Conversation is in error state');
      }
      
      setIsConnected(true);
      onStatusChange?.('connected');
      
      console.log('Tavus connection established successfully');
      
    } catch (error) {
      console.error('Failed to initialize Tavus connection:', error);
      
      // In development, still allow demo mode
      if (process.env.NODE_ENV === 'development') {
        console.log('Falling back to demo mode due to connection error');
        setIsDemoMode(true);
        setIsConnected(true);
        onStatusChange?.('connected');
        setConnectionError('Demo mode: Tavus API not available');
      } else {
        setConnectionError(error instanceof Error ? error.message : 'Connection failed');
        onError?.(error instanceof Error ? error : new Error('Connection failed'));
        
        // Attempt reconnection
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          console.log(`Attempting reconnection ${reconnectAttempts.current}/${maxReconnectAttempts}`);
          setTimeout(() => initializeTavusConnection(), 2000 * reconnectAttempts.current);
        }
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const startConversation = async () => {
    if (!isConnected) {
      await initializeTavusConnection();
      return;
    }

    try {
      setConversationActive(true);
      setIsAvatarSpeaking(true);
      
      // Send initial greeting
      const greeting = "Hello! I'm your AI assistant. How can I help you today?";
      
      if (tavusClientRef.current && !isDemoMode) {
        await tavusClientRef.current.sendMessage(conversationId, greeting, {
          emotion: 'friendly'
        });
      }
      
      onMessage?.({
        type: 'assistant',
        content: greeting,
        timestamp: new Date(),
        emotion: 'friendly'
      });
      
      // Reset speaking state after greeting
      setTimeout(() => setIsAvatarSpeaking(false), 3000);
      
      console.log('Conversation started successfully');
      
    } catch (error) {
      console.error('Failed to start conversation:', error);
      setConnectionError('Failed to start conversation');
      onError?.(error instanceof Error ? error : new Error('Failed to start conversation'));
    }
  };

  const endConversation = async () => {
    try {
      if (tavusClientRef.current && conversationId && !isDemoMode) {
        await tavusClientRef.current.endConversation(conversationId, 'user_ended');
      }
      
      // Stop user media
      if (userStreamRef.current) {
        userStreamRef.current.getTracks().forEach(track => track.stop());
        userStreamRef.current = null;
      }
      
      setConversationActive(false);
      setIsConnected(false);
      setIsCameraEnabled(false);
      onStatusChange?.('disconnected');
      
      console.log('Conversation ended successfully');
      
    } catch (error) {
      console.error('Failed to end conversation:', error);
    }
  };

  const toggleCamera = async () => {
    if (isCameraEnabled) {
      // Stop camera
      if (userStreamRef.current) {
        userStreamRef.current.getVideoTracks().forEach(track => track.stop());
      }
      setIsCameraEnabled(false);
    } else {
      // Start camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480 }, 
          audio: false 
        });
        
        if (userVideoRef.current) {
          userVideoRef.current.srcObject = stream;
        }
        
        userStreamRef.current = stream;
        setIsCameraEnabled(true);
        
      } catch (error) {
        console.error('Failed to access camera:', error);
        setConnectionError('Camera access denied');
      }
    }
  };

  const toggleMicrophone = () => {
    setIsMuted(!isMuted);
    
    if (userStreamRef.current) {
      userStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = isMuted; // Will be opposite after state update
      });
    }
  };

  const toggleFullscreen = async () => {
    if (!avatarContainerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await avatarContainerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    
    // Apply volume to avatar iframe if available
    if (avatarIframeRef.current) {
      try {
        avatarIframeRef.current.contentWindow?.postMessage({
          type: 'volume_change',
          volume: newVolume
        }, '*');
      } catch (error) {
        console.warn('Failed to update avatar volume:', error);
      }
    }
  };

  const sendMessage = async (message: string, options?: { emotion?: string }) => {
    if (!tavusClientRef.current || !isConnected) return;

    try {
      setIsAvatarSpeaking(true);
      
      let response;
      if (isDemoMode) {
        // Simulate response in demo mode
        response = {
          type: 'assistant',
          content: `I understand you said: "${message}". This is a demo response since Tavus API is not configured.`,
          timestamp: new Date(),
          emotion: options?.emotion || 'neutral'
        };
      } else {
        response = await tavusClientRef.current.sendMessage(conversationId, message, {
          emotion: options?.emotion || 'neutral'
        });
      }
      
      onMessage?.(response);
      
      // Update avatar emotion
      setAvatarEmotion(options?.emotion || 'neutral');
      
      // Reset speaking state
      setTimeout(() => setIsAvatarSpeaking(false), 2000);
      
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsAvatarSpeaking(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-blue-600';
      case 'fair': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsMinimized(false)}
          className="rounded-full w-16 h-16 bg-slate-800 hover:bg-slate-700 shadow-lg relative"
        >
          <VideoIcon className="w-6 h-6 text-white" />
          {isConnected && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
          )}
          {isAvatarSpeaking && (
            <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-white animate-pulse" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <Card className={`shadow-xl border-0 bg-white/95 backdrop-blur-sm transition-all duration-300 ${
      isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'relative'
    } ${className}`}>
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-slate-50 to-slate-100">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${
              isConnected ? 'bg-green-500' : isConnecting ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
            }`} />
            <h3 className="font-semibold text-slate-800">AI Video Avatar</h3>
            {isConnected && (
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                <Zap className="w-3 h-3 mr-1" />
                {isDemoMode ? 'Demo' : 'Live'}
              </Badge>
            )}
            {conversationActive && (
              <div className="flex items-center space-x-4 text-xs text-slate-500">
                <span>{formatDuration(sessionDuration)}</span>
                <span className={getQualityColor(connectionStats.quality)}>
                  {connectionStats.quality}
                </span>
                <span>{connectionStats.latency}ms</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMinimized(true)}
            >
              <Minimize className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Avatar Container */}
        <div 
          ref={avatarContainerRef}
          className={`relative bg-gradient-to-br from-slate-800 to-slate-900 ${
            isFullscreen ? 'h-[calc(100vh-120px)]' : 'h-96'
          }`}
          onMouseMove={() => setShowControls(true)}
        >
          {/* Connection Error */}
          {connectionError && !isConnected && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
              <Alert className="max-w-md bg-white">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-3">
                    <p>{connectionError}</p>
                    <div className="flex space-x-2">
                      <Button onClick={initializeTavusConnection} size="sm">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Retry
                      </Button>
                      {reconnectAttempts.current > 0 && (
                        <span className="text-xs text-slate-500 self-center">
                          Attempt {reconnectAttempts.current}/{maxReconnectAttempts}
                        </span>
                      )}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Loading State */}
          {isConnecting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
              <div className="text-center text-white">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                <p>Connecting to AI avatar...</p>
                <p className="text-sm text-slate-300 mt-2">
                  Initializing Tavus video conversation
                </p>
              </div>
            </div>
          )}

          {/* Tavus Avatar Iframe (only if we have a real conversation URL) */}
          {isConnected && conversationUrl && !isDemoMode && (
            <iframe
              ref={avatarIframeRef}
              src={conversationUrl}
              className="w-full h-full border-0"
              allow="camera; microphone; autoplay; fullscreen"
              title="Tavus AI Avatar"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          )}

          {/* Demo Avatar Interface (when in demo mode or no URL) */}
          {isConnected && (isDemoMode || !conversationUrl) && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white space-y-4">
                <div className={`w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto relative ${
                  isAvatarSpeaking ? 'animate-pulse' : ''
                }`}>
                  <Bot className="w-16 h-16 text-white" />
                  {isAvatarSpeaking && (
                    <div className="absolute inset-0 border-4 border-blue-400 rounded-full animate-ping" />
                  )}
                  {conversationActive && !isAvatarSpeaking && (
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                <h3 className="text-xl font-semibold">AI Sales Assistant</h3>
                <p className="text-slate-300 max-w-sm">
                  {isDemoMode 
                    ? 'Demo mode: AI avatar ready for conversation'
                    : 'Connected to Tavus AI avatar system'
                  }
                </p>
                {!conversationActive && (
                  <Button
                    onClick={startConversation}
                    className="bg-white text-slate-800 hover:bg-slate-100"
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Start Conversation
                  </Button>
                )}
                {conversationActive && (
                  <div className="flex items-center justify-center space-x-2 text-sm">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span>Ready to chat</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Not Connected State */}
          {!isConnected && !isConnecting && !connectionError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white space-y-4">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto">
                  <Users className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold">Ready to Connect</h3>
                <p className="text-slate-300 max-w-sm">
                  Initialize connection to start video conversation
                </p>
                <Button
                  onClick={initializeTavusConnection}
                  className="bg-white text-slate-800 hover:bg-slate-100"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Connect Avatar
                </Button>
              </div>
            </div>
          )}

          {/* User Video (Picture-in-Picture) */}
          {isCameraEnabled && (
            <div className="absolute top-4 right-4 w-32 h-24 bg-black rounded-lg overflow-hidden border-2 border-white/20">
              <video
                ref={userVideoRef}
                autoPlay
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-1 right-1 text-white text-xs bg-black/50 px-1 rounded">
                You
              </div>
              {isUserSpeaking && (
                <div className="absolute top-1 left-1 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              )}
            </div>
          )}

          {/* Avatar Status Indicators */}
          {isAvatarSpeaking && (
            <div className="absolute top-4 left-4 bg-blue-500 text-white px-3 py-1 rounded-full text-sm flex items-center space-x-2 animate-pulse">
              <div className="w-2 h-2 bg-white rounded-full animate-bounce" />
              <span>Avatar speaking...</span>
            </div>
          )}

          {/* Demo Mode Indicator */}
          {isDemoMode && (
            <div className="absolute top-4 left-4 bg-amber-500 text-white px-3 py-1 rounded-full text-sm flex items-center space-x-2">
              <Settings className="w-3 h-3" />
              <span>Demo Mode</span>
            </div>
          )}

          {/* Connection Quality Indicator */}
          {isConnected && (
            <div className="absolute bottom-4 left-4 bg-black/50 text-white px-2 py-1 rounded text-xs flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                connectionStats.quality === 'excellent' ? 'bg-green-400' :
                connectionStats.quality === 'good' ? 'bg-blue-400' :
                connectionStats.quality === 'fair' ? 'bg-yellow-400' : 'bg-red-400'
              }`} />
              <span>{connectionStats.quality}</span>
              <span>•</span>
              <span>{connectionStats.latency}ms</span>
            </div>
          )}

          {/* Controls Overlay */}
          {showControls && isConnected && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleMicrophone}
                    className="text-white hover:bg-white/20"
                  >
                    {isMuted ? (
                      <MicOff className="w-5 h-5" />
                    ) : (
                      <Mic className="w-5 h-5" />
                    )}
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleCamera}
                    className="text-white hover:bg-white/20"
                    disabled={!mediaDevices.camera}
                  >
                    {isCameraEnabled ? (
                      <Camera className="w-5 h-5" />
                    ) : (
                      <CameraOff className="w-5 h-5" />
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsVideoEnabled(!isVideoEnabled)}
                    className="text-white hover:bg-white/20"
                  >
                    {isVideoEnabled ? (
                      <VideoIcon className="w-5 h-5" />
                    ) : (
                      <VideoOff className="w-5 h-5" />
                    )}
                  </Button>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleVolumeChange(volume === 0 ? 1 : 0)}
                      className="text-white hover:bg-white/20"
                    >
                      {volume === 0 ? (
                        <VolumeX className="w-5 h-5" />
                      ) : (
                        <Volume2 className="w-5 h-5" />
                      )}
                    </Button>
                    
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={volume}
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                      className="w-20 h-1 bg-white/20 rounded-full appearance-none slider"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {conversationActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={endConversation}
                      className="text-white hover:bg-red-500/20"
                    >
                      <PhoneOff className="w-5 h-5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Device Status */}
        <div className="border-t bg-slate-50 p-3">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <Camera className="w-3 h-3" />
                <span className={mediaDevices.camera ? 'text-green-600' : 'text-red-600'}>
                  {mediaDevices.camera ? 'Available' : 'Unavailable'}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <Mic className="w-3 h-3" />
                <span className={mediaDevices.microphone ? 'text-green-600' : 'text-red-600'}>
                  {mediaDevices.microphone ? 'Available' : 'Unavailable'}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <Volume2 className="w-3 h-3" />
                <span className={mediaDevices.speaker ? 'text-green-600' : 'text-red-600'}>
                  {mediaDevices.speaker ? 'Available' : 'Unavailable'}
                </span>
              </div>
            </div>
            
            {conversationActive && (
              <div className="flex items-center space-x-2">
                <span>Session: {formatDuration(sessionDuration)}</span>
                <span>•</span>
                <span>Replica: {replicaId.substring(0, 8)}...</span>
                {isDemoMode && (
                  <>
                    <span>•</span>
                    <span className="text-amber-600">Demo Mode</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}