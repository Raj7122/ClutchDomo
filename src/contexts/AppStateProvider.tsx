'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useAppState } from '../hooks/useAppState';

interface AppStateContextType {
  state: {
    currentVideoIndex: number;
    isVideoPlaying: boolean;
    showCtaModal: boolean;
    ctaMessage: string;
    error: string | null;
    videoUrl: string | null;
    userActivity: any[];
    isLoading: boolean;
  };
  actions: {
    logActivity: (activity: any) => void;
    handleVideoEnd: () => void;
    handleVideoClose: () => void;
    hideCtaModal: () => void;
    clearError: () => void;
    setVideoUrl: (url: string) => void;
    setCurrentVideoIndex: (index: number) => void;
    setIsVideoPlaying: (playing: boolean) => void;
    showCTA: (message: string) => void;
    setError: (error: string) => void;
  };
}

const AppStateContext = createContext<AppStateContextType | null>(null);

interface AppStateProviderProps {
  children: ReactNode;
}

export function AppStateProvider({ children }: AppStateProviderProps) {
  const appState = useAppState();
  
  return (
    <AppStateContext.Provider value={appState}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useSharedAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useSharedAppState must be used within an AppStateProvider');
  }
  return context;
} 