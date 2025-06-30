'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';
import { 
  Upload, 
  FileText, 
  X, 
  Download, 
  Eye, 
  CheckCircle, 
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Save,
  RefreshCw
} from 'lucide-react';

interface UploadedFile {
  file: File;
  id: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  preview?: string;
  error?: string;
  processedData?: {
    filename: string;
    fileSize: number;
    textLength: number;
    chunksCreated: number;
    chunksStored: number;
  };
}

export default function KnowledgeBaseUploadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [demoId, setDemoId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  // Initialize demo on component mount - FIXED to prevent duplicates and handle errors properly
  useEffect(() => {
    const initializeDemo = async () => {
      try {
        console.log('Initializing demo...');
        setIsInitializing(true);
        setInitError(null);
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.log('No session found, redirecting to login');
          router.push('/login');
          return;
        }

        // Check if demo ID exists in URL params first
        const existingDemoId = searchParams.get('demoId');
        if (existingDemoId) {
          console.log('Using existing demo ID from URL:', existingDemoId);
          setDemoId(existingDemoId);
          setIsInitializing(false);
          return;
        }

        console.log('Session found, creating new demo...');
        
        // Create a new demo only if no existing demo ID
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

        console.log('Demo creation response status:', response.status);

        if (response.ok) {
          const result = await response.json();
          console.log('Demo creation result:', result);
          
          // FIXED: Check if result.data exists and has an id before accessing it
          if (!result || !result.data || !result.data.id) {
            console.error('Invalid demo creation response - missing data or id:', result);
            setInitError('Failed to create demo: Invalid server response');
            setIsInitializing(false);
            return;
          }
          
          console.log('Demo created successfully:', result.data.id);
          setDemoId(result.data.id);
          
          // Update URL with demo ID to prevent duplicates on refresh/navigation
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('demoId', result.data.id);
          window.history.replaceState({}, '', newUrl.toString());
        } else {
          const errorText = await response.text();
          console.error('Failed to create demo:', response.status, errorText);
          setInitError(`Failed to create demo: ${response.status} ${errorText}`);
        }
      } catch (error) {
        console.error('Failed to initialize demo:', error);
        setInitError(error instanceof Error ? error.message : 'Unknown error occurred');
      } finally {
        setIsInitializing(false);
      }
    };

    initializeDemo();
  }, [searchParams, router]);

  // File validation
  const validateFile = (file: File): string | null => {
    const allowedTypes = ['application/pdf', 'text/plain'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
      return 'Only PDF and TXT files are allowed';
    }

    if (file.size > maxSize) {
      return 'File size must be less than 10MB';
    }

    return null;
  };

  // Process file with real API
  const processFile = async (fileData: UploadedFile) => {
    if (!demoId) {
      console.error('No demo ID available for file processing');
      setUploadedFiles(prev => 
        prev.map(f => f.id === fileData.id ? { 
          ...f, 
          status: 'error', 
          error: 'Demo not initialized' 
        } : f)
      );
      return;
    }

    const fileId = fileData.id;
    console.log('Processing file:', fileData.file.name, 'for demo:', demoId);
    
    try {
      // Get user session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      console.log('User session verified, starting upload...');

      // Simulate upload progress
      for (let progress = 0; progress <= 90; progress += 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setUploadedFiles(prev => 
          prev.map(f => f.id === fileId ? { ...f, progress } : f)
        );
      }

      // Set processing status
      setUploadedFiles(prev => 
        prev.map(f => f.id === fileId ? { ...f, status: 'processing', progress: 95 } : f)
      );

      // Create form data for file upload
      const formData = new FormData();
      formData.append('file', fileData.file);
      formData.append('demoId', demoId);

      console.log('Sending file to API...');

      // Upload and process file with detailed error handling
      const response = await fetch('/api/demos/upload-kb', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      });

      console.log('API response status:', response.status);
      console.log('API response headers:', Object.fromEntries(response.headers.entries()));

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        console.error('Non-JSON response received:', textResponse);
        throw new Error('Server returned an invalid response. Please check server logs.');
      }

      const result = await response.json();
      console.log('API response data:', result);

      if (!response.ok) {
        console.error('API error response:', result);
        throw new Error(result.error || `Server error: ${response.status}`);
      }

      // Update file status with success
      setUploadedFiles(prev => 
        prev.map(f => f.id === fileId ? { 
          ...f, 
          status: 'completed', 
          progress: 100,
          preview: result.data.preview,
          processedData: {
            filename: result.data.filename,
            fileSize: result.data.fileSize,
            textLength: result.data.textLength,
            chunksCreated: result.data.chunksCreated,
            chunksStored: result.data.chunksStored
          }
        } : f)
      );
      
      console.log('File processing completed successfully');
      
      // Trigger auto-save
      autoSave();

    } catch (error) {
      console.error('File processing error:', error);
      setUploadedFiles(prev => 
        prev.map(f => f.id === fileId ? { 
          ...f, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Processing failed'
        } : f)
      );
    }
  };

  // Handle file selection - FIXED to prevent race condition
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;

    // FIXED: Early return if demoId is not available to prevent race condition
    if (!demoId) {
      console.warn('Demo not yet initialized, cannot process files');
      return;
    }

    console.log('Files selected:', files.length);

    Array.from(files).forEach(file => {
      console.log('Processing file:', file.name, file.type, file.size);
      
      const validationError = validateFile(file);
      
      if (validationError) {
        console.error('File validation failed:', validationError);
        // Show error for invalid files
        const errorFile: UploadedFile = {
          file,
          id: Math.random().toString(36).substr(2, 9),
          status: 'error',
          progress: 0,
          error: validationError
        };
        setUploadedFiles(prev => [...prev, errorFile]);
        return;
      }

      // Add valid file and start processing
      const newFile: UploadedFile = {
        file,
        id: Math.random().toString(36).substr(2, 9),
        status: 'uploading',
        progress: 0
      };

      console.log('Adding file to processing queue:', newFile.id);
      setUploadedFiles(prev => [...prev, newFile]);
      processFile(newFile);
    });
  }, [demoId]);

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
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  // Remove file
  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    autoSave();
  };

  // Auto-save functionality
  const autoSave = async () => {
    setIsAutoSaving(true);
    
    // Simulate API call to save draft
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setIsAutoSaving(false);
    setLastSaved(new Date());
  };

  // Download template
  const downloadTemplate = () => {
    const templateContent = `# Product Knowledge Base Template

## Product Overview
Describe your product in detail here...

## Key Features
- Feature 1: Description
- Feature 2: Description
- Feature 3: Description

## Use Cases
1. Use case 1
2. Use case 2
3. Use case 3

## Technical Specifications
Include technical details, requirements, integrations, etc.

## Pricing & Plans
Detail your pricing structure and available plans.

## FAQ
Common questions and answers about your product.

## Contact Information
Support contact details and resources.
`;

    const blob = new Blob([templateContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'knowledge-base-template.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle navigation to next step with demo ID - FIXED
  const handleContinueToVideos = () => {
    if (demoId) {
      router.push(`/create/step-2-videos?demoId=${demoId}`);
    } else {
      console.error('No demo ID available for navigation');
    }
  };

  const completedFiles = uploadedFiles.filter(f => f.status === 'completed');
  const hasValidFiles = completedFiles.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link 
                href="/dashboard" 
                className="inline-flex items-center text-slate-600 hover:text-slate-800 transition-colors group"
              >
                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                Back to Dashboard
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
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-slate-800 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                1
              </div>
              <span className="font-medium text-slate-800">Knowledge Base</span>
            </div>
            <div className="w-12 h-px bg-slate-200" />
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-slate-200 text-slate-400 rounded-full flex items-center justify-center text-sm font-semibold">
                2
              </div>
              <span className="text-slate-400">Videos</span>
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

        {/* Initialization Status */}
        {isInitializing && (
          <div className="mb-6">
            <Alert>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <AlertDescription>
                Initializing demo... Please wait.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Initialization Error */}
        {initError && (
          <div className="mb-6">
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {initError}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="ml-2"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Debug Info */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-800">
              Debug: Demo ID = {demoId || 'Not initialized'} | Initializing = {isInitializing.toString()} | Error = {initError || 'None'}
            </p>
          </div>
        )}

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Upload Section */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-2xl text-slate-800">Upload Knowledge Base</CardTitle>
                <CardDescription className="text-slate-600">
                  Upload your product documentation, guides, or any text content that will help the AI understand your product.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Upload Zone */}
                <div
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
                    isDragOver
                      ? 'border-slate-400 bg-slate-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                  } ${(!demoId || isInitializing) ? 'opacity-50 pointer-events-none' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.txt"
                    onChange={(e) => handleFileSelect(e.target.files)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={!demoId || isInitializing}
                  />
                  
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                      <Upload className="w-8 h-8 text-slate-600" />
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800 mb-2">
                        Drop files here or click to browse
                      </h3>
                      <p className="text-slate-500 mb-4">
                        Upload PDF or TXT files (max 10MB each)
                      </p>
                      
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-slate-800 hover:bg-slate-700"
                        disabled={!demoId || isInitializing}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {isInitializing ? 'Initializing...' : demoId ? 'Choose Files' : 'Demo not ready'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* File List */}
                {uploadedFiles.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <h4 className="font-medium text-slate-800">Uploaded Files</h4>
                    {uploadedFiles.map((fileData) => (
                      <div key={fileData.id} className="border rounded-lg p-4 bg-white">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3 flex-1">
                            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <FileText className="w-5 h-5 text-slate-600" />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <h5 className="font-medium text-slate-800 truncate">
                                  {fileData.file.name}
                                </h5>
                                <Badge variant={
                                  fileData.status === 'completed' ? 'default' :
                                  fileData.status === 'error' ? 'destructive' :
                                  'secondary'
                                }>
                                  {fileData.status === 'uploading' ? 'Uploading' :
                                   fileData.status === 'processing' ? 'Processing' :
                                   fileData.status === 'completed' ? 'Ready' :
                                   'Error'}
                                </Badge>
                              </div>
                              
                              <p className="text-sm text-slate-500 mb-2">
                                {(fileData.file.size / 1024 / 1024).toFixed(2)} MB
                              </p>

                              {fileData.status === 'uploading' && (
                                <Progress value={fileData.progress} className="h-2" />
                              )}

                              {fileData.status === 'processing' && (
                                <div className="flex items-center space-x-2">
                                  <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />
                                  <span className="text-sm text-slate-500">Processing content...</span>
                                </div>
                              )}

                              {fileData.status === 'error' && fileData.error && (
                                <Alert className="mt-2">
                                  <AlertCircle className="h-4 w-4" />
                                  <AlertDescription>{fileData.error}</AlertDescription>
                                </Alert>
                              )}

                              {fileData.status === 'completed' && fileData.processedData && (
                                <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-slate-700">Processing Summary</span>
                                    <Button variant="ghost" size="sm">
                                      <Eye className="w-4 h-4 mr-1" />
                                      View Preview
                                    </Button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                                    <div>Text Length: {fileData.processedData.textLength.toLocaleString()} chars</div>
                                    <div>Chunks Created: {fileData.processedData.chunksCreated}</div>
                                  </div>
                                  {fileData.preview && (
                                    <div className="mt-2 p-2 bg-white rounded text-xs text-slate-600 max-h-20 overflow-y-auto">
                                      {fileData.preview}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(fileData.id)}
                            className="text-slate-400 hover:text-red-500 flex-shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Template Download */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg text-slate-800">Need Help?</CardTitle>
                <CardDescription>
                  Download our template to get started quickly
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={downloadTemplate}
                  variant="outline"
                  className="w-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Template
                </Button>
              </CardContent>
            </Card>

            {/* Tips */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg text-slate-800">Tips for Better Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-slate-600">Include detailed product descriptions</p>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-slate-600">Add common customer questions</p>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-slate-600">Include pricing and plan information</p>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-slate-600">Use clear, conversational language</p>
                </div>
              </CardContent>
            </Card>

            {/* Progress Summary */}
            {uploadedFiles.length > 0 && (
              <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-800">Upload Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Total Files:</span>
                      <span className="font-medium">{uploadedFiles.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Completed:</span>
                      <span className="font-medium text-green-600">{completedFiles.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Total Size:</span>
                      <span className="font-medium">
                        {(uploadedFiles.reduce((acc, f) => acc + f.file.size, 0) / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                    {completedFiles.length > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Text Chunks:</span>
                        <span className="font-medium text-blue-600">
                          {completedFiles.reduce((acc, f) => acc + (f.processedData?.chunksStored || 0), 0)}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-8 pt-6 border-t">
          <Link href="/dashboard">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>

          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={autoSave}
              disabled={isAutoSaving || !demoId}
            >
              <Save className="w-4 h-4 mr-2" />
              {isAutoSaving ? 'Saving...' : 'Save Draft'}
            </Button>
            
            <Button
              onClick={handleContinueToVideos}
              disabled={!hasValidFiles || !demoId || isInitializing}
              className="bg-slate-800 hover:bg-slate-700"
            >
              Continue to Videos
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}