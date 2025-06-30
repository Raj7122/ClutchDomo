'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabaseClient';
import { 
  Plus, 
  Video, 
  FileText, 
  MoreVertical, 
  Play, 
  Settings, 
  Share,
  Calendar,
  Clock,
  Users,
  TrendingUp,
  LogOut,
  User,
  Trash2,
  AlertTriangle,
  Eye,
  ExternalLink,
  RefreshCw
} from 'lucide-react';

interface Demo {
  id: string;
  title: string;
  status: 'draft' | 'processing' | 'ready' | 'published';
  cta_link: string | null;
  knowledge_base_filename: string | null;
  created_at: string;
  updated_at: string;
  videos: { count: number }[];
  knowledge_base_chunks: { count: number }[];
}

export default function DashboardPage() {
  const [demos, setDemos] = useState<Demo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [deletingDemo, setDeletingDemo] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string>('');
  const [deleteErrorDetails, setDeleteErrorDetails] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      console.log('Initializing authentication...');
      
      // Get current session
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        setAuthError('Failed to get session');
        router.push('/login');
        return;
      }

      if (!currentSession) {
        console.log('No session found, redirecting to login');
        router.push('/login');
        return;
      }

      console.log('Session found:', {
        userId: currentSession.user.id,
        email: currentSession.user.email,
        tokenExpiry: new Date(currentSession.expires_at! * 1000).toISOString()
      });

      setSession(currentSession);
      setUser(currentSession.user);
      
      // Fetch demos with the session
      await fetchDemos(currentSession);

    } catch (error) {
      console.error('Auth initialization error:', error);
      setAuthError('Authentication failed');
      router.push('/login');
    }
  };

  const fetchDemos = async (currentSession: any) => {
    try {
      console.log('Fetching demos with session...');
      setIsLoading(true);
      setAuthError('');

      if (!currentSession?.access_token) {
        throw new Error('No access token available');
      }

      console.log('Making API request with token...');
      
      const response = await fetch('/api/demos/create', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${currentSession.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        
        if (response.status === 401) {
          console.log('Unauthorized, refreshing session...');
          // Try to refresh the session
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError || !refreshedSession) {
            console.error('Session refresh failed:', refreshError);
            router.push('/login');
            return;
          }
          
          console.log('Session refreshed, retrying...');
          setSession(refreshedSession);
          setUser(refreshedSession.user);
          
          // Retry with refreshed token
          const retryResponse = await fetch('/api/demos/create', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${refreshedSession.access_token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (retryResponse.ok) {
            const result = await retryResponse.json();
            setDemos(result.data || []);
          } else {
            throw new Error(`API error after refresh: ${retryResponse.status}`);
          }
        } else {
          throw new Error(`API error: ${response.status} - ${errorText}`);
        }
      } else {
        const result = await response.json();
        console.log('Demos fetched successfully:', result.data?.length || 0);
        setDemos(result.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch demos:', error);
      setAuthError(error instanceof Error ? error.message : 'Failed to load demos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDemo = async (demoId: string) => {
    setDeletingDemo(demoId);
    setDeleteError('');
    setDeleteErrorDetails(null);

    try {
      console.log('Attempting to delete demo:', demoId);
      
      if (!session?.access_token) {
        setDeleteError('Authentication required');
        return;
      }

      console.log('Making delete request...');
      
      const response = await fetch(`/api/demos/delete?id=${demoId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Delete response status:', response.status);
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      let result;
      
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
        console.log('Delete response data:', result);
      } else {
        const textResponse = await response.text();
        console.error('Non-JSON response received:', textResponse);
        throw new Error('Server returned an invalid response. Please try again.');
      }

      if (response.ok && result.success) {
        // Remove the demo from the local state
        setDemos(prev => prev.filter(demo => demo.id !== demoId));
        setShowDeleteConfirm(null);
        console.log('Demo deleted successfully');
      } else {
        console.error('Delete failed:', result);
        setDeleteError(result.error || `Server error: ${response.status}`);
        setDeleteErrorDetails(result);
      }
    } catch (error) {
      console.error('Delete demo error:', error);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          setDeleteError('Request timed out. Please try again.');
        } else {
          setDeleteError(error.message);
        }
      } else {
        setDeleteError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setDeletingDemo(null);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleRefreshDemos = async () => {
    if (session) {
      await fetchDemos(session);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      case 'ready': return 'bg-green-100 text-green-800';
      case 'published': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Close delete confirmation when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.delete-dropdown')) {
        setShowDeleteConfirm(null);
      }
    };

    if (showDeleteConfirm) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDeleteConfirm]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-2xl font-bold text-slate-800">
                DOMO
              </Link>
              <div className="h-6 w-px bg-slate-200" />
              <h1 className="text-xl font-semibold text-slate-800">Dashboard</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-slate-600">
                <User className="w-4 h-4" />
                <span>{user?.email}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshDemos}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                onClick={handleSignOut}
                className="text-slate-600 hover:text-slate-800"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-800 mb-2">
            Welcome back{user?.user_metadata?.name ? `, ${user.user_metadata.name}` : ''}!
          </h2>
          <p className="text-slate-600">
            Create and manage your AI-powered product demos
          </p>
        </div>

        {/* Auth Error Alert */}
        {authError && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700">
              <div className="space-y-2">
                <p className="font-medium">Authentication Error</p>
                <p className="text-sm">{authError}</p>
                <div className="flex space-x-2 mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAuthError('')}
                    className="h-auto p-0 text-red-700 hover:text-red-900"
                  >
                    Dismiss
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefreshDemos}
                    className="h-auto p-0 text-red-700 hover:text-red-900"
                  >
                    Retry
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Enhanced Error Alert */}
        {deleteError && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700">
              <div className="space-y-2">
                <p className="font-medium">{deleteError}</p>
                {deleteErrorDetails?.details && (
                  <p className="text-sm">{deleteErrorDetails.details}</p>
                )}
                {deleteErrorDetails?.troubleshooting && (
                  <div className="mt-3">
                    <p className="text-sm font-medium">{deleteErrorDetails.troubleshooting.message}</p>
                    <ul className="text-xs mt-1 space-y-1">
                      {deleteErrorDetails.troubleshooting.suggestions?.map((suggestion: string, index: number) => (
                        <li key={index}>• {suggestion}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDeleteError('');
                  setDeleteErrorDetails(null);
                }}
                className="ml-2 h-auto p-0 text-red-700 hover:text-red-900"
              >
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total Demos</p>
                  <p className="text-2xl font-bold text-slate-800">{demos.length}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Video className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Published</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {demos.filter(d => d.status === 'published').length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">In Progress</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {demos.filter(d => d.status === 'draft' || d.status === 'processing').length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total Views</p>
                  <p className="text-2xl font-bold text-slate-800">0</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Demos Section */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-slate-800">Your Demos</h3>
          <Link href="/create/step-1-kb">
            <Button className="bg-slate-800 hover:bg-slate-700">
              <Plus className="w-4 h-4 mr-2" />
              Create New Demo
            </Button>
          </Link>
        </div>

        {/* Demos Grid */}
        {demos.length === 0 ? (
          <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Video className="w-8 h-8 text-slate-400" />
              </div>
              <h4 className="text-xl font-semibold text-slate-800 mb-2">No demos yet</h4>
              <p className="text-slate-600 mb-6 max-w-md mx-auto">
                Get started by creating your first AI-powered demo. Upload your knowledge base and videos to begin.
              </p>
              <Link href="/create/step-1-kb">
                <Button className="bg-slate-800 hover:bg-slate-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Demo
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {demos.map((demo) => (
              <Card key={demo.id} className="shadow-lg border-0 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg text-slate-800 mb-2">
                        {demo.title}
                      </CardTitle>
                      <Badge className={getStatusColor(demo.status)}>
                        {demo.status.charAt(0).toUpperCase() + demo.status.slice(1)}
                      </Badge>
                    </div>
                    <div className="relative delete-dropdown">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setShowDeleteConfirm(showDeleteConfirm === demo.id ? null : demo.id)}
                        disabled={deletingDemo === demo.id}
                      >
                        {deletingDemo === demo.id ? (
                          <div className="w-4 h-4 border border-slate-400 border-t-slate-600 rounded-full animate-spin"></div>
                        ) : (
                          <MoreVertical className="w-4 h-4" />
                        )}
                      </Button>
                      
                      {/* Delete Confirmation Dropdown */}
                      {showDeleteConfirm === demo.id && (
                        <div className="absolute right-0 top-8 z-10 bg-white border border-slate-200 rounded-lg shadow-lg p-3 min-w-[200px]">
                          <div className="space-y-3">
                            <div className="flex items-center space-x-2 text-amber-600">
                              <AlertTriangle className="w-4 h-4" />
                              <span className="text-sm font-medium">Delete Demo?</span>
                            </div>
                            <p className="text-xs text-slate-600">
                              This action cannot be undone. All associated files and data will be permanently deleted.
                            </p>
                            {demo.status !== 'draft' && (
                              <p className="text-xs text-red-600 font-medium">
                                Only draft demos can be deleted.
                              </p>
                            )}
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowDeleteConfirm(null)}
                                className="flex-1 text-xs"
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleDeleteDemo(demo.id)}
                                disabled={deletingDemo === demo.id || demo.status !== 'draft'}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {deletingDemo === demo.id ? (
                                  <div className="flex items-center space-x-1">
                                    <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span>Deleting...</span>
                                  </div>
                                ) : (
                                  <>
                                    <Trash2 className="w-3 h-3 mr-1" />
                                    Delete
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Demo Stats */}
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <div className="flex items-center space-x-1">
                        <Video className="w-4 h-4" />
                        <span>{demo.videos?.[0]?.count || 0} videos</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <FileText className="w-4 h-4" />
                        <span>{demo.knowledge_base_chunks?.[0]?.count || 0} KB chunks</span>
                      </div>
                    </div>

                    {/* Knowledge Base */}
                    {demo.knowledge_base_filename && (
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-xs text-slate-500 mb-1">Knowledge Base</p>
                        <p className="text-sm font-medium text-slate-700 truncate">
                          {demo.knowledge_base_filename}
                        </p>
                      </div>
                    )}

                    {/* Dates */}
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>Created {formatDate(demo.created_at)}</span>
                      </div>
                      <span>Updated {formatDate(demo.updated_at)}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-2 pt-2">
                      {demo.status === 'draft' ? (
                        <Link href={`/create/step-1-kb?demoId=${demo.id}`} className="flex-1">
                          <Button variant="outline" className="w-full">
                            <Settings className="w-4 h-4 mr-2" />
                            Continue
                          </Button>
                        </Link>
                      ) : demo.status === 'published' ? (
                        <Link href={`/demo/${demo.id}`} className="flex-1" target="_blank">
                          <Button variant="outline" className="w-full">
                            <Eye className="w-4 h-4 mr-2" />
                            Preview
                          </Button>
                        </Link>
                      ) : (
                        <Button variant="outline" className="flex-1" disabled>
                          <Play className="w-4 h-4 mr-2" />
                          Processing...
                        </Button>
                      )}
                      
                      {demo.status === 'published' && (
                        <Button variant="outline" size="sm">
                          <Share className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}