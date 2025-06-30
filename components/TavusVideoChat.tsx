'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { TavusClient, generateTavusSystemPrompt } from '@/lib/tavusClient';
import TavusVideoAvatar from '@/components/TavusVideoAvatar';
import CTAModal from '@/components/CTAModal';
import { ctaUtils } from '@/lib/ctaLogic';
import { 
  Mic, 
  MicOff, 
  Video as VideoIcon, 
  VideoOff, 
  Volume2, 
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  Phone,
  PhoneOff,
  Loader2,
  AlertCircle,
  CheckCircle,
  MessageCircle,
  Send,
  RefreshCw,
  Camera,
  CameraOff,
  Users,
  Zap,
  Play,
  Pause,
  Bot,
  Monitor,
  Smartphone,
  Headphones,
  Wifi,
  WifiOff,
  Target,
  TrendingUp
} from 'lucide-react';

interface TavusVideoChatProps {
  demoId: string;
  demoData: {
    title: string;
    knowledgeBase: string;
    videos: Array<{ id: string; title: string; order_index: number }>;
    ctaLink?: string;
  };
  onVideoPlay?: (videoIndex: number) => void;
  onCTAShow?: (message: string) => void;
  onAnalyticsEvent?: (event: string, data: any) => void;
}

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  action?: any;
  confidence?: number;
  emotion?: string;
}

interface TavusSession {
  conversation_id: string;
  replica_id: string;
  status: string;
  conversation_url?: string;
  avatar_name?: string;
  mock_session?: boolean;
  is_configured?: boolean;
}

interface UserBehavior {
  sessionDuration: number;
  videosWatched: number;
  questionsAsked: number;
  engagementScore: number;
  messagesSent: number;
  specificInterests: string[];
  conversionSignals: string[];
}

