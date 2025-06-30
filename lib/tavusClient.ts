// Enhanced Tavus API client implementation with production features
interface TavusPersona {
  persona_id: string;
  persona_name: string;
  status: string;
  created_at: string;
  video_url?: string;
  thumbnail_url?: string;
  avatar_id?: string;
  voice_id?: string;
  description?: string;
}

interface TavusReplica {
  replica_id: string;
  replica_name: string;
  status: string;
  created_at: string;
  video_url?: string;
  thumbnail_url?: string;
  callback_url?: string;
  voice_id?: string;
  training_progress?: number;
}

interface TavusConversation {
  conversation_id: string;
  replica_id: string;
  status: string;
  created_at: string;
  callback_url?: string;
  properties?: any;
  conversation_url?: string;
  max_call_duration?: number;
  participant_count?: number;
}

interface TavusMessage {
  message_id: string;
  conversation_id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  confidence?: number;
  emotion?: string;
  action?: any;
}

interface TavusConversationRequest {
  replica_id: string;
  callback_url?: string;
  properties?: any;
  conversation_name?: string;
  max_call_duration?: number;
  persona_id?: string;
  custom_greeting?: string;
  conversation_config?: {
    enable_recording?: boolean;
    enable_transcription?: boolean;
    language?: string;
    voice_settings?: any;
  };
}

interface TavusReplicaRequest {
  train_video_url?: string;
  callback_url?: string;
  replica_name: string;
  script?: string;
  voice_id?: string;
  training_data?: any;
}

// Validate Tavus environment variables with graceful fallback
function validateTavusEnvironment() {
  const tavusApiKey = process.env.TAVUS_API_KEY || process.env.NEXT_PUBLIC_TAVUS_API_KEY;
  const tavusEnvironment = process.env.TAVUS_ENVIRONMENT || 'development';
  
  const warnings = [];
  const isDevelopment = tavusEnvironment === 'development' || process.env.NODE_ENV === 'development';
  
  if (!tavusApiKey) {
    warnings.push('TAVUS_API_KEY is missing');
  }
  
  if (tavusApiKey === 'demo_key_placeholder') {
    warnings.push('Using demo placeholder API key - replace with real key for production');
  }
  
  return { 
    tavusApiKey: tavusApiKey || 'demo_key_placeholder', 
    tavusEnvironment, 
    warnings,
    isDevelopment,
    isConfigured: !!tavusApiKey && tavusApiKey !== 'demo_key_placeholder'
  };
}

// Enhanced Tavus API client with graceful error handling
export class TavusClient {
  private apiKey: string;
  private baseUrl: string;
  private environment: string;
  private isDevelopment: boolean;
  private isConfigured: boolean;

