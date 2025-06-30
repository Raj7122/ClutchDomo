'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabaseClient';
import { 
  Upload, 
  Video, 
  X, 
  Play, 
  Pause,
  GripVertical,
  ArrowLeft,
  ArrowRight,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  FileVideo,
  Eye,
  Settings,
  Trash2
} from 'lucide-react';

interface UploadedVideo {
  file: File;
  id: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  thumbnail?: string;
  duration?: number;
  orderIndex: number;
  title?: string;
  error?: string;
  videoUrl?: string;
  dbId?: string; // Database ID for uploaded videos
  metadata?: {
    width: number;
    height: number;
    fileSize: number;
    format: string;
  };
}

export default function VideoUploadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRefs = useRef<{ [key: string]: HTMLVideoElement }>({});
  
  const [uploadedVideos, setUploadedVideos] = useState<UploadedVideo[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [demoId, setDemoId] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [deletingVideo, setDeletingVideo] = useState<string | null>(null);

  // Initialize demo ID from URL params or create new one
  useEffect(() => {
    const initializeDemo = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        // Get demo ID from URL params or create new demo
        const demoIdParam = searchParams.get('demoId');
        if (demoIdParam) {
          setDemoId(demoIdParam);
          // Load existing videos for this demo
          loadExistingVideos(demoIdParam);
        } else {
          // Create new demo if none exists
          const response = await fetch('/api/demos/create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              title: 'New Demo',
              cta_link: ''
            })
          });

          if (response.ok) {
            const result = await response.json();
            setDemoId(result.data.id);
            // Update URL with demo ID
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('demoId', result.data.id);
            window.history.replaceState({}, '', newUrl.toString());
          }
        }
      } catch (error) {
        console.error('Failed to initialize demo:', error);
      }
    };

    initializeDemo();
  }, [searchParams, router]);

  // Load existing videos for the demo
  const loadExistingVideos = async (demoId: string) => {
    try {
      const { data: videos, error } = await supabase
        .from('videos')
        .select('*')
        .eq('demo_id', demoId)
        .order('order_index', { ascending: true });

      if (error) {
        console.error('Failed to load existing videos:', error);
        return;
      }

      if (videos && videos.length > 0) {
        // Convert database videos to UploadedVideo format
        const existingVideos: UploadedVideo[] = videos.map((video, index) => ({
          file: new File([], video.filename), // Placeholder file object
          id: `existing-${video.id}`,
          dbId: video.id,
          status: 'completed' as const,
          progress: 100,
          orderIndex: video.order_index || index + 1,
          title: video.title || video.filename,
          videoUrl: video.video_url,
          thumbnail: video.thumbnail_url,
          duration: video.duration_seconds,
          metadata: {
            width: 1920, // Default values since we don't store these
            height: 1080,
            fileSize: video.file_size_bytes || 0,
            format: 'video/mp4'
          }
        }));

        setUploadedVideos(existingVideos);
      }
    } catch (error) {
      console.error('Error loading existing videos:', error);
    }
  };

  // Video file validation
  const validateVideo = (file: File): string | null => {
    const allowedTypes = [
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/quicktime',
      'video/x-msvideo' // .avi
    ];
    const maxSize = 100 * 1024 * 1024; // 100MB
    const maxDuration = 600; // 10 minutes in seconds

    if (!allowedTypes.includes(file.type)) {
      return 'Only MP4, WebM, OGG, MOV, and AVI video files are allowed';
    }

    if (file.size > maxSize) {
      return 'Video file size must be less than 100MB';
    }

    return null;
  };

  // Generate video thumbnail
  const generateThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        video.currentTime = Math.min(2, video.duration / 4); // Thumbnail at 2s or 1/4 duration
      };

      video.onseeked = () => {
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
          resolve(thumbnail);
        } else {
          reject(new Error('Failed to get canvas context'));
        }
      };

      video.onerror = () => reject(new Error('Failed to load video'));
      
      video.src = URL.createObjectURL(file);
    });
  };

  // Get video metadata
  const getVideoMetadata = (file: File): Promise<{ duration: number; width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      
      video.onloadedmetadata = () => {
        resolve({
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight
        });
      };

      video.onerror = () => reject(new Error('Failed to load video metadata'));
      video.src = URL.createObjectURL(file);
    });
  };

  // Process video file
  const processVideo = async (videoData: UploadedVideo) => {
    if (!demoId) {
      setUploadedVideos(prev => 
        prev.map(v => v.id === videoData.id ? { 
          ...v, 
          status: 'error', 
          error: 'Demo not initialized' 
        } : v)
      );
      return;
    }

    const videoId = videoData.id;
    
    try {
      // Get user session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Generate thumbnail and get metadata
      setUploadedVideos(prev => 
        prev.map(v => v.id === videoId ? { ...v, status: 'processing', progress: 10 } : v)
      );

      const [thumbnail, metadata] = await Promise.all([
        generateThumbnail(videoData.file),
        getVideoMetadata(videoData.file)
      ]);

      setUploadedVideos(prev => 
        prev.map(v => v.id === videoId ? { 
          ...v, 
          thumbnail,
          duration: metadata.duration,
          metadata: {
            width: metadata.width,
            height: metadata.height,
            fileSize: videoData.file.size,
            format: videoData.file.type
          },
          progress: 30
        } : v)
      );

      // Simulate upload progress
      for (let progress = 30; progress <= 90; progress += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setUploadedVideos(prev => 
          prev.map(v => v.id === videoId ? { ...v, progress } : v)
        );
      }

      // Create form data for video upload
      const formData = new FormData();
      formData.append('video', videoData.file);
      formData.append('demoId', demoId);
      formData.append('orderIndex', videoData.orderIndex.toString());
      formData.append('title', videoData.title || videoData.file.name);

      // Upload video
      const response = await fetch('/api/demos/upload-video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      // Update video status with success
      setUploadedVideos(prev => 
        prev.map(v => v.id === videoId ? { 
          ...v, 
          status: 'completed', 
          progress: 100,
          videoUrl: result.data.videoUrl,
          dbId: result.data.id
        } : v)
      );
      
      // Trigger auto-save
      autoSave();

    } catch (error) {
      console.error('Video processing error:', error);
      setUploadedVideos(prev => 
        prev.map(v => v.id === videoId ? { 
          ...v, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Processing failed'
        } : v)
      );
    }
  };

  // Handle video selection
  const handleVideoSelect = useCallback((files: FileList | null) => {
    if (!files) return;

    Array.from(files).forEach((file, index) => {
      const validationError = validateVideo(file);
      
      if (validationError) {
        // Show error for invalid files
        const errorVideo: UploadedVideo = {
          file,
          id: Math.random().toString(36).substr(2, 9),
          status: 'error',
          progress: 0,
          orderIndex: uploadedVideos.length + index + 1,
          error: validationError
        };
        setUploadedVideos(prev => [...prev, errorVideo]);
        return;
      }

      // Add valid video and start processing
      const newVideo: UploadedVideo = {
        file,
        id: Math.random().toString(36).substr(2, 9),
        status: 'uploading',
        progress: 0,
        orderIndex: uploadedVideos.length + index + 1,
        title: file.name.replace(/\.[^/.]+$/, '') // Remove file extension
      };

      setUploadedVideos(prev => [...prev, newVideo]);
      processVideo(newVideo);
    });
  }, [uploadedVideos.length, demoId]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleVideoSelect(e.dataTransfer.files);
  }, [handleVideoSelect]);

  // Video reordering with drag and drop
  const handleDragStart = (e: React.DragEvent, videoId: string) => {
    setDraggedItem(videoId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOverItem = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnItem = (e: React.DragEvent, targetVideoId: string) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem === targetVideoId) return;

    setUploadedVideos(prev => {
      const draggedIndex = prev.findIndex(v => v.id === draggedItem);
      const targetIndex = prev.findIndex(v => v.id === targetVideoId);
      
      if (draggedIndex === -1 || targetIndex === -1) return prev;

      const newVideos = [...prev];
      const [draggedVideo] = newVideos.splice(draggedIndex, 1);
      newVideos.splice(targetIndex, 0, draggedVideo);

      // Update order indexes
      return newVideos.map((video, index) => ({
        ...video,
        orderIndex: index + 1
      }));
    });

    setDraggedItem(null);
    autoSave();
  };

  // Remove video
  const removeVideo = async (videoId: string) => {
    const video = uploadedVideos.find(v => v.id === videoId);
    if (!video) return;

    // If this is an existing video (has dbId), delete from database
    if (video.dbId) {
      setDeletingVideo(videoId);
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Not authenticated');
        }

        const response = await fetch(`/api/demos/delete-video?id=${video.dbId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || 'Failed to delete video');
        }

        console.log('Video deleted from database successfully');
      } catch (error) {
        console.error('Failed to delete video from database:', error);
        setDeletingVideo(null);
        return; // Don't remove from UI if database deletion failed
      } finally {
        setDeletingVideo(null);
      }
    }

    // Remove from local state and reorder
    setUploadedVideos(prev => {
      const filtered = prev.filter(v => v.id !== videoId);
      // Reorder remaining videos
      return filtered.map((video, index) => ({
        ...video,
        orderIndex: index + 1
      }));
    });
    
    autoSave();
  };

  // Update video title
  const updateVideoTitle = (videoId: string, title: string) => {
    setUploadedVideos(prev => 
      prev.map(v => v.id === videoId ? { ...v, title } : v)
    );
    autoSave();
  };

  // Video playback controls
  const toggleVideoPlayback = (videoId: string) => {
    const videoElement = videoPreviewRefs.current[videoId];
    if (!videoElement) return;

    if (playingVideo === videoId) {
      videoElement.pause();
      setPlayingVideo(null);
    } else {
      // Pause any currently playing video
      if (playingVideo) {
        const currentVideo = videoPreviewRefs.current[playingVideo];
        if (currentVideo) currentVideo.pause();
      }
      
      videoElement.play();
      setPlayingVideo(videoId);
    }
  };

  // Auto-save functionality
  const autoSave = async () => {
    setIsAutoSaving(true);
    
    // Simulate API call to save video order and titles
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setIsAutoSaving(false);
    setLastSaved(new Date());
  };

  // Handle navigation to next step
  const handleContinue = () => {
    if (demoId) {
      router.push(`/create/step-3-confirm?demoId=${demoId}`);
    } else {
      console.error('No demo ID available for navigation');
    }
  };

  // Format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const completedVideos = uploadedVideos.filter(v => v.status === 'completed');
  const hasValidVideos = completedVideos.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link 
                href={`/create/step-1-kb${demoId ? `?demoId=${demoId}` : ''}`}
                className="inline-flex items-center text-slate-600 hover:text-slate-800 transition-colors group"
              >
                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                Back to Knowledge Base
              </Link>
              <div className="h-6 w-px bg-slate-200" />
              <h1 className="text-xl font-semibold text-slate-800">Create Demo</h1>
            </div>
            
            <div className="flex items-center space-x-3">
              {isAutoSaving && (
                <div className="flex items-center text-sm text-slate-500">
                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                  Saving...
                </div>
              )}
              {lastSaved && !isAutoSaving && (
                <div className="text-sm text-slate-500">
                  Saved {lastSaved.toLocaleTimeString()}
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
              <div className="w-8 h-8 bg-slate-800 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                2
              </div>
              <span className="font-medium text-slate-800">Videos</span>
            </div>
            <div className="w-12 h-px bg-slate-200" />
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-slate-200 text-slate-400 rounded-full flex items-center justify-center text-sm font-semibold">
                3
              </div>
              <span className="text-slate-400">Review</span>
            </div>
          </div>
        </div>

        {/* Debug Info */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-800">
              Debug: Demo ID = {demoId || 'Not initialized'}
            </p>
          </div>
        )}

        {/* Main Content */}
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Upload Section */}
          <div className="lg:col-span-3 space-y-6">
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-2xl text-slate-800">Upload Demo Videos</CardTitle>
                <CardDescription className="text-slate-600">
                  Upload videos that showcase your product features. These will be played during the AI demo based on user questions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Upload Zone */}
                <div
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
                    isDragOver
                      ? 'border-slate-400 bg-slate-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="video/*"
                    onChange={(e) => handleVideoSelect(e.target.files)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={!demoId}
                  />
                  
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                      <Video className="w-8 h-8 text-slate-600" />
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800 mb-2">
                        Drop videos here or click to browse
                      </h3>
                      <p className="text-slate-500 mb-4">
                        Upload MP4, WebM, or MOV files (max 100MB each)
                      </p>
                      
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-slate-800 hover:bg-slate-700"
                        disabled={!demoId}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {demoId ? 'Choose Videos' : 'Initializing...'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Video List */}
                {uploadedVideos.length > 0 && (
                  <div className="mt-8 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-slate-800">Uploaded Videos</h4>
                      <p className="text-sm text-slate-500">
                        Drag to reorder • Videos will play in this order during demos
                      </p>
                    </div>
                    
                    <div className="space-y-3">
                      {uploadedVideos
                        .sort((a, b) => a.orderIndex - b.orderIndex)
                        .map((videoData) => (
                        <div
                          key={videoData.id}
                          draggable={videoData.status === 'completed'}
                          onDragStart={(e) => handleDragStart(e, videoData.id)}
                          onDragOver={handleDragOverItem}
                          onDrop={(e) => handleDropOnItem(e, videoData.id)}
                          className={`border rounded-xl p-4 bg-white transition-all duration-200 ${
                            draggedItem === videoData.id ? 'opacity-50 scale-95' : ''
                          } ${
                            videoData.status === 'completed' ? 'cursor-move hover:shadow-md' : ''
                          }`}
                        >
                          <div className="flex items-start space-x-4">
                            {/* Drag Handle */}
                            {videoData.status === 'completed' && (
                              <div className="flex-shrink-0 mt-2">
                                <GripVertical className="w-5 h-5 text-slate-400" />
                              </div>
                            )}

                            {/* Order Number */}
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                                <span className="text-sm font-semibold text-slate-600">
                                  {videoData.orderIndex}
                                </span>
                              </div>
                            </div>

                            {/* Video Thumbnail/Preview */}
                            <div className="flex-shrink-0">
                              {videoData.thumbnail ? (
                                <div className="relative w-24 h-16 bg-slate-100 rounded-lg overflow-hidden">
                                  {videoData.videoUrl ? (
                                    <video
                                      ref={(el) => {
                                        if (el) videoPreviewRefs.current[videoData.id] = el;
                                      }}
                                      src={videoData.videoUrl}
                                      poster={videoData.thumbnail}
                                      className="w-full h-full object-cover"
                                      muted
                                      onEnded={() => setPlayingVideo(null)}
                                    />
                                  ) : (
                                    <video
                                      ref={(el) => {
                                        if (el) videoPreviewRefs.current[videoData.id] = el;
                                      }}
                                      src={URL.createObjectURL(videoData.file)}
                                      poster={videoData.thumbnail}
                                      className="w-full h-full object-cover"
                                      muted
                                      onEnded={() => setPlayingVideo(null)}
                                    />
                                  )}
                                  <button
                                    onClick={() => toggleVideoPlayback(videoData.id)}
                                    className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors"
                                  >
                                    {playingVideo === videoData.id ? (
                                      <Pause className="w-6 h-6 text-white" />
                                    ) : (
                                      <Play className="w-6 h-6 text-white" />
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <div className="w-24 h-16 bg-slate-100 rounded-lg flex items-center justify-center">
                                  <FileVideo className="w-6 h-6 text-slate-400" />
                                </div>
                              )}
                            </div>

                            {/* Video Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-2">
                                <Badge variant={
                                  videoData.status === 'completed' ? 'default' :
                                  videoData.status === 'error' ? 'destructive' :
                                  'secondary'
                                }>
                                  {videoData.status === 'uploading' ? 'Uploading' :
                                   videoData.status === 'processing' ? 'Processing' :
                                   videoData.status === 'completed' ? 'Ready' :
                                   'Error'}
                                </Badge>
                                
                                {videoData.duration && (
                                  <div className="flex items-center text-xs text-slate-500">
                                    <Clock className="w-3 h-3 mr-1" />
                                    {formatDuration(videoData.duration)}
                                  </div>
                                )}
                              </div>

                              {/* Editable Title */}
                              {videoData.status === 'completed' ? (
                                <Input
                                  value={videoData.title || ''}
                                  onChange={(e) => updateVideoTitle(videoData.id, e.target.value)}
                                  placeholder="Enter video title..."
                                  className="mb-2 h-8 text-sm"
                                />
                              ) : (
                                <h5 className="font-medium text-slate-800 mb-2 truncate">
                                  {videoData.file.name}
                                </h5>
                              )}

                              {/* File Info */}
                              <div className="flex items-center space-x-4 text-xs text-slate-500">
                                <span>{formatFileSize(videoData.file.size || videoData.metadata?.fileSize || 0)}</span>
                                {videoData.metadata && (
                                  <>
                                    <span>{videoData.metadata.width}×{videoData.metadata.height}</span>
                                    <span>{videoData.metadata.format.split('/')[1].toUpperCase()}</span>
                                  </>
                                )}
                              </div>

                              {/* Progress Bar */}
                              {(videoData.status === 'uploading' || videoData.status === 'processing') && (
                                <div className="mt-3">
                                  <Progress value={videoData.progress} className="h-2" />
                                  <p className="text-xs text-slate-500 mt-1">
                                    {videoData.status === 'uploading' ? 'Uploading...' : 'Processing video...'}
                                  </p>
                                </div>
                              )}

                              {/* Error Message */}
                              {videoData.status === 'error' && videoData.error && (
                                <Alert className="mt-3">
                                  <AlertCircle className="h-4 w-4" />
                                  <AlertDescription>{videoData.error}</AlertDescription>
                                </Alert>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex-shrink-0 flex items-center space-x-2">
                              {videoData.status === 'completed' && (
                                <Button variant="ghost" size="sm">
                                  <Eye className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeVideo(videoData.id)}
                                disabled={deletingVideo === videoData.id}
                                className="text-slate-400 hover:text-red-500"
                              >
                                {deletingVideo === videoData.id ? (
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Video Guidelines */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg text-slate-800">Video Guidelines</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-slate-600">Keep videos under 5 minutes</p>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-slate-600">Focus on one feature per video</p>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-slate-600">Use clear, high-quality recordings</p>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-slate-600">Order videos from basic to advanced</p>
                </div>
              </CardContent>
            </Card>

            {/* Upload Summary */}
            {uploadedVideos.length > 0 && (
              <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-800">Upload Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Total Videos:</span>
                      <span className="font-medium">{uploadedVideos.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Ready:</span>
                      <span className="font-medium text-green-600">{completedVideos.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Total Duration:</span>
                      <span className="font-medium">
                        {formatDuration(
                          completedVideos.reduce((acc, v) => acc + (v.duration || 0), 0)
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Total Size:</span>
                      <span className="font-medium">
                        {formatFileSize(
                          uploadedVideos.reduce((acc, v) => acc + (v.file.size || v.metadata?.fileSize || 0), 0)
                        )}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Video Tips */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg text-slate-800">Pro Tips</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Order matters:</strong> Videos will be suggested to users based on their questions and this order.
                  </p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg">
                  <p className="text-sm text-amber-800">
                    <strong>Descriptive titles:</strong> Clear titles help the AI choose the right video for each user.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-8 pt-6 border-t">
          <Link href={`/create/step-1-kb${demoId ? `?demoId=${demoId}` : ''}`}>
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Knowledge Base
            </Button>
          </Link>

          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={autoSave}
              disabled={isAutoSaving}
            >
              <Save className="w-4 h-4 mr-2" />
              {isAutoSaving ? 'Saving...' : 'Save Draft'}
            </Button>
            
            <Button
              onClick={handleContinue}
              disabled={!hasValidVideos || !demoId}
              className="bg-slate-800 hover:bg-slate-700"
            >
              Review & Finish
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}