export default function TavusVideoChat({
  demoId,
  demoData,
  onVideoPlay,
  onCTAShow,
  onAnalyticsEvent
}: TavusVideoChatProps) {
  // Session state
  const [tavusSession, setTavusSession] = useState<TavusSession | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'fair' | 'poor'>('excellent');
  const [latency, setLatency] = useState(0);
  
  // Conversation state
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [conversationStarted, setConversationStarted] = useState(false);
  
  // Media state
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isListening, setIsListening] = useState(false);
  
  // UI state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [sessionStats, setSessionStats] = useState({
    duration: 0,
    messagesExchanged: 0,
    videosTriggered: 0,
    avgResponseTime: 0
  });

  // CTA state
  const [showCTAModal, setShowCTAModal] = useState(false);
  const [ctaTrigger, setCTATrigger] = useState<any>(null);
  const [userBehavior, setUserBehavior] = useState<UserBehavior>({
    sessionDuration: 0,
    videosWatched: 0,
    questionsAsked: 0,
    engagementScore: 0,
    messagesSent: 0,
    specificInterests: [],
    conversionSignals: []
  });
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const speechRecognitionRef = useRef<any>(null);
  const sessionStartTime = useRef<Date | null>(null);
  const statsInterval = useRef<NodeJS.Timeout>();
  const responseTimeStart = useRef<number>(0);

  // Initialize Tavus session
  useEffect(() => {
    initializeTavusSession();
    return () => {
      cleanup();
    };
  }, [demoId]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Session stats tracking with CTA monitoring
  useEffect(() => {
    if (conversationStarted && !statsInterval.current) {
      sessionStartTime.current = new Date();
      statsInterval.current = setInterval(() => {
        if (sessionStartTime.current) {
          const duration = Math.floor((Date.now() - sessionStartTime.current.getTime()) / 1000);
          setSessionStats(prev => ({ ...prev, duration }));
          
          // Update user behavior
          setUserBehavior(prev => ({
            ...prev,
            sessionDuration: duration,
            engagementScore: ctaUtils.calculateEngagementScore({
              sessionDuration: duration,
              videosWatched: prev.videosWatched,
              questionsAsked: prev.questionsAsked,
              messagesSent: prev.messagesSent
            })
          }));
        }
        
        // Simulate connection quality monitoring
        const newLatency = Math.floor(Math.random() * 100) + 20;
        setLatency(newLatency);
        
        if (newLatency < 50) setConnectionQuality('excellent');
        else if (newLatency < 100) setConnectionQuality('good');
        else if (newLatency < 200) setConnectionQuality('fair');
        else setConnectionQuality('poor');
      }, 1000);
    }
    
    return () => {
      if (statsInterval.current) {
        clearInterval(statsInterval.current);
      }
    };
  }, [conversationStarted]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      speechRecognitionRef.current = new SpeechRecognition();
      speechRecognitionRef.current.continuous = true;
      speechRecognitionRef.current.interimResults = true;
      speechRecognitionRef.current.lang = 'en-US';

      speechRecognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');

        if (event.results[event.results.length - 1].isFinal) {
          handleVoiceInput(transcript);
        }
      };

      speechRecognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      speechRecognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const cleanup = () => {
    if (statsInterval.current) {
      clearInterval(statsInterval.current);
    }
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
    }
  };

  const initializeTavusSession = async () => {
    setIsInitializing(true);
    setInitializationError(null);
    
    try {
      console.log('Initializing Tavus session for demo:', demoId);
      
      // Create Tavus session via API
      const response = await fetch('/api/tavus/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          demoId,
          demoData
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create Tavus session');
      }

      const session = await response.json();
      
      const tavusSessionData: TavusSession = {
        conversation_id: session.conversation_id,
        replica_id: session.replica_id,
        status: session.status,
        conversation_url: session.conversation_url,
        avatar_name: session.avatar_name,
        mock_session: session.mock_session || session.error_fallback || false,
        is_configured: session.is_configured !== false
      };
      
      setTavusSession(tavusSessionData);
      setIsConnected(true);
      
      console.log('Tavus session created:', tavusSessionData);
      
      // Add welcome message
      addMessage({
        type: 'system',
        content: tavusSessionData.mock_session || !tavusSessionData.is_configured
          ? `Demo mode: AI Sales Assistant for ${demoData.title} (Tavus integration ready for production)`
          : `Connected to ${tavusSessionData.avatar_name || 'AI Sales Assistant'} for ${demoData.title}`,
        timestamp: new Date()
      });
      
      // Track analytics
      onAnalyticsEvent?.('tavus_session_created', {
        conversationId: tavusSessionData.conversation_id,
        demoId,
        replicaId: tavusSessionData.replica_id,
        mockSession: tavusSessionData.mock_session,
        isConfigured: tavusSessionData.is_configured
      });
      
    } catch (error) {
      console.error('Failed to initialize Tavus session:', error);
      setInitializationError(error instanceof Error ? error.message : 'Failed to connect');
      
      // Add fallback message
      addMessage({
        type: 'system',
        content: 'Demo mode: You can explore the AI assistant features. In production, this would connect to live Tavus video avatars.',
        timestamp: new Date()
      });
      
      // Create fallback session for demo purposes
      const fallbackSession: TavusSession = {
        conversation_id: `fallback-conversation-${Date.now()}`,
        replica_id: 'fallback-replica',
        status: 'active',
        avatar_name: 'Demo AI Assistant',
        mock_session: true,
        is_configured: false
      };
      
      setTavusSession(fallbackSession);
      setIsConnected(true);
    } finally {
      setIsInitializing(false);
    }
  };

  const addMessage = (message: Omit<Message, 'id'>) => {
    const newMessage: Message = {
      ...message,
      id: Math.random().toString(36).substr(2, 9)
    };
    setMessages(prev => [...prev, newMessage]);
    
    // Update stats
    if (message.type !== 'system') {
      setSessionStats(prev => ({ 
        ...prev, 
        messagesExchanged: prev.messagesExchanged + 1 
      }));
      
      // Update user behavior
      if (message.type === 'user') {
        setUserBehavior(prev => ({
          ...prev,
          messagesSent: prev.messagesSent + 1,
          questionsAsked: message.content.includes('?') ? prev.questionsAsked + 1 : prev.questionsAsked
        }));
      }
    }
    
    return newMessage;
  };

  const checkForCTATrigger = async (userMessage: string, aiResponse: string) => {
    try {
      const response = await fetch('/api/cta/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          demoId,
          conversationId: tavusSession?.conversation_id,
          userBehavior,
          userMessage,
          aiResponse
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.shouldShow) {
          setCTATrigger(result.trigger);
          setShowCTAModal(true);
          
          // Track CTA analytics
          await fetch('/api/cta/analytics', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              demoId,
              conversationId: tavusSession?.conversation_id,
              event: 'shown',
              ctaData: result.trigger,
              userBehavior: result.userBehavior,
              outcome: 'shown'
            })
          });
        }
      }
    } catch (error) {
      console.error('Failed to check CTA trigger:', error);
    }
  };

  const startConversation = async () => {
    if (!tavusSession) {
      await initializeTavusSession();
      return;
    }

    setConversationStarted(true);
    setIsAISpeaking(true);

    try {
      const greeting = `Hello! I'm your AI sales assistant for ${demoData.title}. I'm here to answer any questions you have and show you how our solution can help you. What would you like to know?`;

      // Add AI greeting message
      addMessage({
        type: 'assistant',
        content: greeting,
        timestamp: new Date(),
        confidence: 0.95,
        emotion: 'friendly'
      });

      // Track conversation start
      onAnalyticsEvent?.('conversation_started', {
        conversationId: tavusSession.conversation_id,
        demoId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Failed to start conversation:', error);
      addMessage({
        type: 'system',
        content: 'Failed to start conversation. Please try again.',
        timestamp: new Date()
      });
    } finally {
      setTimeout(() => setIsAISpeaking(false), 3000);
    }
  };

  const sendMessage = async () => {
    if (!currentMessage.trim()) return;

    const userMessage = currentMessage.trim();
    setCurrentMessage('');
    setIsTyping(true);
    responseTimeStart.current = Date.now();

    // Add user message
    addMessage({
      type: 'user',
      content: userMessage,
      timestamp: new Date()
    });

    // Start conversation if not started
    if (!conversationStarted) {
      setConversationStarted(true);
    }

    try {
      // Generate AI response
      setTimeout(async () => {
        try {
          const aiResponse = await generateContextualAIResponse(userMessage, demoData);
          
          setIsAISpeaking(true);
          
          // Calculate response time
          const responseTime = Date.now() - responseTimeStart.current;
          setSessionStats(prev => ({
            ...prev,
            avgResponseTime: Math.round((prev.avgResponseTime + responseTime) / 2)
          }));
          
          // Add AI message
          addMessage({
            type: 'assistant',
            content: aiResponse.text,
            timestamp: new Date(),
            action: aiResponse.action,
            confidence: aiResponse.confidence || 0.9,
            emotion: aiResponse.emotion
          });

          // Handle different actions
          if (aiResponse.action) {
            handleAIAction(aiResponse.action, aiResponse);
          }

          // Check for CTA trigger after AI response
          await checkForCTATrigger(userMessage, aiResponse.text);

          // Track analytics
          onAnalyticsEvent?.('user_message_sent', {
            message: userMessage,
            conversationId: tavusSession?.conversation_id,
            timestamp: new Date().toISOString()
          });

          onAnalyticsEvent?.('ai_response_received', {
            response: aiResponse,
            conversationId: tavusSession?.conversation_id,
            responseTime,
            timestamp: new Date().toISOString()
          });

          // Reset speaking state
          setTimeout(() => setIsAISpeaking(false), 3000);
          
        } catch (error) {
          console.error('Failed to get AI response:', error);
          addMessage({
            type: 'assistant',
            content: 'I apologize, but I encountered an error processing your message. Please try again or let me know if you need assistance.',
            timestamp: new Date(),
            confidence: 0.5
          });
        } finally {
          setIsTyping(false);
        }
      }, 1500 + Math.random() * 2000);
      
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsTyping(false);
      addMessage({
        type: 'system',
        content: 'Failed to send message. Please check your connection and try again.',
        timestamp: new Date()
      });
    }
  };

  const handleVoiceInput = async (transcript: string) => {
    if (!transcript.trim()) return;
    
    setCurrentMessage(transcript);
    
    // Auto-send after a brief delay
    setTimeout(() => {
      if (transcript.trim()) {
        sendMessage();
      }
    }, 500);
  };

  const toggleVoiceInput = () => {
    if (!speechRecognitionRef.current) {
      addMessage({
        type: 'system',
        content: 'Voice input is not supported in this browser. Please use Chrome or Edge for voice features.',
        timestamp: new Date()
      });
      return;
    }

    if (isListening) {
      speechRecognitionRef.current.stop();
      setIsListening(false);
    } else {
      speechRecognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleAIAction = (action: string, response: any) => {
    switch (action) {
      case 'play_video':
        if (response.video_index && onVideoPlay) {
          onVideoPlay(response.video_index);
          setSessionStats(prev => ({ 
            ...prev, 
            videosTriggered: prev.videosTriggered + 1 
          }));
          setUserBehavior(prev => ({
            ...prev,
            videosWatched: prev.videosWatched + 1
          }));
          onAnalyticsEvent?.('video_triggered_by_ai', {
            videoIndex: response.video_index,
            reason: response.reason,
            conversationId: tavusSession?.conversation_id
          });
        }
        break;
        
      case 'show_cta':
        if (response.message) {
          setCTATrigger({
            type: 'ai_recommended',
            urgency: 'high',
            reason: 'AI recommendation',
            confidence: 0.95,
            customMessage: response.message
          });
          setShowCTAModal(true);
          onAnalyticsEvent?.('cta_triggered_by_ai', {
            message: response.message,
            conversationId: tavusSession?.conversation_id
          });
        }
        break;
        
      case 'request_demo':
        addMessage({
          type: 'assistant',
          content: 'I\'d be happy to show you a personalized demo! Let me connect you with our team.',
          timestamp: new Date(),
          confidence: 0.95
        });
        break;
    }
  };

  // Enhanced AI response generation with CTA integration
  const generateContextualAIResponse = async (userMessage: string, demoData: any) => {
    const message = userMessage.toLowerCase();
    const knowledgeBase = demoData.knowledgeBase.toLowerCase();
    
    // Advanced keyword matching with CTA triggers
    if (message.includes('price') || message.includes('cost') || message.includes('pricing')) {
      const pricingInfo = extractPricingInfo(knowledgeBase);
      return {
        action: 'show_cta',
        text: pricingInfo || "Great question about pricing! Our solution offers flexible pricing plans designed to scale with your needs. Let me show you our pricing structure and help you find the perfect plan.",
        emotion: 'confident',
        confidence: 0.9,
        urgency: 'high',
        message: 'Ready to see our pricing options? Let me connect you with our team for a personalized quote.'
      };
    }
    
    if (message.includes('demo') || message.includes('show me') || message.includes('see it')) {
      return {
        action: 'play_video',
        video_index: 1,
        text: "I'd love to show you! Let me play a video that demonstrates exactly what you're asking about.",
        reason: 'User requested demonstration',
        emotion: 'excited',
        confidence: 0.95
      };
    }
    
    if (message.includes('buy') || message.includes('purchase') || message.includes('get started') || message.includes('sign up')) {
      return {
        action: 'show_cta',
        text: "That's fantastic! I'm excited to help you get started with our solution.",
        message: 'Ready to transform your workflow? Let me connect you with our team to set up your account and get you started today.',
        emotion: 'excited',
        confidence: 0.98,
        urgency: 'high'
      };
    }

    // Default contextual response
    const contextualResponse = generateContextualResponse(message, knowledgeBase, demoData.title);
    return {
      action: 'speak',
      text: contextualResponse,
      emotion: 'neutral',
      confidence: 0.75
    };
  };

  // Helper functions (same as before)
  const extractPricingInfo = (knowledgeBase: string): string | null => {
    const pricingKeywords = ['price', 'cost', 'plan', 'subscription', 'billing', '$', 'free', 'premium'];
    const sentences = knowledgeBase.split(/[.!?]+/);
    
    for (const sentence of sentences) {
      if (pricingKeywords.some(keyword => sentence.includes(keyword))) {
        return sentence.trim() + '.';
      }
    }
    return null;
  };

  const generateContextualResponse = (userMessage: string, knowledgeBase: string, productTitle: string): string => {
    const words = userMessage.toLowerCase().split(' ');
    const sentences = knowledgeBase.split(/[.!?]+/);
    
    let bestMatch = '';
    let bestScore = 0;
    
    for (const sentence of sentences) {
      let score = 0;
      for (const word of words) {
        if (sentence.toLowerCase().includes(word)) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = sentence.trim();
      }
    }
    
    if (bestMatch && bestScore > 0) {
      return `Based on what I know about ${productTitle}, ${bestMatch}. Would you like me to show you more details or demonstrate this feature?`;
    }
    
    return `That's a great question about ${productTitle}. I'd be happy to help you understand how our solution can address your specific needs. Could you tell me more about what you're looking to accomplish?`;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const endConversation = async () => {
    // Track final analytics
    onAnalyticsEvent?.('conversation_ended', {
      conversationId: tavusSession?.conversation_id,
      duration: sessionStats.duration,
      messagesExchanged: sessionStats.messagesExchanged,
      videosTriggered: sessionStats.videosTriggered,
      avgResponseTime: sessionStats.avgResponseTime,
      userBehavior,
      timestamp: new Date().toISOString()
    });
    
    setIsConnected(false);
    setConversationStarted(false);
    setTavusSession(null);
    setMessages([]);
    setSessionStats({ duration: 0, messagesExchanged: 0, videosTriggered: 0, avgResponseTime: 0 });
    setUserBehavior({
      sessionDuration: 0,
      videosWatched: 0,
      questionsAsked: 0,
      engagementScore: 0,
      messagesSent: 0,
      specificInterests: [],
      conversionSignals: []
    });
  };

  const handleCTAModalClose = () => {
    setShowCTAModal(false);
    setCTATrigger(null);
  };

  const handleCTAAnalytics = async (event: string, data: any) => {
    await fetch('/api/cta/analytics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        demoId,
        conversationId: tavusSession?.conversation_id,
        event,
        ctaData: ctaTrigger,
        userBehavior,
        outcome: event
      })
    });
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
          <Bot className="w-6 h-6 text-white" />
          {isConnected && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
          )}
          {isAISpeaking && (
            <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-white animate-pulse" />
          )}
          {userBehavior.engagementScore > 0.7 && (
            <div className="absolute -top-1 -left-1 w-4 h-4 bg-amber-500 rounded-full border-2 border-white">
              <Target className="w-2 h-2 text-white m-0.5" />
            </div>
          )}
        </Button>
      </div>
    );
  }

  return (
    <>
      <Card className={`shadow-xl border-0 bg-white/95 backdrop-blur-sm transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'relative'
      }`}>
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-slate-50 to-slate-100">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${
                isConnected ? 'bg-green-500' : isInitializing ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
              }`} />
              <h3 className="font-semibold text-slate-800 flex items-center">
                <Bot className="w-4 h-4 mr-2" />
                AI Sales Assistant
              </h3>
              {isConnected && (
                <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                  <Zap className="w-3 h-3 mr-1" />
                  {tavusSession?.mock_session || !tavusSession?.is_configured ? 'Demo' : 'Live'}
                </Badge>
              )}
              {userBehavior.engagementScore > 0.5 && (
                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Engaged
                </Badge>
              )}
              {conversationStarted && (
                <div className="flex items-center space-x-4 text-xs text-slate-500">
                  <span>{formatDuration(sessionStats.duration)}</span>
                  <span>{sessionStats.messagesExchanged} messages</span>
                  {sessionStats.videosTriggered > 0 && (
                    <span>{sessionStats.videosTriggered} videos</span>
                  )}
                  <span className={getQualityColor(connectionQuality)}>
                    {connectionQuality} ({latency}ms)
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTranscript(!showTranscript)}
                className={showTranscript ? 'bg-slate-200' : ''}
              >
                <MessageCircle className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
                className={showSettings ? 'bg-slate-200' : ''}
              >
                <Settings className="w-4 h-4" />
              </Button>
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

          {/* Main Content */}
          <div className={`grid ${isFullscreen ? 'grid-cols-2' : 'grid-cols-1'} gap-0`}>
            {/* Tavus Video Avatar */}
            {tavusSession && (
              <TavusVideoAvatar
                conversationId={tavusSession.conversation_id}
                replicaId={tavusSession.replica_id}
                conversationUrl={tavusSession.conversation_url}
                onMessage={(message) => {
                  addMessage({
                    type: 'assistant',
                    content: message.content,
                    timestamp: new Date(),
                    confidence: message.confidence,
                    emotion: message.emotion
                  });
                }}
                onStatusChange={(status) => {
                  setIsConnected(status === 'connected');
                }}
                onError={(error) => {
                  console.error('Tavus avatar error:', error);
                  setInitializationError(error.message);
                }}
                autoStart={conversationStarted}
                enableCamera={isCameraEnabled}
                enableMicrophone={!isMuted}
                className={isFullscreen ? 'h-[calc(100vh-200px)]' : 'h-80'}
              />
            )}

            {/* Chat Interface */}
            {showTranscript && (
              <div className="border-l bg-white flex flex-col">
                {/* Messages */}
                <div className="flex-1 h-60 overflow-y-auto p-4 space-y-3">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.type === 'user' ? 'justify-end' : 
                        message.type === 'system' ? 'justify-center' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.type === 'user'
                            ? 'bg-slate-800 text-white'
                            : message.type === 'system'
                            ? 'bg-blue-100 text-blue-800 text-center'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-xs opacity-60">
                            {message.timestamp.toLocaleTimeString()}
                          </p>
                          {message.confidence && (
                            <span className="text-xs opacity-60">
                              {Math.round(message.confidence * 100)}%
                            </span>
                          )}
                        </div>
                        {message.action && message.action !== 'speak' && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            Action: {message.action}
                          </Badge>
                        )}
                        {message.emotion && message.emotion !== 'neutral' && (
                          <Badge variant="outline" className="mt-1 text-xs ml-1">
                            {message.emotion}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 text-slate-800 px-4 py-2 rounded-lg">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <div className="border-t p-4">
                  <div className="flex space-x-2">
                    <Input
                      value={currentMessage}
                      onChange={(e) => setCurrentMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={
                        isConnected 
                          ? "Type your message..." 
                          : initializationError 
                          ? "Connection error - text only mode"
                          : "Connecting..."
                      }
                      disabled={isTyping}
                      className="flex-1"
                    />
                    
                    {speechRecognitionRef.current && (
                      <Button
                        onClick={toggleVoiceInput}
                        disabled={isTyping}
                        variant={isListening ? "default" : "outline"}
                        className={isListening ? "bg-red-500 hover:bg-red-600" : ""}
                      >
                        <Mic className="w-4 h-4" />
                      </Button>
                    )}
                    
                    <Button
                      onClick={sendMessage}
                      disabled={!currentMessage.trim() || isTyping}
                      className="bg-slate-800 hover:bg-slate-700"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {!conversationStarted && isConnected && (
                    <div className="mt-2 text-center">
                      <Button
                        onClick={startConversation}
                        variant="outline"
                        size="sm"
                        className="text-slate-600"
                      >
                        <Phone className="w-3 h-3 mr-1" />
                        Start Voice Conversation
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="border-t bg-slate-50 p-4">
              <h4 className="font-medium text-slate-800 mb-3">Session Settings & Analytics</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="block text-slate-600 mb-1">Engagement Score</label>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${userBehavior.engagementScore * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-slate-500">
                    {Math.round(userBehavior.engagementScore * 100)}% engaged
                  </span>
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">CTA Readiness</label>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${Math.min(100, (userBehavior.questionsAsked * 20) + (userBehavior.videosWatched * 30))}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-slate-500">
                    {userBehavior.questionsAsked > 2 || userBehavior.videosWatched > 1 ? 'Ready' : 'Building interest'}
                  </span>
                </div>
              </div>
              
              {/* Session Stats */}
              <div className="mt-4 pt-4 border-t">
                <h5 className="font-medium text-slate-700 mb-2">Session Statistics</h5>
                <div className="grid grid-cols-4 gap-4 text-xs text-slate-600">
                  <div>
                    <div className="font-medium">{formatDuration(sessionStats.duration)}</div>
                    <div>Duration</div>
                  </div>
                  <div>
                    <div className="font-medium">{userBehavior.questionsAsked}</div>
                    <div>Questions</div>
                  </div>
                  <div>
                    <div className="font-medium">{userBehavior.videosWatched}</div>
                    <div>Videos</div>
                  </div>
                  <div>
                    <div className="font-medium">{sessionStats.avgResponseTime}ms</div>
                    <div>Avg Response</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Connection Status */}
          <div className="border-t bg-white p-2">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  {isConnected ? (
                    <Wifi className="w-3 h-3 text-green-600" />
                  ) : (
                    <WifiOff className="w-3 h-3 text-red-600" />
                  )}
                  <span className={isConnected ? 'text-green-600' : 'text-red-600'}>
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                
                {tavusSession && (
                  <div className="flex items-center space-x-1">
                    <Monitor className="w-3 h-3" />
                    <span>Replica: {tavusSession.replica_id.substring(0, 8)}...</span>
                  </div>
                )}
                
                {conversationStarted && (
                  <div className="flex items-center space-x-1">
                    <Headphones className="w-3 h-3" />
                    <span>Quality: {connectionQuality}</span>
                  </div>
                )}

                {tavusSession?.mock_session && (
                  <div className="flex items-center space-x-1">
                    <Settings className="w-3 h-3" />
                    <span className="text-amber-600">Demo Mode</span>
                  </div>
                )}
              </div>
              
              {conversationStarted && (
                <Button
                  onClick={endConversation}
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <PhoneOff className="w-3 h-3 mr-1" />
                  End Session
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CTA Modal */}
      <CTAModal
        isOpen={showCTAModal}
        onClose={handleCTAModalClose}
        demoTitle={demoData.title}
        ctaLink={demoData.ctaLink}
        triggerReason={ctaTrigger?.reason}
        urgency={ctaTrigger?.urgency}
        customMessage={ctaTrigger?.customMessage}
        userContext={{
          engagementScore: userBehavior.engagementScore,
          videosWatched: userBehavior.videosWatched,
          questionsAsked: userBehavior.questionsAsked,
          sessionDuration: userBehavior.sessionDuration
        }}
        onAnalyticsEvent={handleCTAAnalytics}
      />
    </>
  );
}