// Tool Call Service - handles agent actions
interface ToolCallActions {
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
}

class ToolCallService {
  async executeToolCall(name: string, args: any, actions: ToolCallActions) {
    console.log(`[TOOL CALL] Executing: ${name}`, args);
    
    try {
      switch (name) {
        case 'play_video':
          return await this.playVideo(args, actions);
        
        case 'show_cta':
          return await this.showCTA(args, actions);
        
        case 'fetch_answer':
          return await this.fetchAnswer(args, actions);
        
        case 'get_dashboard_info':
          return await this.getDashboardInfo(args, actions);
        
        case 'get_pricing_info':
          return await this.getPricingInfo(args, actions);
        
        case 'show_demo_video':
          return await this.showDemoVideo(args, actions);
        
        case 'escalate_to_human':
          return await this.escalateToHuman(args, actions);
        
        default:
          console.warn(`[TOOL CALL] Unknown tool: ${name}`);
          return { success: false, message: `Unknown tool: ${name}` };
      }
    } catch (error) {
      console.error(`[TOOL CALL] Error executing ${name}:`, error);
      actions.setError(`Failed to execute ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async playVideo(args: any, actions: ToolCallActions) {
    const { videoIndex, videoUrl } = args;
    
    console.log(`[TOOL CALL] Playing video ${videoIndex}:`, videoUrl);
    
    if (videoIndex !== undefined) {
      actions.setCurrentVideoIndex(videoIndex);
    }
    
    if (videoUrl) {
      actions.setVideoUrl(videoUrl);
    }
    
    actions.logActivity({
      type: 'tool_call_play_video',
      videoIndex,
      videoUrl
    });
    
    return { 
      success: true, 
      message: `Playing video ${videoIndex || 'current'}`,
      videoIndex,
      videoUrl
    };
  }

  private async showCTA(args: any, actions: ToolCallActions) {
    const { message, ctaType } = args;
    
    console.log('[TOOL CALL] Showing CTA:', message);
    
    actions.showCTA(message || 'Ready to get started? Let\'s talk!');
    actions.logActivity({
      type: 'tool_call_show_cta',
      message,
      ctaType
    });
    
    return { 
      success: true, 
      message: 'CTA displayed',
      ctaMessage: message
    };
  }

  private async fetchAnswer(args: any, actions: ToolCallActions) {
    const { question, context } = args;
    
    console.log('[TOOL CALL] Fetching answer for:', question);
    
    // Simulate fetching answer from knowledge base
    const mockAnswers = {
      'dashboard': 'The dashboard provides a comprehensive overview of your analytics, user engagement, and conversion metrics.',
      'pricing': 'Our pricing starts at $99/month for the basic plan, with enterprise options available.',
      'features': 'Key features include real-time analytics, custom video creation, and advanced AI conversation capabilities.',
      'demo': 'This demo showcases our AI-powered video conversation platform with interactive elements.',
      'support': 'We offer 24/7 support via chat, email, and phone for all paid plans.'
    };
    
    const answer = mockAnswers[question.toLowerCase() as keyof typeof mockAnswers] || 
                  'I\'d be happy to help you with that question. Let me show you the relevant information.';
    
    actions.logActivity({
      type: 'tool_call_fetch_answer',
      question,
      answer,
      context
    });
    
    return { 
      success: true, 
      answer,
      question,
      source: 'knowledge_base'
    };
  }

  private async getDashboardInfo(args: any, actions: ToolCallActions) {
    console.log('[TOOL CALL] Getting dashboard info');
    
    const dashboardInfo = {
      totalViews: 1234,
      conversionRate: '12.5%',
      avgEngagement: '4.2 minutes',
      topFeatures: ['Analytics', 'Video Creation', 'AI Chat'],
      recentActivity: 'High engagement on demo videos'
    };
    
    actions.logActivity({
      type: 'tool_call_dashboard_info',
      dashboardInfo
    });
    
    return { 
      success: true, 
      dashboardInfo,
      message: 'Dashboard information retrieved'
    };
  }

  private async getPricingInfo(args: any, actions: ToolCallActions) {
    console.log('[TOOL CALL] Getting pricing info');
    
    const pricingInfo = {
      basic: { price: '$99/month', features: ['Basic Analytics', '10 Videos/month', 'Email Support'] },
      pro: { price: '$299/month', features: ['Advanced Analytics', 'Unlimited Videos', 'Priority Support', 'Custom Branding'] },
      enterprise: { price: 'Custom', features: ['Everything in Pro', 'Dedicated Success Manager', 'Custom Integrations', 'SLA'] }
    };
    
    actions.logActivity({
      type: 'tool_call_pricing_info',
      pricingInfo
    });
    
    return { 
      success: true, 
      pricingInfo,
      message: 'Pricing information retrieved'
    };
  }

  private async showDemoVideo(args: any, actions: ToolCallActions) {
    const { videoIndex = 0, reason } = args;
    
    console.log(`[TOOL CALL] Showing demo video ${videoIndex} - ${reason}`);
    
    actions.setCurrentVideoIndex(videoIndex);
    actions.setIsVideoPlaying(true);
    
    actions.logActivity({
      type: 'tool_call_show_demo_video',
      videoIndex,
      reason
    });
    
    return { 
      success: true, 
      message: `Showing demo video ${videoIndex}`,
      videoIndex,
      reason
    };
  }

  private async escalateToHuman(args: any, actions: ToolCallActions) {
    const { reason, urgency = 'normal' } = args;
    
    console.log('[TOOL CALL] Escalating to human:', reason);
    
    actions.showCTA('Let me connect you with a human specialist who can help you further.');
    actions.logActivity({
      type: 'tool_call_escalate_to_human',
      reason,
      urgency
    });
    
    return { 
      success: true, 
      message: 'Escalated to human support',
      reason,
      urgency
    };
  }
}

export const toolCallService = new ToolCallService(); 