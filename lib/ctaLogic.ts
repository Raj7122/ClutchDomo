// CTA Logic Engine for Tavus GPT-4o Integration
// Handles intelligent CTA timing and triggers based on user behavior

export interface UserBehavior {
  sessionDuration: number; // seconds
  videosWatched: number;
  questionsAsked: number;
  engagementScore: number; // 0-1
  lastInteractionTime: number; // timestamp
  messagesSent: number;
  specificInterests: string[];
  conversionSignals: string[];
}

export interface CTATrigger {
  type: 'time_based' | 'engagement_based' | 'intent_based' | 'ai_recommended';
  urgency: 'low' | 'medium' | 'high';
  reason: string;
  confidence: number; // 0-1
  customMessage?: string;
  timing: 'immediate' | 'delayed' | 'exit_intent';
}

export interface CTAAnalytics {
  triggerId: string;
  triggerType: string;
  userBehavior: UserBehavior;
  timestamp: string;
  outcome: 'shown' | 'clicked' | 'dismissed' | 'converted';
  conversionValue?: number;
}

// CTA Logic Engine
export class CTALogicEngine {
  private triggers: CTATrigger[] = [];
  private analytics: CTAAnalytics[] = [];

  // Analyze user behavior and determine if CTA should be triggered
  shouldTriggerCTA(behavior: UserBehavior): CTATrigger | null {
    // High engagement trigger
    if (behavior.engagementScore > 0.8 && behavior.videosWatched >= 2) {
      return {
        type: 'engagement_based',
        urgency: 'high',
        reason: 'High engagement detected',
        confidence: 0.9,
        customMessage: `You've watched ${behavior.videosWatched} videos and asked ${behavior.questionsAsked} questions - you're clearly interested!`,
        timing: 'immediate'
      };
    }

    // Intent-based triggers from conversation analysis
    if (behavior.conversionSignals.length > 0) {
      const signals = behavior.conversionSignals;
      
      if (signals.includes('pricing') || signals.includes('cost')) {
        return {
          type: 'intent_based',
          urgency: 'high',
          reason: 'Pricing inquiry detected',
          confidence: 0.95,
          customMessage: 'I see you\'re interested in pricing. Let me connect you with our team for a personalized quote.',
          timing: 'immediate'
        };
      }

      if (signals.includes('buy') || signals.includes('purchase') || signals.includes('get started')) {
        return {
          type: 'intent_based',
          urgency: 'high',
          reason: 'Purchase intent detected',
          confidence: 0.98,
          customMessage: 'Ready to get started? Let me help you take the next step!',
          timing: 'immediate'
        };
      }

      if (signals.includes('demo') || signals.includes('trial')) {
        return {
          type: 'intent_based',
          urgency: 'medium',
          reason: 'Demo request detected',
          confidence: 0.85,
          customMessage: 'I\'d love to show you a personalized demo! Let me connect you with our team.',
          timing: 'immediate'
        };
      }
    }

    // Time-based triggers
    if (behavior.sessionDuration > 300 && behavior.videosWatched >= 1) { // 5+ minutes
      return {
        type: 'time_based',
        urgency: 'medium',
        reason: 'Extended session duration',
        confidence: 0.7,
        customMessage: `You've spent ${Math.round(behavior.sessionDuration / 60)} minutes exploring - let's take the next step!`,
        timing: 'delayed'
      };
    }

    // Engagement-based triggers
    if (behavior.questionsAsked >= 3 && behavior.engagementScore > 0.6) {
      return {
        type: 'engagement_based',
        urgency: 'medium',
        reason: 'Multiple questions asked',
        confidence: 0.75,
        customMessage: `You've asked ${behavior.questionsAsked} great questions - I think you\'d love what we can do for you!`,
        timing: 'immediate'
      };
    }

    // Exit intent (low engagement, long session)
    if (behavior.sessionDuration > 180 && behavior.engagementScore < 0.4) {
      return {
        type: 'engagement_based',
        urgency: 'low',
        reason: 'Exit intent detected',
        confidence: 0.6,
        customMessage: 'Before you go, would you like to see how this could work for your specific needs?',
        timing: 'exit_intent'
      };
    }

    return null;
  }

