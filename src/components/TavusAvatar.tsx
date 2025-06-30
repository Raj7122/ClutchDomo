'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAgent } from '../agent/contexts/AgentContext';
import { tavusApiService } from '../agent/services/tavusApiService';

interface TavusAvatarProps {
  onToolCall: (name: string, args: any) => Promise<any>;
  demoData?: any;
  className?: string;
  autoStart?: boolean;
}

const TavusAvatar: React.FC<TavusAvatarProps> = ({
  onToolCall,
  demoData,
  className = '',
  autoStart = false
}) => {
  const { agentStatus, setAgentStatus, setConversationUrl, setLastResponse } = useAgent();
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const avatarContainerRef = useRef<HTMLDivElement>(null);
  const callFrameRef = useRef<any>(null);
  const isInitializedRef = useRef(false);

  // CRITICAL: useEffect dependency fix - DO NOT include 'actions' or 'onToolCall'
  useEffect(() => {
    if (!isInitializedRef.current && demoData) {
      initializeAgent();
      isInitializedRef.current = true;
    }
  }, [agentStatus, demoData]); // Only include agentStatus and demoData

  const initializeAgent = useCallback(async () => {
    console.log('[TAVUS AVATAR] Initializing agent...');
    setIsLoading(true);
    setError(null);
    setAgentStatus('initializing');

    try {
      // Create Tavus session
      const session = await tavusApiService.createSession(demoData);
      setConversationUrl(session.conversationUrl);
      
      // Set up event handlers
      tavusApiService.onMessage((message) => {
        console.log('[TAVUS AVATAR] Received message:', message);
        setMessages(prev => [...prev, message]);
        setLastResponse(message.content);
        
        if (message.type === 'assistant') {
          setAgentStatus('ready');
        }
      });

      tavusApiService.onToolCall(async (name, args) => {
        console.log(`[TAVUS AVATAR] Tool Call: ${name}`, args);
        try {
          await onToolCall(name, args);
        } catch (error) {
          console.error('[TAVUS AVATAR] Tool call failed:', error);
        }
      });

      tavusApiService.onStatusChange((status) => {
        console.log('[TAVUS AVATAR] Status change:', status);
        setAgentStatus(status as any);
      });

      // Initialize call frame with Daily.co
      await tavusApiService.initializeCallFrame();
      
      console.log('[TAVUS AVATAR] Agent initialized successfully');
      
      if (autoStart) {
        setAgentStatus('ready');
      }
      
    } catch (err) {
      console.error('[TAVUS AVATAR] Failed to initialize agent:', err);
      setError(err instanceof Error ? err.message : 'Initialization failed');
      setAgentStatus('error');
    } finally {
      setIsLoading(false);
    }
  }, [demoData, onToolCall, autoStart, setAgentStatus, setConversationUrl, setLastResponse]);

  const sendMessage = useCallback(async (message: string) => {
    try {
      await tavusApiService.sendMessage(message);
    } catch (error) {
      console.error('[TAVUS AVATAR] Failed to send message:', error);
      setError('Failed to send message');
    }
  }, []);

  const handleUserInput = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      const input = event.target as HTMLInputElement;
      if (input.value.trim()) {
        sendMessage(input.value.trim());
        input.value = '';
      }
    }
  }, [sendMessage]);

  const renderStatus = () => {
    switch (agentStatus) {
      case 'initializing':
        return (
          <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Initializing AI assistant...</p>
            </div>
          </div>
        );
      
      case 'connecting':
        return (
          <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
            <div className="text-center">
              <div className="animate-pulse rounded-full h-8 w-8 bg-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Connecting to avatar...</p>
            </div>
          </div>
        );
      
      case 'error':
        return (
          <div className="flex items-center justify-center h-64 bg-red-50 rounded-lg">
            <div className="text-center">
              <div className="text-red-600 mb-2">⚠️</div>
              <p className="text-red-600">{error || 'Connection failed'}</p>
              <button 
                onClick={initializeAgent}
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          </div>
        );
      
      case 'ready':
      case 'speaking':
      case 'listening':
        return (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Avatar Video Container */}
            <div 
              ref={avatarContainerRef}
              className="relative h-64 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center"
            >
              <div className="text-center text-white">
                <div className={`w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  agentStatus === 'speaking' ? 'animate-pulse' : ''
                }`}>
                  🤖
                </div>
                <h3 className="text-lg font-semibold">AI Sales Assistant</h3>
                <p className="text-sm opacity-90">
                  {agentStatus === 'speaking' ? 'Speaking...' : 
                   agentStatus === 'listening' ? 'Listening...' : 'Ready to help'}
                </p>
              </div>
              
              {/* Status indicator */}
              <div className={`absolute top-4 right-4 w-3 h-3 rounded-full ${
                agentStatus === 'ready' ? 'bg-green-400' :
                agentStatus === 'speaking' ? 'bg-blue-400 animate-pulse' :
                agentStatus === 'listening' ? 'bg-yellow-400 animate-pulse' : 'bg-gray-400'
              }`} />
            </div>
            
            {/* Chat Interface */}
            <div className="p-4">
              <div className="h-32 overflow-y-auto mb-4 bg-gray-50 rounded p-2">
                {messages.slice(-3).map((message, index) => (
                  <div key={index} className={`mb-2 ${message.type === 'user' ? 'text-right' : 'text-left'}`}>
                    <div className={`inline-block p-2 rounded text-sm max-w-xs ${
                      message.type === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-white border'
                    }`}>
                      {message.content}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Input */}
              <input
                type="text"
                placeholder="Ask me about features, pricing, or demos..."
                onKeyPress={handleUserInput}
                disabled={agentStatus !== 'ready'}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>
          </div>
        );
      
      default:
        return (
          <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
            <div className="text-center">
              <p className="text-gray-600">Click to start conversation</p>
              <button 
                onClick={initializeAgent}
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Start Agent
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className={`tavus-avatar ${className}`}>
      {renderStatus()}
    </div>
  );
};

export default TavusAvatar; 