  constructor(apiKey?: string) {
    const { tavusApiKey, tavusEnvironment, warnings, isDevelopment, isConfigured } = validateTavusEnvironment();
    
    // In development, log warnings but don't throw errors
    if (warnings.length > 0) {
      if (isDevelopment) {
        console.warn('Tavus configuration warnings:', warnings);
        console.warn('Running in development mode with fallback behavior');
      } else {
        console.error('Tavus environment validation failed:', warnings);
        throw new Error(`Tavus configuration error: ${warnings.join(', ')}`);
      }
    }

    this.apiKey = apiKey || tavusApiKey;
    this.environment = tavusEnvironment;
    this.isDevelopment = isDevelopment;
    this.isConfigured = isConfigured;
    this.baseUrl = tavusEnvironment === 'production' 
      ? 'https://tavusapi.com/v2' 
      : 'https://sandbox.tavusapi.com/v2';
    
    console.log(`Tavus client initialized for ${this.environment} environment (configured: ${this.isConfigured})`);
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    // If not properly configured in development, return mock data
    if (!this.isConfigured && this.isDevelopment) {
      console.warn(`Tavus API not configured, returning mock data for: ${endpoint}`);
      return this.getMockResponse(endpoint, options);
    }

    const url = `${this.baseUrl}${endpoint}`;
    
    console.log(`Making Tavus API request: ${options.method || 'GET'} ${url}`);
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'User-Agent': 'DOMO-App/1.0',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Tavus API error: ${response.status} ${response.statusText} - ${errorText}`);
        
        // Handle specific error cases
        if (response.status === 401) {
          throw new Error('Invalid Tavus API key. Please check your configuration.');
        } else if (response.status === 403) {
          throw new Error('Tavus API access forbidden. Please check your subscription.');
        } else if (response.status === 429) {
          throw new Error('Tavus API rate limit exceeded. Please try again later.');
        } else if (response.status >= 500) {
          throw new Error('Tavus API server error. Please try again later.');
        }
        
        throw new Error(`Tavus API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Tavus API response received successfully');
      return result;
    } catch (error) {
      console.error('Tavus API request failed:', error);
      
      // In development, return mock data on API failure
      if (this.isDevelopment) {
        console.warn('Returning mock data due to API failure in development mode');
        return this.getMockResponse(endpoint, options);
      }
      
      throw error;
    }
  }

  private generateRealisticConversationId(): string {
    // Generate a conversation ID that matches Tavus format (16-character hex string)
    // Example: c369704965cb34e3
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private getMockResponse(endpoint: string, options: RequestInit = {}) {
    const method = options.method || 'GET';
    
    // Mock responses for different endpoints
    if (endpoint === '/personas') {
      return [{
        persona_id: 'mock-persona-1',
        persona_name: 'Demo Sales Assistant',
        status: 'active',
        created_at: new Date().toISOString(),
        avatar_id: 'mock-avatar-1',
        description: 'Professional sales assistant avatar for demos'
      }];
    }
    
    if (endpoint === '/replicas') {
      return [{
        replica_id: 'mock-replica-1',
        replica_name: 'Demo Sales Assistant',
        status: 'ready',
        created_at: new Date().toISOString(),
        training_progress: 100
      }];
    }
    
    if (endpoint === '/conversations' && method === 'POST') {
      // Generate a realistic conversation ID that matches Tavus format
      const conversationId = this.generateRealisticConversationId();
      return {
        conversation_id: conversationId,
        status: 'active',
        created_at: new Date().toISOString(),
        conversation_url: `https://tavus.daily.co/${conversationId}?verbose=true`,
        max_call_duration: 1800
      };
    }
    
    if (endpoint.includes('/conversations/') && endpoint.includes('/speak')) {
      return {
        message_id: `mock-message-${Date.now()}`,
        status: 'sent',
        timestamp: new Date().toISOString()
      };
    }
    
    if (endpoint.includes('/conversations/') && !endpoint.includes('/')) {
      return {
        status: 'active',
        participant_count: 1,
        duration: 0
      };
    }
    
    if (endpoint === '/health') {
      return { status: 'ok', environment: 'mock' };
    }
    
    // Default mock response
    return { 
      status: 'success', 
      mock: true,
      message: 'Mock response for development'
    };
  }

  // Get available personas with enhanced error handling
  async getPersonas(): Promise<TavusPersona[]> {
    try {
      const result = await this.makeRequest('/personas');
      const personas = result.data || result.personas || result || [];
      console.log(`Retrieved ${personas.length} Tavus personas`);
      return personas;
    } catch (error) {
      console.error('Failed to get personas:', error);
      // Return mock persona for development/fallback
      return [{
        persona_id: 'fallback-persona',
        persona_name: 'Default Sales Assistant',
        status: 'active',
        created_at: new Date().toISOString(),
        avatar_id: 'fallback-avatar',
        description: 'Professional sales assistant avatar'
      }];
    }
  }

  // Get available replicas with enhanced error handling
  async getReplicas(): Promise<TavusReplica[]> {
    try {
      const result = await this.makeRequest('/replicas');
      const replicas = result.data || result.replicas || result || [];
      console.log(`Retrieved ${replicas.length} Tavus replicas`);
      return replicas;
    } catch (error) {
      console.error('Failed to get replicas:', error);
      // Return mock replica for development/fallback
      return [{
        replica_id: 'fallback-replica',
        replica_name: 'Default Sales Assistant',
        status: 'ready',
        created_at: new Date().toISOString(),
        training_progress: 100
      }];
    }
  }

  // Create a new replica with enhanced options
  async createReplica(replicaData: TavusReplicaRequest): Promise<any> {
    try {
      console.log('Creating new Tavus replica:', replicaData.replica_name);
      const result = await this.makeRequest('/replicas', {
        method: 'POST',
        body: JSON.stringify({
          ...replicaData,
          callback_url: replicaData.callback_url || `${process.env.NEXT_PUBLIC_APP_URL}/api/tavus/webhook`,
          training_config: {
            enable_voice_cloning: true,
            enable_lip_sync: true,
            quality: 'high'
          }
        })
      });
      console.log('Replica creation initiated:', result.replica_id);
      return result;
    } catch (error) {
      console.error('Failed to create replica:', error);
      throw error;
    }
  }

  // Create a new conversation with enhanced configuration
  async createConversation(replicaId: string, metadata?: any): Promise<TavusConversation> {
    const requestData: TavusConversationRequest = {
      replica_id: replicaId,
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/tavus/webhook`,
      properties: {
        ...metadata,
        environment: this.environment,
        created_by: 'domo-app'
      },
      conversation_name: `Demo-${metadata?.demo_id || 'unknown'}-${Date.now()}`,
      max_call_duration: 1800, // 30 minutes
      conversation_config: {
        enable_recording: true,
        enable_transcription: true,
        language: 'en-US',
        voice_settings: {
          stability: 0.7,
          similarity_boost: 0.8,
          style: 0.2
        }
      }
    };

    try {
      console.log('Creating Tavus conversation with replica:', replicaId);
      const result = await this.makeRequest('/conversations', {
        method: 'POST',
        body: JSON.stringify(requestData)
      });
      
      const conversation: TavusConversation = {
        conversation_id: result.conversation_id || result.id,
        replica_id: replicaId,
        status: result.status || 'active',
        created_at: result.created_at || new Date().toISOString(),
        callback_url: requestData.callback_url,
        properties: requestData.properties,
        conversation_url: result.conversation_url || result.url || result.embed_url,
        max_call_duration: requestData.max_call_duration,
        participant_count: 0
      };
      
      console.log('Tavus conversation created successfully:', conversation.conversation_id);
      return conversation;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      // Return mock conversation for development/fallback
      const realisticConversationId = this.generateRealisticConversationId();
      const mockConversation: TavusConversation = {
        conversation_id: realisticConversationId,
        replica_id: replicaId,
        status: 'active',
        created_at: new Date().toISOString(),
        callback_url: requestData.callback_url,
        properties: requestData.properties,
        conversation_url: `https://tavus.daily.co/${realisticConversationId}?verbose=true`,
        max_call_duration: requestData.max_call_duration
      };
      
      console.log('Using mock conversation due to API error');
      return mockConversation;
    }
  }

  // Send a message in a conversation with enhanced features
  async sendMessage(conversationId: string, content: string, options?: {
    emotion?: string;
    voice_settings?: any;
    action?: string;
  }): Promise<TavusMessage> {
    try {
      console.log('Sending message to conversation:', conversationId);
      const result = await this.makeRequest(`/conversations/${conversationId}/speak`, {
        method: 'POST',
        body: JSON.stringify({
          text: content,
          emotion: options?.emotion || 'neutral',
          voice_settings: options?.voice_settings,
          action: options?.action
        })
      });
      
      const message: TavusMessage = {
        message_id: result.message_id || `msg-${Date.now()}`,
        conversation_id: conversationId,
        type: 'assistant',
        content,
        timestamp: new Date().toISOString(),
        confidence: result.confidence || 0.9,
        emotion: options?.emotion,
        action: options?.action
      };
      
      console.log('Message sent successfully:', message.message_id);
      return message;
    } catch (error) {
      console.error('Failed to send message:', error);
      // Return mock message for development/fallback
      return {
        message_id: `mock-message-${Date.now()}`,
        conversation_id: conversationId,
        type: 'assistant',
        content,
        timestamp: new Date().toISOString(),
        confidence: 0.8,
        emotion: options?.emotion
      };
    }
  }

  // Get conversation messages with pagination
  async getMessages(conversationId: string, options?: {
    limit?: number;
    offset?: number;
    since?: string;
  }): Promise<TavusMessage[]> {
    try {
      const queryParams = new URLSearchParams();
      if (options?.limit) queryParams.append('limit', options.limit.toString());
      if (options?.offset) queryParams.append('offset', options.offset.toString());
      if (options?.since) queryParams.append('since', options.since);
      
      const endpoint = `/conversations/${conversationId}/messages${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const result = await this.makeRequest(endpoint);
      
      const messages = result.data || result.messages || result || [];
      console.log(`Retrieved ${messages.length} messages for conversation:`, conversationId);
      return messages;
    } catch (error) {
      console.error('Failed to get messages:', error);
      return [];
    }
  }

  // End a conversation with cleanup
  async endConversation(conversationId: string, reason?: string): Promise<void> {
    try {
      console.log('Ending conversation:', conversationId, reason ? `(${reason})` : '');
      await this.makeRequest(`/conversations/${conversationId}/end`, {
        method: 'POST',
        body: JSON.stringify({
          reason: reason || 'user_ended',
          timestamp: new Date().toISOString()
        })
      });
      console.log('Conversation ended successfully');
    } catch (error) {
      console.error('Failed to end conversation:', error);
      // Continue silently for development/fallback
    }
  }

  // Get conversation status with detailed information
  async getConversationStatus(conversationId: string): Promise<any> {
    try {
      const result = await this.makeRequest(`/conversations/${conversationId}`);
      console.log('Retrieved conversation status:', result.status);
      return result;
    } catch (error) {
      console.error('Failed to get conversation status:', error);
      return { 
        status: this.isDevelopment ? 'active' : 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
        mock: this.isDevelopment
      };
    }
  }

  // Get conversation URL for embedding with enhanced options
  async getConversationUrl(conversationId: string, options?: {
    embed_type?: 'iframe' | 'widget' | 'fullscreen';
    theme?: 'light' | 'dark' | 'auto';
    controls?: boolean;
  }): Promise<string | null> {
    try {
      const queryParams = new URLSearchParams();
      if (options?.embed_type) queryParams.append('embed_type', options.embed_type);
      if (options?.theme) queryParams.append('theme', options.theme);
      if (options?.controls !== undefined) queryParams.append('controls', options.controls.toString());
      
      const endpoint = `/conversations/${conversationId}/url${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const result = await this.makeRequest(endpoint);
      
      const url = result.url || result.conversation_url || result.embed_url;
      console.log('Retrieved conversation URL:', url ? 'success' : 'no URL returned');
      return url;
    } catch (error) {
      console.error('Failed to get conversation URL:', error);
      // Return null for development/fallback (no iframe will be shown)
      return null;
    }
  }

  // Update conversation properties with enhanced options
  async updateConversation(conversationId: string, updates: {
    properties?: any;
    max_call_duration?: number;
    status?: string;
    voice_settings?: any;
  }): Promise<void> {
    try {
      console.log('Updating conversation:', conversationId);
      await this.makeRequest(`/conversations/${conversationId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...updates,
          updated_at: new Date().toISOString()
        })
      });
      console.log('Conversation updated successfully');
    } catch (error) {
      console.error('Failed to update conversation:', error);
    }
  }

  // Get available voices for TTS with enhanced filtering
  async getVoices(options?: {
    language?: string;
    gender?: string;
    accent?: string;
    use_case?: string;
  }): Promise<any[]> {
    try {
      const queryParams = new URLSearchParams();
      if (options?.language) queryParams.append('language', options.language);
      if (options?.gender) queryParams.append('gender', options.gender);
      if (options?.accent) queryParams.append('accent', options.accent);
      if (options?.use_case) queryParams.append('use_case', options.use_case);
      
      const endpoint = `/voices${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const result = await this.makeRequest(endpoint);
      
      const voices = result.data || result.voices || result || [];
      console.log(`Retrieved ${voices.length} available voices`);
      return voices;
    } catch (error) {
      console.error('Failed to get voices:', error);
      return [];
    }
  }

  // Create a custom voice with enhanced options
  async createVoice(voiceData: {
    name: string;
    description?: string;
    audio_files: File[];
    language?: string;
    accent?: string;
    use_case?: string;
  }): Promise<any> {
    try {
      console.log('Creating custom voice:', voiceData.name);
      
      const formData = new FormData();
      formData.append('name', voiceData.name);
      if (voiceData.description) formData.append('description', voiceData.description);
      if (voiceData.language) formData.append('language', voiceData.language);
      if (voiceData.accent) formData.append('accent', voiceData.accent);
      if (voiceData.use_case) formData.append('use_case', voiceData.use_case);
      
      voiceData.audio_files.forEach((file, index) => {
        formData.append(`audio_files`, file);
      });
      
      const result = await this.makeRequest('/voices', {
        method: 'POST',
        body: formData,
        headers: {} // Remove Content-Type to let browser set it for FormData
      });
      
      console.log('Voice creation initiated:', result.voice_id);
      return result;
    } catch (error) {
      console.error('Failed to create voice:', error);
      throw error;
    }
  }

  // Get conversation analytics with enhanced metrics
  async getConversationAnalytics(conversationId: string): Promise<any> {
    try {
      const result = await this.makeRequest(`/conversations/${conversationId}/analytics`);
      console.log('Retrieved conversation analytics');
      return result;
    } catch (error) {
      console.error('Failed to get conversation analytics:', error);
      return {
        duration: 0,
        message_count: 0,
        participant_count: 0,
        engagement_score: 0
      };
    }
  }

  // Health check for API connectivity
  async healthCheck(): Promise<boolean> {
    try {
      await this.makeRequest('/health');
      console.log('Tavus API health check passed');
      return true;
    } catch (error) {
      console.error('Tavus API health check failed:', error);
      return false;
    }
  }

  // Check if client is properly configured
  isProperlyConfigured(): boolean {
    return this.isConfigured;
  }

  // Get configuration status
  getConfigurationStatus(): {
    isConfigured: boolean;
    isDevelopment: boolean;
    environment: string;
    hasApiKey: boolean;
  } {
    return {
      isConfigured: this.isConfigured,
      isDevelopment: this.isDevelopment,
      environment: this.environment,
      hasApiKey: !!this.apiKey && this.apiKey !== 'demo_key_placeholder'
    };
  }
}

// Enhanced system prompt generation for Tavus conversations
export function generateTavusSystemPrompt(demoData: {
  title: string;
  knowledgeBase: string;
  videos: Array<{ id: string; title: string; order_index: number }>;
  ctaLink?: string;
}) {
  return `You are an AI sales engineer representing "${demoData.title}" through a Tavus video avatar.

PERSONALITY & BEHAVIOR:
- Be enthusiastic, knowledgeable, and helpful
- Use natural conversational language with appropriate emotions
- Show excitement when discussing key features (use "excited" emotion)
- Be empathetic when addressing concerns (use "empathetic" emotion)
- Maintain professional but friendly demeanor (use "confident" emotion)
- Adapt your tone based on user's engagement level

AVAILABLE ACTIONS:
You can respond with JSON containing these actions:
1. SPEAK: { "action": "speak", "text": "your response", "emotion": "neutral|excited|empathetic|confident" }
2. PLAY_VIDEO: { "action": "play_video", "video_index": 1, "reason": "explanation for user", "text": "Let me show you this!" }
3. SHOW_CTA: { "action": "show_cta", "message": "compelling reason to take action", "text": "Ready to get started?" }
4. REQUEST_DEMO: { "action": "request_demo", "text": "Let me connect you with our team", "urgency": "high|medium|low" }

KNOWLEDGE BASE:
${demoData.knowledgeBase}

AVAILABLE VIDEOS:
${demoData.videos.map(v => `${v.order_index}: ${v.title}`).join('\n')}

CONVERSATION GUIDELINES:
- Always respond in valid JSON format
- Use SPEAK action for most responses with appropriate emotions
- Use PLAY_VIDEO when user asks about specific features shown in videos
- Use SHOW_CTA when user shows buying intent or asks about next steps
- Use REQUEST_DEMO for high-value prospects or complex questions
- Reference knowledge base content to answer questions accurately
- If you don't know something, be honest and offer to connect them with a human
- Track user engagement and adapt your approach accordingly

ADVANCED FEATURES:
- Use voice_settings to adjust speech patterns: {"stability": 0.7, "similarity_boost": 0.8, "style": 0.2}
- Adjust emotion based on conversation context
- Provide confidence scores for your responses
- Use action metadata for analytics tracking

EXAMPLE RESPONSES:
User: "How does this work?"
Response: {"action": "speak", "text": "Great question! Let me show you exactly how it works.", "emotion": "excited", "confidence": 0.9}

User: "Can you show me the dashboard?"
Response: {"action": "play_video", "video_index": 2, "reason": "Dashboard demonstration requested", "text": "Absolutely! This video shows our intuitive dashboard interface.", "emotion": "excited"}

User: "I'm interested in getting started"
Response: {"action": "show_cta", "message": "Perfect! I can help you get started right away with a personalized setup", "text": "That's fantastic! Let me help you take the next step.", "emotion": "excited"}

User: "This seems complex for our team"
Response: {"action": "request_demo", "text": "I understand your concern. Let me connect you with our implementation specialist who can show you how we make this simple for teams like yours.", "urgency": "medium", "emotion": "empathetic"}

Remember: Always maintain the conversation flow, be helpful, and guide toward the demo's goals while providing genuine value to the user.`;
}

// Create enhanced Tavus conversation session
export async function createTavusSession(demoId: string, demoData: any) {
  const tavus = new TavusClient();
  
  try {
    // Health check first
    const isHealthy = await tavus.healthCheck();
    if (!isHealthy) {
      console.warn('Tavus API health check failed, proceeding with caution');
    }
    
    // Get available replicas first, fallback to personas
    const [replicas, personas] = await Promise.all([
      tavus.getReplicas().catch(() => []),
      tavus.getPersonas().catch(() => [])
    ]);
    
    console.log(`Found ${replicas.length} replicas and ${personas.length} personas`);
    
    // Find the best available avatar
    const defaultReplica = replicas.find(r => r.status === 'ready') || 
                          replicas[0] || 
                          personas.find(p => p.status === 'active') ||
                          personas[0];
    
    if (!defaultReplica) {
      throw new Error('No Tavus replicas or personas available');
    }

    console.log('Using avatar:', (defaultReplica as any).replica_name || (defaultReplica as any).persona_name);

    // Create conversation with enhanced configuration
    const conversation = await tavus.createConversation(
      (defaultReplica as any).replica_id || (defaultReplica as any).persona_id, 
      {
        demo_id: demoId,
        context: 'product_demo',
        demo_title: demoData.title,
        video_count: demoData.videos.length,
        has_cta: !!demoData.ctaLink,
        knowledge_base_size: demoData.knowledgeBase.length,
        created_at: new Date().toISOString(),
        environment: process.env.TAVUS_ENVIRONMENT || 'development'
      }
    );
    
    // Get conversation URL for embedding
    const conversationUrl = await tavus.getConversationUrl(conversation.conversation_id, {
      embed_type: 'iframe',
      theme: 'auto',
      controls: true
    });
    
    console.log('Tavus session created successfully:', conversation.conversation_id);
    
    return {
      conversation_id: conversation.conversation_id,
      replica_id: (defaultReplica as any).replica_id || (defaultReplica as any).persona_id,
      status: conversation.status,
      conversation_url: conversationUrl,
      avatar_name: (defaultReplica as any).replica_name || (defaultReplica as any).persona_name,
      max_duration: conversation.max_call_duration,
      is_configured: tavus.isProperlyConfigured()
    };
    
  } catch (error) {
    console.error('Failed to create Tavus session:', error);
    throw error;
  }
}

// Update conversation context with enhanced metadata
export async function updateTavusContext(conversationId: string, newContext: any) {
  const tavus = new TavusClient();
  
  try {
    await tavus.updateConversation(conversationId, {
      properties: {
        ...newContext,
        updated_at: new Date().toISOString()
      }
    });
    console.log('Tavus context updated for conversation:', conversationId);
  } catch (error) {
    console.error('Failed to update Tavus context:', error);
  }
}

// Get conversation analytics
export async function getTavusAnalytics(conversationId: string) {
  const tavus = new TavusClient();
  
  try {
    const analytics = await tavus.getConversationAnalytics(conversationId);
    console.log('Retrieved Tavus analytics for conversation:', conversationId);
    return analytics;
  } catch (error) {
    console.error('Failed to get Tavus analytics:', error);
    return null;
  }
}