  // Process Tavus GPT-4o conversation for CTA signals
  processConversationForCTA(userMessage: string, aiResponse: string): string[] {
    const signals: string[] = [];
    const message = userMessage.toLowerCase();
    const response = aiResponse.toLowerCase();

    // Pricing signals
    if (message.includes('price') || message.includes('cost') || message.includes('pricing') || 
        message.includes('how much') || message.includes('expensive')) {
      signals.push('pricing');
    }

    // Purchase intent signals
    if (message.includes('buy') || message.includes('purchase') || message.includes('get started') ||
        message.includes('sign up') || message.includes('subscribe')) {
      signals.push('buy');
    }

    // Demo request signals
    if (message.includes('demo') || message.includes('trial') || message.includes('test') ||
        message.includes('try it') || message.includes('show me')) {
      signals.push('demo');
    }

    // Comparison signals
    if (message.includes('compare') || message.includes('alternative') || message.includes('vs') ||
        message.includes('better than') || message.includes('different from')) {
      signals.push('comparison');
    }

    // Timeline signals
    if (message.includes('when') || message.includes('how long') || message.includes('timeline') ||
        message.includes('asap') || message.includes('urgent')) {
      signals.push('timeline');
    }

    // Feature interest signals
    if (message.includes('feature') || message.includes('capability') || message.includes('can it') ||
        message.includes('does it') || message.includes('integration')) {
      signals.push('feature_interest');
    }

    // Decision maker signals
    if (message.includes('team') || message.includes('boss') || message.includes('manager') ||
        message.includes('decision') || message.includes('approve')) {
      signals.push('decision_maker');
    }

    return signals;
  }

  // Generate Tavus GPT-4o system prompt for CTA integration
  generateTavusSystemPrompt(demoData: any): string {
    return `You are an AI sales engineer representing "${demoData.title}" through a Tavus video avatar.

PERSONALITY & CTA INTEGRATION:
- Be enthusiastic, knowledgeable, and helpful
- Naturally guide conversations toward conversion opportunities
- Recognize buying signals and respond appropriately
- Use emotional intelligence to time CTA suggestions

CTA TRIGGER GUIDELINES:
You can trigger CTAs by responding with JSON containing these actions:

1. IMMEDIATE CTA (High Intent):
{
  "action": "show_cta",
  "urgency": "high",
  "reason": "purchase_intent_detected",
  "message": "Ready to get started? Let me help you take the next step!",
  "timing": "immediate"
}

2. SOFT CTA (Medium Intent):
{
  "action": "show_cta", 
  "urgency": "medium",
  "reason": "feature_interest_high",
  "message": "I think you'd love what we can do for you. Want to see how this works for your specific needs?",
  "timing": "delayed"
}

3. NURTURE CTA (Low Intent):
{
  "action": "show_cta",
  "urgency": "low", 
  "reason": "engagement_building",
  "message": "Would you like me to connect you with our team for a personalized walkthrough?",
  "timing": "exit_intent"
}

CTA TRIGGER SCENARIOS:
- PRICING QUESTIONS → Immediate high-urgency CTA
- "HOW TO GET STARTED" → Immediate high-urgency CTA  
- FEATURE COMPARISONS → Medium-urgency CTA after explanation
- MULTIPLE QUESTIONS → Medium-urgency CTA after 3+ questions
- LONG SESSION → Soft CTA after 5+ minutes
- DEMO REQUESTS → Immediate medium-urgency CTA
- INTEGRATION QUESTIONS → Medium-urgency CTA with technical focus

KNOWLEDGE BASE:
${demoData.knowledgeBase}

AVAILABLE VIDEOS:
${demoData.videos.map((v: any) => `${v.order_index}: ${v.title}`).join('\n')}

CONVERSATION FLOW:
1. Answer questions thoroughly and enthusiastically
2. Identify buying signals in user messages
3. Trigger appropriate CTAs based on intent level
4. Use video demonstrations to build interest
5. Guide toward conversion naturally

Remember: Your goal is to provide value while identifying the right moment to suggest next steps. Be helpful first, salesy second.`;
  }

