'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type AgentStatus = 'disconnected' | 'connecting' | 'initializing' | 'ready' | 'speaking' | 'listening' | 'error';

interface AgentContextType {
  agentStatus: AgentStatus;
  conversationUrl: string | null;
  lastResponse: string | null;
  isInitialized: boolean;
  error: string | null;
  setAgentStatus: (status: AgentStatus) => void;
  setConversationUrl: (url: string | null) => void;
  setLastResponse: (response: string) => void;
  setError: (error: string | null) => void;
  initialize: () => Promise<void>;
  disconnect: () => void;
}

const AgentContext = createContext<AgentContextType | null>(null);

interface AgentProviderProps {
  children: ReactNode;
}

export function AgentProvider({ children }: AgentProviderProps) {
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('disconnected');
  const [conversationUrl, setConversationUrl] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialize = async () => {
    console.log('[AGENT] Initializing agent...');
    setAgentStatus('connecting');
    setError(null);
    
    try {
      // Simulate initialization delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setAgentStatus('ready');
      setIsInitialized(true);
      console.log('[AGENT] Agent initialized successfully');
    } catch (err) {
      console.error('[AGENT] Failed to initialize:', err);
      setError(err instanceof Error ? err.message : 'Initialization failed');
      setAgentStatus('error');
    }
  };

  const disconnect = () => {
    console.log('[AGENT] Disconnecting agent...');
    setAgentStatus('disconnected');
    setConversationUrl(null);
    setLastResponse(null);
    setIsInitialized(false);
    setError(null);
  };

  // Auto-initialize on mount
  useEffect(() => {
    if (agentStatus === 'disconnected' && !isInitialized) {
      initialize();
    }
  }, [agentStatus, isInitialized]);

  const value: AgentContextType = {
    agentStatus,
    conversationUrl,
    lastResponse,
    isInitialized,
    error,
    setAgentStatus,
    setConversationUrl,
    setLastResponse,
    setError,
    initialize,
    disconnect,
  };

  return (
    <AgentContext.Provider value={value}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgent() {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error('useAgent must be used within an AgentProvider');
  }
  return context;
} 