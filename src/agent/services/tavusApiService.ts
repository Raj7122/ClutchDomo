import DailyIframe from '@daily-co/daily-js';

interface TavusSession {
  conversationId: string;
  replicaId: string;
  conversationUrl: string;
  callFrame?: any;
  isActive: boolean;
}

interface TavusMessage {
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: any;
}

class TavusApiService {
  private session: TavusSession | null = null;
  private onMessageCallback?: (message: TavusMessage) => void;
  private onToolCallCallback?: (name: string, args: any) => void;
  private onStatusChangeCallback?: (status: string) => void;

  async createSession(demoData: any): Promise<TavusSession> {
    console.log('[TAVUS API] Creating session for demo:', demoData.title);
    
    try {
      // Call the API to create a Tavus session
      const response = await fetch('/api/tavus/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          demoData,
          context: 'agent_conversation'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.statusText}`);
      }

      const sessionData = await response.json();
      
      this.session = {
        conversationId: sessionData.conversation_id,
        replicaId: sessionData.replica_id,
        conversationUrl: sessionData.conversation_url,
        isActive: true
      };

      console.log('[TAVUS API] Session created:', this.session.conversationId);
      return this.session;
      
    } catch (error) {
      console.error('[TAVUS API] Failed to create session:', error);
      
      // Fallback to mock session for development
      const mockSession: TavusSession = {
        conversationId: `mock-conversation-${Date.now()}`,
        replicaId: 'mock-replica',
        conversationUrl: '',
        isActive: true
      };
      
      this.session = mockSession;
      console.log('[TAVUS API] Using mock session for development');
      return mockSession;
    }
  }

  async initializeCallFrame(): Promise<void> {
    if (!this.session) {
      throw new Error('No active session');
    }

    console.log('[TAVUS API] Initializing call frame...');

    try {
      // Create Daily call frame if we have a conversation URL
      if (this.session.conversationUrl) {
        const callFrame = DailyIframe.createFrame({
          showLeaveButton: false,
          showFullscreenButton: false,
          showLocalVideo: false,
          showParticipantsBar: false,
          activeSpeakerMode: true,
        });

        // Set up event listeners for Tavus conversation events
        callFrame.on('app-message', (event: any) => {
          console.log('[TAVUS API] Received app message:', event);
          this.handleTavusMessage(event);
        });

        callFrame.on('participant-joined', (event: any) => {
          console.log('[TAVUS API] Participant joined:', event);
          this.onStatusChangeCallback?.('connected');
        });

        callFrame.on('participant-left', (event: any) => {
          console.log('[TAVUS API] Participant left:', event);
          this.onStatusChangeCallback?.('disconnected');
        });

        callFrame.on('error', (event: any) => {
          console.error('[TAVUS API] Call frame error:', event);
          this.onStatusChangeCallback?.('error');
        });

        // Join the conversation
        await callFrame.join({ url: this.session.conversationUrl });
        
        this.session.callFrame = callFrame;
        console.log('[TAVUS API] Call frame initialized and joined');
      } else {
        console.log('[TAVUS API] No conversation URL, using mock mode');
        this.simulateMockConversation();
      }
      
    } catch (error) {
      console.error('[TAVUS API] Failed to initialize call frame:', error);
      this.simulateMockConversation();
    }
  }

  private handleTavusMessage(event: any) {
    console.log('[TAVUS API] Processing Tavus message:', event);
    
    switch (event.event_type) {
      case 'conversation.utterance': {
        // This is the critical event parsing logic from the migration plan
        if (event.properties?.role !== 'replica') {
          return;
        }

        const speech = event.properties.speech;
        console.log('[TAVUS API] Replica speech:', speech);

        // Check for tool call pattern: -toolname: arguments
        const toolCallMatch = speech.match(/^-(\w+):\s*(.*)/);
        if (toolCallMatch) {
          const [, toolName, argsString] = toolCallMatch;
          console.log(`[TAVUS API] Tool Call Detected: ${toolName} with args: ${argsString}`);
          
          try {
            // Parse tool arguments
            let args = {};
            if (argsString.trim()) {
              try {
                args = JSON.parse(argsString);
              } catch {
                // If JSON parsing fails, treat as simple string
                args = { message: argsString };
              }
            }
            
            // Execute tool call
            this.onToolCallCallback?.(toolName, args);
            
          } catch (error) {
            console.error('[TAVUS API] Failed to parse tool call:', error);
          }
        } else {
          // Regular conversation message
          const message: TavusMessage = {
            type: 'assistant',
            content: speech,
            timestamp: new Date().toISOString(),
            metadata: event.properties
          };
          
          this.onMessageCallback?.(message);
        }
        break;
      }
      
      case 'conversation.started':
        console.log('[TAVUS API] Conversation started');
        this.onStatusChangeCallback?.('ready');
        break;
      
      case 'conversation.ended':
        console.log('[TAVUS API] Conversation ended');
        this.onStatusChangeCallback?.('disconnected');
        break;
      
      default:
        console.log('[TAVUS API] Unknown event type:', event.event_type);
    }
  }

  private simulateMockConversation() {
    console.log('[TAVUS API] Starting mock conversation mode');
    
    // Simulate connection
    setTimeout(() => {
      this.onStatusChangeCallback?.('ready');
      
      // Send welcome message
      const welcomeMessage: TavusMessage = {
        type: 'assistant',
        content: 'Hello! I\'m your AI assistant. I can help you explore this demo and answer questions. Try asking me about the dashboard or pricing!',
        timestamp: new Date().toISOString()
      };
      
      this.onMessageCallback?.(welcomeMessage);
    }, 2000);
  }

  async sendMessage(content: string): Promise<void> {
    if (!this.session) {
      throw new Error('No active session');
    }

    console.log('[TAVUS API] Sending message:', content);

    const userMessage: TavusMessage = {
      type: 'user',
      content,
      timestamp: new Date().toISOString()
    };

    this.onMessageCallback?.(userMessage);

    // If we have a real call frame, send the message
    if (this.session.callFrame) {
      try {
        await this.session.callFrame.sendAppMessage({
          message: content,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('[TAVUS API] Failed to send message via call frame:', error);
      }
    } else {
      // Mock response for development
      this.simulateAgentResponse(content);
    }
  }

  private simulateAgentResponse(userMessage: string) {
    setTimeout(() => {
      const lowerMessage = userMessage.toLowerCase();
      
      if (lowerMessage.includes('dashboard')) {
        // Simulate tool call
        this.onToolCallCallback?.('get_dashboard_info', {});
        
        setTimeout(() => {
          const response: TavusMessage = {
            type: 'assistant',
            content: 'Great question! The dashboard shows all your key metrics including views, engagement, and conversions. Let me show you the current stats.',
            timestamp: new Date().toISOString()
          };
          this.onMessageCallback?.(response);
        }, 1000);
        
      } else if (lowerMessage.includes('pricing') || lowerMessage.includes('cost')) {
        this.onToolCallCallback?.('get_pricing_info', {});
        
        setTimeout(() => {
          const response: TavusMessage = {
            type: 'assistant',
            content: 'Our pricing is designed to scale with your needs. We have flexible plans starting at $99/month. Would you like to see the detailed breakdown?',
            timestamp: new Date().toISOString()
          };
          this.onMessageCallback?.(response);
        }, 1000);
        
      } else if (lowerMessage.includes('demo') || lowerMessage.includes('video')) {
        this.onToolCallCallback?.('show_demo_video', { videoIndex: 0, reason: 'user_request' });
        
        setTimeout(() => {
          const response: TavusMessage = {
            type: 'assistant',
            content: 'Perfect! Let me show you our demo video that highlights the key features. This will give you a great overview of what we can do.',
            timestamp: new Date().toISOString()
          };
          this.onMessageCallback?.(response);
        }, 1000);
        
      } else {
        // Generic response
        setTimeout(() => {
          const response: TavusMessage = {
            type: 'assistant',
            content: 'That\'s a great question! I\'m here to help you understand our platform better. You can ask me about features, pricing, or request a demo. What would you like to know more about?',
            timestamp: new Date().toISOString()
          };
          this.onMessageCallback?.(response);
        }, 1500);
      }
    }, 500);
  }

  onMessage(callback: (message: TavusMessage) => void) {
    this.onMessageCallback = callback;
  }

  onToolCall(callback: (name: string, args: any) => void) {
    this.onToolCallCallback = callback;
  }

  onStatusChange(callback: (status: string) => void) {
    this.onStatusChangeCallback = callback;
  }

  async disconnect(): Promise<void> {
    if (this.session?.callFrame) {
      await this.session.callFrame.leave();
      this.session.callFrame.destroy();
    }
    
    this.session = null;
    console.log('[TAVUS API] Session disconnected');
  }

  getSession(): TavusSession | null {
    return this.session;
  }
}

export const tavusApiService = new TavusApiService(); 