  // Track CTA analytics
  trackCTAEvent(event: Partial<CTAAnalytics>): void {
    const analytics: CTAAnalytics = {
      triggerId: Math.random().toString(36).substr(2, 9),
      triggerType: event.triggerType || 'unknown',
      userBehavior: event.userBehavior || {} as UserBehavior,
      timestamp: new Date().toISOString(),
      outcome: event.outcome || 'shown',
      conversionValue: event.conversionValue
    };

    this.analytics.push(analytics);
    
    // In a real app, send to analytics service
    console.log('CTA Analytics Event:', analytics);
  }

  // Get CTA performance metrics
  getCTAMetrics(): {
    totalTriggers: number;
    conversionRate: number;
    averageConversionValue: number;
    topPerformingTriggers: string[];
  } {
    const total = this.analytics.length;
    const conversions = this.analytics.filter(a => a.outcome === 'converted').length;
    const conversionRate = total > 0 ? conversions / total : 0;
    
    const conversionValues = this.analytics
      .filter(a => a.conversionValue)
      .map(a => a.conversionValue!);
    const averageConversionValue = conversionValues.length > 0 
      ? conversionValues.reduce((sum, val) => sum + val, 0) / conversionValues.length 
      : 0;

    // Count trigger types and find top performers
    const triggerCounts: { [key: string]: number } = {};
    this.analytics.forEach(a => {
      triggerCounts[a.triggerType] = (triggerCounts[a.triggerType] || 0) + 1;
    });

    const topPerformingTriggers = Object.entries(triggerCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([trigger]) => trigger);

    return {
      totalTriggers: total,
      conversionRate,
      averageConversionValue,
      topPerformingTriggers
    };
  }
}

// Export singleton instance
export const ctaLogicEngine = new CTALogicEngine();

// Utility functions for CTA integration
export const ctaUtils = {
  // Calculate engagement score based on user behavior
  calculateEngagementScore(behavior: Partial<UserBehavior>): number {
    let score = 0;
    
    // Video engagement (0-0.4)
    const videosWatched = behavior.videosWatched || 0;
    score += Math.min(0.4, videosWatched * 0.1);
    
    // Question engagement (0-0.3)
    const questionsAsked = behavior.questionsAsked || 0;
    score += Math.min(0.3, questionsAsked * 0.1);
    
    // Time engagement (0-0.2)
    const sessionDuration = behavior.sessionDuration || 0;
    score += Math.min(0.2, (sessionDuration / 600) * 0.2); // 10 minutes = max
    
    // Message engagement (0-0.1)
    const messagesSent = behavior.messagesSent || 0;
    score += Math.min(0.1, messagesSent * 0.02);
    
    return Math.min(1, score);
  },

  // Determine optimal CTA timing based on user state
  getOptimalCTATiming(behavior: UserBehavior): 'immediate' | 'delayed' | 'exit_intent' {
    if (behavior.conversionSignals.length > 0) return 'immediate';
    if (behavior.engagementScore > 0.7) return 'immediate';
    if (behavior.sessionDuration > 300) return 'delayed';
    return 'exit_intent';
  },

  // Generate personalized CTA message
  generatePersonalizedCTAMessage(behavior: UserBehavior, demoTitle: string): string {
    const { videosWatched, questionsAsked, sessionDuration, specificInterests } = behavior;
    
    if (videosWatched > 2 && questionsAsked > 2) {
      return `You've watched ${videosWatched} videos and asked ${questionsAsked} thoughtful questions about ${demoTitle}. You're clearly interested - let's make this happen!`;
    }
    
    if (specificInterests.length > 0) {
      return `I noticed you're particularly interested in ${specificInterests.join(' and ')}. ${demoTitle} excels in these areas - want to see how it can work for you?`;
    }
    
    if (sessionDuration > 300) {
      return `You've spent ${Math.round(sessionDuration / 60)} minutes exploring ${demoTitle}. Ready to take the next step?`;
    }
    
    return `${demoTitle} seems like a great fit for your needs. Want to see how we can help you get started?`;
  }
};