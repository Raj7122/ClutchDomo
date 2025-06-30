'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabaseClient';
import { 
  CheckCircle, 
  ArrowLeft,
  ArrowRight,
  Save,
  RefreshCw,
  AlertCircle,
  Video,
  FileText,
  Globe,
  Settings,
  Play,
  Share,
  ExternalLink,
  Clock,
  Users,
  TrendingUp
} from 'lucide-react';

interface Demo {
  id: string;
  title: string;
  status: 'draft' | 'processing' | 'ready' | 'published';
  cta_link: string | null;
  knowledge_base_filename: string | null;
  knowledge_base_content: string | null;
  created_at: string;
  updated_at: string;
}

interface Video {
  id: string;
  title: string;
  filename: string;
  video_url: string;
  thumbnail_url: string | null;
  order_index: number;
  duration_seconds: number | null;
  file_size_bytes: number;
  created_at: string;
}

interface KnowledgeBaseChunk {
  id: string;
  content: string;
  chunk_index: number;
  created_at: string;
}

export default function ConfirmDemoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [demo, setDemo] = useState<Demo | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [knowledgeBaseChunks, setKnowledgeBaseChunks] = useState<KnowledgeBaseChunk[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [demoId, setDemoId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [ctaLink, setCtaLink] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    const demoIdParam = searchParams.get('demoId');
    if (demoIdParam) {
      setDemoId(demoIdParam);
      loadDemoData(demoIdParam);
    } else {
      setError('No demo ID provided');
      setIsLoading(false);
    }
  }, [searchParams]);

  const loadDemoData = async (demoId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Load demo details
      const { data: demoData, error: demoError } = await supabase
        .from('demos')
        .select('*')
        .eq('id', demoId)
        .eq('user_id', session.user.id)
        .single();

      if (demoError || !demoData) {
        setError('Demo not found or access denied');
        setIsLoading(false);
        return;
      }

      setDemo(demoData);
      setTitle(demoData.title || '');
      setCtaLink(demoData.cta_link || '');

      // Load videos
      const { data: videosData, error: videosError } = await supabase
        .from('videos')
        .select('*')
        .eq('demo_id', demoId)
        .order('order_index', { ascending: true });

      if (!videosError && videosData) {
        setVideos(videosData);
      }

      // Load knowledge base chunks
      const { data: chunksData, error: chunksError } = await supabase
        .from('knowledge_base_chunks')
        .select('*')
        .eq('demo_id', demoId)
        .order('chunk_index', { ascending: true });

      if (!chunksError && chunksData) {
        setKnowledgeBaseChunks(chunksData);
      }

    } catch (error) {
      console.error('Failed to load demo data:', error);
      setError('Failed to load demo data');
    } finally {
      setIsLoading(false);
    }
  };

  // Enhanced URL validation and normalization
  const normalizeUrl = (url: string): string => {
    if (!url || url.trim() === '') return '';
    
    const trimmedUrl = url.trim();
    
    // If it already has a protocol, return as is
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
      return trimmedUrl;
    }
    
    // If it starts with www., add https://
    if (trimmedUrl.startsWith('www.')) {
      return `https://${trimmedUrl}`;
    }
    
    // If it looks like a domain (contains a dot), add https://
    if (trimmedUrl.includes('.') && !trimmedUrl.includes(' ')) {
      return `https://${trimmedUrl}`;
    }
    
    // Otherwise, assume it's a path and add https://
    return `https://${trimmedUrl}`;
  };

  const handleSaveDraft = async () => {
    if (!demo) return;

    setIsSaving(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Normalize the CTA link before saving
      const normalizedCtaLink = normalizeUrl(ctaLink);

      const { error: updateError } = await supabase
        .from('demos')
        .update({
          title: title.trim() || 'Untitled Demo',
          cta_link: normalizedCtaLink || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', demo.id)
        .eq('user_id', session.user.id);

      if (updateError) {
        throw updateError;
      }

      // Update local state
      setCtaLink(normalizedCtaLink);
      setSuccess('Draft saved successfully!');
      setTimeout(() => setSuccess(''), 3000);

    } catch (error) {
      console.error('Failed to save draft:', error);
      setError('Failed to save draft. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!demo) return;

    setIsPublishing(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Validate required fields
      if (!title.trim()) {
        setError('Demo title is required');
        setIsPublishing(false);
        return;
      }

      if (videos.length === 0) {
        setError('At least one video is required to publish');
        setIsPublishing(false);
        return;
      }

      if (knowledgeBaseChunks.length === 0) {
        setError('Knowledge base content is required to publish');
        setIsPublishing(false);
        return;
      }

      // Normalize the CTA link before publishing
      const normalizedCtaLink = normalizeUrl(ctaLink);

      // First, update the demo in the database
      const { error: updateError } = await supabase
        .from('demos')
        .update({
          title: title.trim(),
          cta_link: normalizedCtaLink || null,
          status: 'published',
          updated_at: new Date().toISOString()
        })
        .eq('id', demo.id)
        .eq('user_id', session.user.id);

      if (updateError) {
        throw updateError;
      }

      // Demo published successfully - redirect to live demo page
      console.log('Demo published successfully, redirecting to live demo...');
      
      setSuccess('Demo published successfully! Redirecting to live demo...');
      
      // Wait a moment to show success message, then redirect
      setTimeout(() => {
        router.push(`/demo-live/${demo.id}`);
      }, 2000);

      // Update local state
      setCtaLink(normalizedCtaLink);
      setDemo(prev => prev ? { ...prev, status: 'published', cta_link: normalizedCtaLink } : null);

    } catch (error) {
      console.error('Failed to publish demo:', error);
      setError('Failed to publish demo. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };



  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return 'Unknown';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTotalVideoSize = (): number => {
    return videos.reduce((total, video) => total + (video.file_size_bytes || 0), 0);
  };

  const getTotalDuration = (): number => {
    return videos.reduce((total, video) => total + (video.duration_seconds || 0), 0);
  };

  const getKnowledgeBaseSize = (): number => {
    return knowledgeBaseChunks.reduce((total, chunk) => total + chunk.content.length, 0);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading demo details...</p>
        </div>
      </div>
    );
  }

  if (!demo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-800 mb-2">Demo Not Found</h2>
            <p className="text-slate-600 mb-6">
              {error || 'The demo you\'re looking for could not be found.'}
            </p>
            <Link href="/dashboard">
              <Button className="bg-slate-800 hover:bg-slate-700">
                Back to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link 
                href={`/create/step-2-videos${demoId ? `?demoId=${demoId}` : ''}`}
                className="inline-flex items-center text-slate-600 hover:text-slate-800 transition-colors group"
              >
                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                Back to Videos
              </Link>
              <div className="h-6 w-px bg-slate-200" />
              <h1 className="text-xl font-semibold text-slate-800">Create Demo</h1>
            </div>
            
            <div className="flex items-center space-x-3">
              {success && (
                <div className="flex items-center text-sm text-green-600">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {success}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                <CheckCircle className="w-4 h-4" />
              </div>
              <span className="font-medium text-slate-800">Knowledge Base</span>
            </div>
            <div className="w-12 h-px bg-slate-400" />
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                <CheckCircle className="w-4 h-4" />
              </div>
              <span className="font-medium text-slate-800">Videos</span>
            </div>
            <div className="w-12 h-px bg-slate-400" />
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-slate-800 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                3
              </div>
              <span className="font-medium text-slate-800">Review & Publish</span>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700">
              {error}
            </AlertDescription>
          </Alert>
        )}



        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Demo Configuration */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-2xl text-slate-800">Demo Configuration</CardTitle>
                <CardDescription className="text-slate-600">
                  Configure your demo settings and review the content before publishing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-slate-700 font-medium">
                      Demo Title *
                    </Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter demo title..."
                      className="h-11"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="ctaLink" className="text-slate-700 font-medium">
                      Call-to-Action Link
                    </Label>
                    <Input
                      id="ctaLink"
                      value={ctaLink}
                      onChange={(e) => setCtaLink(e.target.value)}
                      placeholder="bolt.new or https://your-website.com"
                      className="h-11"
                    />
                    <p className="text-xs text-slate-500">
                      Enter a website URL (e.g., bolt.new). We'll automatically add https:// if needed.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-slate-700 font-medium">
                    Description (Optional)
                  </Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what this demo showcases..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Content Review */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl text-slate-800">Content Review</CardTitle>
                <CardDescription className="text-slate-600">
                  Review your uploaded content before publishing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Knowledge Base Section */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-slate-600" />
                    <h3 className="font-semibold text-slate-800">Knowledge Base</h3>
                    <Badge variant="secondary">{knowledgeBaseChunks.length} chunks</Badge>
                  </div>
                  
                  {demo.knowledge_base_filename ? (
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-slate-700">{demo.knowledge_base_filename}</span>
                        <span className="text-sm text-slate-500">
                          {(getKnowledgeBaseSize() / 1000).toFixed(1)}k characters
                        </span>
                      </div>
                      {demo.knowledge_base_content && (
                        <p className="text-sm text-slate-600 line-clamp-3">
                          {demo.knowledge_base_content.substring(0, 200)}...
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                      <p className="text-amber-800 text-sm">
                        No knowledge base content uploaded. Consider adding product documentation for better AI responses.
                      </p>
                    </div>
                  )}
                </div>

                {/* Videos Section */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Video className="w-5 h-5 text-slate-600" />
                    <h3 className="font-semibold text-slate-800">Videos</h3>
                    <Badge variant="secondary">{videos.length} videos</Badge>
                  </div>
                  
                  {videos.length > 0 ? (
                    <div className="space-y-3">
                      {videos.map((video, index) => (
                        <div key={video.id} className="p-4 bg-slate-50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center">
                                <span className="text-sm font-semibold text-slate-600">{index + 1}</span>
                              </div>
                              <div>
                                <h4 className="font-medium text-slate-800">{video.title || video.filename}</h4>
                                <div className="flex items-center space-x-4 text-sm text-slate-500">
                                  <span>{formatFileSize(video.file_size_bytes)}</span>
                                  <span>{formatDuration(video.duration_seconds)}</span>
                                </div>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm">
                              <Play className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-red-800 text-sm">
                        No videos uploaded. At least one video is required to publish the demo.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Demo Stats */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg text-slate-800">Demo Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Video className="w-4 h-4 text-slate-600" />
                    <span className="text-sm text-slate-600">Total Videos</span>
                  </div>
                  <span className="font-semibold text-slate-800">{videos.length}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-slate-600" />
                    <span className="text-sm text-slate-600">Total Duration</span>
                  </div>
                  <span className="font-semibold text-slate-800">{formatDuration(getTotalDuration())}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-slate-600" />
                    <span className="text-sm text-slate-600">KB Chunks</span>
                  </div>
                  <span className="font-semibold text-slate-800">{knowledgeBaseChunks.length}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-slate-600" />
                    <span className="text-sm text-slate-600">Total Size</span>
                  </div>
                  <span className="font-semibold text-slate-800">{formatFileSize(getTotalVideoSize())}</span>
                </div>
              </CardContent>
            </Card>

            {/* Status Card */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg text-slate-800">Demo Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Badge variant={demo.status === 'published' ? 'default' : 'secondary'}>
                    {demo.status.charAt(0).toUpperCase() + demo.status.slice(1)}
                  </Badge>
                  {demo.status === 'published' && (
                    <Globe className="w-4 h-4 text-green-600" />
                  )}
                </div>
                
                <div className="text-sm text-slate-600">
                  <p>Created: {new Date(demo.created_at).toLocaleDateString()}</p>
                  <p>Updated: {new Date(demo.updated_at).toLocaleDateString()}</p>
                </div>

                {demo.status === 'published' && demo.cta_link && (
                  <div className="pt-2">
                    <a
                      href={demo.cta_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      View CTA Link
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Publish Checklist */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg text-slate-800">Publish Checklist</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-2">
                  {title.trim() ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  )}
                  <span className={`text-sm ${title.trim() ? 'text-green-700' : 'text-red-700'}`}>
                    Demo title set
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  {videos.length > 0 ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  )}
                  <span className={`text-sm ${videos.length > 0 ? 'text-green-700' : 'text-red-700'}`}>
                    At least one video uploaded
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  {knowledgeBaseChunks.length > 0 ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                  )}
                  <span className={`text-sm ${knowledgeBaseChunks.length > 0 ? 'text-green-700' : 'text-amber-700'}`}>
                    Knowledge base content (recommended)
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* ElevenLabs Integration Info */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg text-slate-800">AI Processing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-2">ElevenLabs Integration</h4>
                  <div className="space-y-2 text-sm text-blue-700">
                    <p>• Video transcription (when deployed)</p>
                    <p>• Voice cloning for AI responses</p>
                    <p>• Real-time speech synthesis</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  ElevenLabs processing will be available when the demo is deployed to production.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-8 pt-6 border-t">
          <Link href={`/create/step-2-videos${demoId ? `?demoId=${demoId}` : ''}`}>
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Videos
            </Button>
          </Link>

          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isSaving}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </Button>
            
            {demo.status === 'published' ? (
              <Link href="/dashboard">
                <Button className="bg-slate-800 hover:bg-slate-700">
                  Back to Dashboard
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            ) : (
              <Button
                onClick={handlePublish}
                disabled={isPublishing || !title.trim() || videos.length === 0}
                className="bg-slate-800 hover:bg-slate-700"
              >
                {isPublishing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Share className="w-4 h-4 mr-2" />
                    Publish Demo
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}