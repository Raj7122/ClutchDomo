'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalTitle, 
  ModalDescription,
  ModalFooter 
} from '@/components/ui/modal';
import { 
  ExternalLink, 
  Zap, 
  Star, 
  Clock, 
  Users, 
  CheckCircle, 
  ArrowRight,
  Sparkles,
  Target,
  TrendingUp,
  Gift,
  Calendar,
  Mail,
  Phone,
  Building,
  User,
  Loader2
} from 'lucide-react';

interface CTAModalProps {
  isOpen: boolean;
  onClose: () => void;
  demoTitle: string;
  ctaLink?: string;
  triggerReason?: string;
  urgency?: 'low' | 'medium' | 'high';
  customMessage?: string;
  onAnalyticsEvent?: (event: string, data: any) => void;
  userContext?: {
    engagementScore?: number;
    videosWatched?: number;
    questionsAsked?: number;
    sessionDuration?: number;
  };
}

interface LeadFormData {
  name: string;
  email: string;
  company: string;
  phone: string;
  message: string;
  urgency: 'asap' | 'this_week' | 'this_month' | 'just_exploring';
}

export default function CTAModal({
  isOpen,
  onClose,
  demoTitle,
  ctaLink,
  triggerReason = 'ai_recommendation',
  urgency = 'medium',
  customMessage,
  onAnalyticsEvent,
  userContext = {}
}: CTAModalProps) {
  const [step, setStep] = useState<'cta' | 'form' | 'success'>('cta');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<LeadFormData>({
    name: '',
    email: '',
    company: '',
    phone: '',
    message: '',
    urgency: 'this_week'
  });
  const [showPersonalization, setShowPersonalization] = useState(false);

  // Track modal open event
  useEffect(() => {
    if (isOpen) {
      onAnalyticsEvent?.('cta_modal_opened', {
        triggerReason,
        urgency,
        userContext,
        timestamp: new Date().toISOString()
      });
    }
  }, [isOpen, triggerReason, urgency, userContext, onAnalyticsEvent]);

  // Auto-show personalization for high engagement users
  useEffect(() => {
    if (isOpen && userContext.engagementScore && userContext.engagementScore > 0.7) {
      setShowPersonalization(true);
    }
  }, [isOpen, userContext.engagementScore]);

  const handleFormChange = (field: keyof LeadFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmitLead = async () => {
    setIsSubmitting(true);
    
    try {
      // Simulate API call to submit lead
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Track successful lead submission
      onAnalyticsEvent?.('lead_submitted', {
        formData: {
          ...formData,
          phone: formData.phone ? '[REDACTED]' : '', // Don't track actual phone
          email: formData.email ? '[REDACTED]' : ''   // Don't track actual email
        },
        triggerReason,
        urgency,
        userContext,
        timestamp: new Date().toISOString()
      });
      
      setStep('success');
    } catch (error) {
      console.error('Failed to submit lead:', error);
      onAnalyticsEvent?.('lead_submission_failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCTAClick = () => {
    onAnalyticsEvent?.('cta_clicked', {
      ctaLink,
      triggerReason,
      urgency,
      userContext,
      timestamp: new Date().toISOString()
    });

    if (ctaLink) {
      window.open(ctaLink, '_blank', 'noopener,noreferrer');
    } else {
      setStep('form');
    }
  };

  const handleClose = () => {
    onAnalyticsEvent?.('cta_modal_closed', {
      step,
      triggerReason,
      timeSpent: Date.now(), // Could track actual time spent
      timestamp: new Date().toISOString()
    });
    onClose();
  };

  const getUrgencyConfig = () => {
    switch (urgency) {
      case 'high':
        return {
          color: 'bg-red-500',
          textColor: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          icon: <Zap className="w-4 h-4" />,
          label: 'Limited Time',
          message: 'This exclusive offer expires soon!'
        };
      case 'medium':
        return {
          color: 'bg-amber-500',
          textColor: 'text-amber-600',
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-200',
          icon: <Star className="w-4 h-4" />,
          label: 'Popular Choice',
          message: 'Join thousands of satisfied customers'
        };
      default:
        return {
          color: 'bg-blue-500',
          textColor: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          icon: <Target className="w-4 h-4" />,
          label: 'Perfect Fit',
          message: 'Tailored for your needs'
        };
    }
  };

  const urgencyConfig = getUrgencyConfig();

  const getPersonalizedMessage = () => {
    const { engagementScore = 0, videosWatched = 0, questionsAsked = 0, sessionDuration = 0 } = userContext;
    
    if (engagementScore > 0.8) {
      return `Based on your ${videosWatched} videos watched and ${questionsAsked} questions, ${demoTitle} seems like a perfect match for your needs!`;
    } else if (videosWatched > 2) {
      return `I noticed you've watched ${videosWatched} videos - you're clearly interested in what ${demoTitle} can do for you.`;
    } else if (sessionDuration > 300) {
      return `You've spent ${Math.round(sessionDuration / 60)} minutes exploring ${demoTitle} - let's take the next step together!`;
    }
    
    return customMessage || `Ready to transform your workflow with ${demoTitle}?`;
  };

  return (
    <Modal open={isOpen} onOpenChange={handleClose}>
      <ModalContent className="max-w-2xl">
        {step === 'cta' && (
          <>
            <ModalHeader className="text-center space-y-4">
              {/* Urgency Badge */}
              <div className="flex justify-center">
                <Badge 
                  className={`${urgencyConfig.bgColor} ${urgencyConfig.textColor} ${urgencyConfig.borderColor} border`}
                >
                  {urgencyConfig.icon}
                  <span className="ml-1">{urgencyConfig.label}</span>
                </Badge>
              </div>

              {/* Main Title */}
              <div className="space-y-2">
                <ModalTitle className="text-2xl font-bold text-slate-800 flex items-center justify-center gap-2">
                  <Sparkles className="w-6 h-6 text-amber-500" />
                  Ready to Get Started?
                </ModalTitle>
                <ModalDescription className="text-lg text-slate-600">
                  {getPersonalizedMessage()}
                </ModalDescription>
              </div>

              {/* Personalized Insights */}
              {showPersonalization && userContext.engagementScore && userContext.engagementScore > 0.5 && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    Your Engagement Summary
                  </h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-semibold text-blue-600">{userContext.videosWatched || 0}</div>
                      <div className="text-slate-600">Videos Watched</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-purple-600">{userContext.questionsAsked || 0}</div>
                      <div className="text-slate-600">Questions Asked</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-green-600">
                        {Math.round((userContext.sessionDuration || 0) / 60)}m
                      </div>
                      <div className="text-slate-600">Time Spent</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Value Propositions */}
              <div className="grid md:grid-cols-3 gap-4 my-6">
                <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <h4 className="font-semibold text-green-800">Quick Setup</h4>
                  <p className="text-sm text-green-600">Get started in under 5 minutes</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <h4 className="font-semibold text-blue-800">Expert Support</h4>
                  <p className="text-sm text-blue-600">Dedicated success team</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <Gift className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <h4 className="font-semibold text-purple-800">Free Trial</h4>
                  <p className="text-sm text-purple-600">No credit card required</p>
                </div>
              </div>

              {/* Urgency Message */}
              <div className={`p-3 rounded-lg ${urgencyConfig.bgColor} ${urgencyConfig.borderColor} border`}>
                <p className={`text-sm font-medium ${urgencyConfig.textColor}`}>
                  {urgencyConfig.message}
                </p>
              </div>
            </ModalHeader>

            <ModalFooter className="flex-col space-y-3">
              {/* Primary CTA */}
              <Button
                onClick={handleCTAClick}
                className="w-full bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 text-white font-semibold py-3 text-lg shadow-lg hover:shadow-xl transition-all duration-200"
              >
                {ctaLink ? (
                  <>
                    <ExternalLink className="w-5 h-5 mr-2" />
                    Get Started Now
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-5 h-5 mr-2" />
                    Let's Talk
                  </>
                )}
              </Button>

              {/* Secondary Actions */}
              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  onClick={() => setStep('form')}
                  className="flex-1"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Demo
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                >
                  Continue Exploring
                </Button>
              </div>

              {/* Trust Indicators */}
              <div className="flex items-center justify-center space-x-4 text-xs text-slate-500 mt-4">
                <div className="flex items-center">
                  <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
                  <span>No spam, ever</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
                  <span>Cancel anytime</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
                  <span>GDPR compliant</span>
                </div>
              </div>
            </ModalFooter>
          </>
        )}

        {step === 'form' && (
          <>
            <ModalHeader>
              <ModalTitle className="text-xl font-bold text-slate-800">
                Let's Connect You with Our Team
              </ModalTitle>
              <ModalDescription>
                Tell us a bit about yourself and we'll get you set up with the perfect solution.
              </ModalDescription>
            </ModalHeader>

            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-700 font-medium">
                    <User className="w-4 h-4 inline mr-1" />
                    Full Name *
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 font-medium">
                    <Mail className="w-4 h-4 inline mr-1" />
                    Email Address *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleFormChange('email', e.target.value)}
                    placeholder="john@company.com"
                    required
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company" className="text-slate-700 font-medium">
                    <Building className="w-4 h-4 inline mr-1" />
                    Company
                  </Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => handleFormChange('company', e.target.value)}
                    placeholder="Acme Corp"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-slate-700 font-medium">
                    <Phone className="w-4 h-4 inline mr-1" />
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleFormChange('phone', e.target.value)}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="urgency" className="text-slate-700 font-medium">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Timeline
                </Label>
                <select
                  id="urgency"
                  value={formData.urgency}
                  onChange={(e) => handleFormChange('urgency', e.target.value as LeadFormData['urgency'])}
                  className="w-full p-2 border border-slate-200 rounded-md focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                >
                  <option value="asap">ASAP - Need to implement immediately</option>
                  <option value="this_week">This week - Ready to move forward</option>
                  <option value="this_month">This month - Planning ahead</option>
                  <option value="just_exploring">Just exploring - Gathering information</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message" className="text-slate-700 font-medium">
                  Tell us about your needs (optional)
                </Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => handleFormChange('message', e.target.value)}
                  placeholder="What specific challenges are you looking to solve?"
                  rows={3}
                />
              </div>
            </div>

            <ModalFooter className="flex-col space-y-3">
              <Button
                onClick={handleSubmitLead}
                disabled={!formData.name || !formData.email || isSubmitting}
                className="w-full bg-slate-800 hover:bg-slate-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Connect with Our Team
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep('cta')}
                className="w-full"
                disabled={isSubmitting}
              >
                Back
              </Button>
            </ModalFooter>
          </>
        )}

        {step === 'success' && (
          <>
            <ModalHeader className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <ModalTitle className="text-2xl font-bold text-slate-800">
                Thank You!
              </ModalTitle>
              <ModalDescription className="text-lg">
                We've received your information and our team will reach out within 24 hours.
              </ModalDescription>
            </ModalHeader>

            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-semibold text-green-800 mb-2">What happens next?</h4>
                <ul className="space-y-2 text-sm text-green-700">
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                    Our team will review your requirements
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                    We'll prepare a personalized demo
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                    You'll receive a calendar invite within 24 hours
                  </li>
                </ul>
              </div>

              {ctaLink && (
                <div className="text-center">
                  <p className="text-sm text-slate-600 mb-3">
                    Want to explore more in the meantime?
                  </p>
                  <Button
                    onClick={() => window.open(ctaLink, '_blank', 'noopener,noreferrer')}
                    variant="outline"
                    className="w-full"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Visit Our Website
                  </Button>
                </div>
              )}
            </div>

            <ModalFooter>
              <Button onClick={handleClose} className="w-full bg-slate-800 hover:bg-slate-700">
                Continue Exploring Demo
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}