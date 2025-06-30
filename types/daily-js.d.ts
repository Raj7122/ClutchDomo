declare module '@daily-co/daily-js' {
  interface DailyEvent {
    action?: string;
    event_type?: string;
    participant?: any;
    participants?: Record<string, any>;
    properties?: Record<string, any>;
  }

  interface DailyCallOptions {
    url: string;
    token?: string;
    videoSource?: boolean | MediaStreamConstraints;
    audioSource?: boolean | MediaStreamConstraints;
    userName?: string;
    dailyConfig?: Record<string, any>;
    subscribeToTracksAutomatically?: boolean;
  }

  interface DailyCall {
    join(options?: { url?: string; token?: string }): Promise<void>;
    leave(): Promise<void>;
    destroy(): void;
    participants(): Record<string, any>;
    updateInputSettings(settings: { video?: boolean | MediaStreamConstraints; audio?: boolean | MediaStreamConstraints }): void;
    setLocalVideo(enabled: boolean): void;
    setLocalAudio(enabled: boolean): void;
    startScreenShare(): Promise<void>;
    stopScreenShare(): void;
    on(event: string, callback: (event?: DailyEvent) => void): void;
    once(event: string, callback: (event?: DailyEvent) => void): void;
    off(event: string, callback?: (event?: DailyEvent) => void): void;
    sendAppMessage(data: any, to?: string): void;
    iframe(): HTMLIFrameElement | null;
  }

  export function createFrame(
    iframeish?: HTMLIFrameElement | string,
    options?: Record<string, any>
  ): DailyCall;

  export function createCallObject(options?: Record<string, any>): DailyCall;
}
