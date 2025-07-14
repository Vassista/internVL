import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, RefreshCw, CheckCircle, Clock, AlertCircle, Search, X, Trash2 } from 'lucide-react';
import { apiService, EvaluationResults, JobStatus, JobSearchResult, JobSuggestion } from '@/services/apiService';
import ResultsTableNew from '@/components/results/ResultsTableNew';

// Status badge component
const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case 'completed':
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle className="w-3 h-3 mr-1" />
          Completed
        </Badge>
      );
    case 'processing':
      return (
        <Badge variant="secondary">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Processing
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="outline">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="destructive">
          <AlertCircle className="w-3 h-3 mr-1" />
          Failed
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const Results = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Get job ID from URL parameters
  const urlJobId = searchParams.get('job_id');

  const [jobId, setJobId] = useState<string>(urlJobId || '');
  const [searchInput, setSearchInput] = useState<string>(urlJobId || '');
  const [searchSuggestions, setSearchSuggestions] = useState<JobSearchResult[]>([]);
  const [initialSuggestions, setInitialSuggestions] = useState<JobSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [searching, setSearching] = useState<boolean>(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState<boolean>(false);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [results, setResults] = useState<EvaluationResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New state for all evaluations
  const [allEvaluations, setAllEvaluations] = useState<JobSearchResult[]>([]);
  const [loadingAllEvaluations, setLoadingAllEvaluations] = useState<boolean>(false);
  const [allEvaluationsError, setAllEvaluationsError] = useState<string | null>(null);

  // Delete job state
  const [deleting, setDeleting] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);

  // Function to fetch job status and results
  const loadJobData = async (id: string) => {
    if (!id) {
      setError('No job ID provided');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Loading job data for ID:', id);

      // Fetch job status
      const status = await apiService.getJobStatus(id);
      console.log('Job status:', status);
      setJobStatus(status);

      // If completed, fetch results
      if (status.status === 'completed') {
        console.log('Job completed, fetching results...');
        const evaluationResults = await apiService.getResults(id);
        console.log('Results:', evaluationResults);
        setResults(evaluationResults);
      }
    } catch (err) {
      console.error('Error loading job data:', err);
      // Handle specific error cases
      if (err instanceof Error) {
        if (err.message.includes('404') || err.message.includes('Job not found')) {
          setError(`Job not found: No evaluation job exists with ID "${id}". Please check the job ID and try again.`);
        } else if (err.message.includes('400') || err.message.includes('not completed')) {
          setError('Job is still processing. Please wait and try again later.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to load evaluation data. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Load initial suggestions on component mount
  const loadInitialSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const response = await apiService.getJobSuggestions(10);
      setInitialSuggestions(response.suggestions);
    } catch (err) {
      console.error('Error loading initial suggestions:', err);
      // Don't show error for suggestions, just silently fail
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Load all evaluations for the user
  const loadAllEvaluations = async () => {
    setLoadingAllEvaluations(true);
    setAllEvaluationsError(null);
    try {
      const response = await apiService.getAllEvaluations(20);
      setAllEvaluations(response.jobs);
    } catch (err) {
      console.error('Error loading all evaluations:', err);
      setAllEvaluationsError(err instanceof Error ? err.message : 'Failed to load evaluations');
    } finally {
      setLoadingAllEvaluations(false);
    }
  };

  // Search for jobs by name to provide suggestions
  // Search for jobs by name to provide suggestions (with better error handling for busy server)
  const searchJobSuggestions = async (query: string) => {
    if (query.length < 2) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setSearching(true);
    try {
      const response = await apiService.searchJobs(query);
      setSearchSuggestions(response.jobs);
      setShowSuggestions(response.jobs.length > 0);
    } catch (err) {
      console.error('Error searching jobs:', err);
      setSearchSuggestions([]);
      setShowSuggestions(false);

      // Don't show search errors unless it's a connection issue
      // This prevents overwhelming users when the model is busy
      if (err instanceof Error && err.message.includes('Failed to fetch')) {
        console.warn('Search temporarily unavailable - server may be busy with evaluations');
      }
    } finally {
      setSearching(false);
    }
  };

  // Handle input change with debounced search
  const handleSearchInputChange = (value: string) => {
    setSearchInput(value);

    // Clear error when user starts typing
    if (error) {
      setError(null);
    }

    // If input looks like a job ID (UUID format), don't show suggestions
    const isUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

    if (!isUuidPattern && value.length >= 2) {
      // Debounce search for job names
      const timeoutId = setTimeout(() => {
        searchJobSuggestions(value);
      }, 300);

      return () => clearTimeout(timeoutId);
    } else {
      setShowSuggestions(false);
      setSearchSuggestions([]);
      setSearching(false);
    }
  };

  // Handle suggestion selection (works for both search results and initial suggestions)
  const handleSuggestionSelect = (suggestion: JobSearchResult | JobSuggestion) => {
    setSearchInput(suggestion.job_name);
    setJobId(suggestion.job_id);
    setShowSuggestions(false);
    // Update URL and load data
    navigate(`/results?job_id=${encodeURIComponent(suggestion.job_id)}`);
    loadJobData(suggestion.job_id);
  };

  // Load data when component mounts or jobId changes
  useEffect(() => {
    // Load initial suggestions on mount
    loadInitialSuggestions();

    // Load all evaluations if no specific job is being viewed
    if (!urlJobId) {
      loadAllEvaluations();
    }

    if (urlJobId) {
      setJobId(urlJobId);
      setSearchInput(urlJobId);
      loadJobData(urlJobId);
    }
  }, [urlJobId]);

  // Handle search form submission
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      const searchValue = searchInput.trim();
      setSearching(true);

      // Check if input is a job ID (UUID format) or job name
      const isUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(searchValue);

      if (isUuidPattern) {
        // Direct job ID search
        setJobId(searchValue);
        navigate(`/results?job_id=${encodeURIComponent(searchValue)}`);
        loadJobData(searchValue);
        setSearching(false);
      } else {
        // Search by job name
        try {
          const response = await apiService.searchJobs(searchValue);
          if (response.jobs.length === 1) {
            // Exact match found
            const job = response.jobs[0];
            setJobId(job.job_id);
            navigate(`/results?job_id=${encodeURIComponent(job.job_id)}`);
            loadJobData(job.job_id);
          } else if (response.jobs.length > 1) {
            // Multiple matches - show suggestions
            setSearchSuggestions(response.jobs);
            setShowSuggestions(true);
            setError(`Found ${response.jobs.length} jobs matching "${searchValue}". Please select one from the dropdown.`);
          } else {
            // No matches found
            setError(`No jobs found matching "${searchValue}". Please check the job name or try entering a job ID.`);
            setSearchSuggestions([]);
            setShowSuggestions(false);
          }
        } catch (err) {
          console.error('Error searching jobs:', err);
          if (err instanceof Error && (err.message.includes('Failed to fetch') || err.message.includes('timed out'))) {
            setError('Unable to connect to server. Please check if the API server is running.');
          } else {
            setError('Failed to search for jobs. Please try again.');
          }
          setSearchSuggestions([]);
          setShowSuggestions(false);
        } finally {
          setSearching(false);
        }
      }
    } else {
      setError('Please enter a Evaluation ID or Evaluation name');
      setSearching(false);
    }
  };

  // Clear results
  const handleClear = () => {
    setJobId('');
    setSearchInput('');
    setSearchSuggestions([]);
    setShowSuggestions(false);
    setSearching(false);
    setLoadingSuggestions(false);
    setJobStatus(null);
    setResults(null);
    setError(null);
    setLoading(false);
    // Clear URL parameters
    navigate('/results');
    // Reload all evaluations when clearing
    loadAllEvaluations();
  };

  // Poll for updates if job is still processing
  useEffect(() => {
    if (!jobStatus || (jobStatus.status !== 'processing' && jobStatus.status !== 'pending')) {
      return;
    }

    const interval = setInterval(() => {
      if (jobId) {
        loadJobData(jobId);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [jobStatus?.status, jobId]);

  // Refresh handler
  const handleRefresh = () => {
    if (jobId) {
      loadJobData(jobId);
    }
  };

  // Delete job functionality
  const handleDeleteJob = async () => {
    if (!jobId || !jobStatus) return;

    setDeleting(true);
    try {
      await apiService.deleteJob(jobId);

      // Clear current job data
      setJobId('');
      setSearchInput('');
      setJobStatus(null);
      setResults(null);
      setError(null);

      // Clear URL parameters
      navigate('/results');

      // Reload all evaluations
      loadAllEvaluations();

      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Error deleting job:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete job');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  // Render loading state
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mr-2" />
          <span>Loading evaluation results...</span>
        </div>
      </div>
    );
  }

  // Render main results UI
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Evaluation Results</h1>
          <p className="text-gray-600 mt-1">Search for evaluation results by job ID</p>
        </div>
        <div className="flex items-center gap-4">
          {jobStatus && <StatusBadge status={jobStatus.status} />}
          {jobId && (
            <>
              <Button onClick={handleRefresh} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button
                onClick={handleDeleteClick}
                variant="destructive"
                size="sm"
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Search Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search Results</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1 relative">
              <Input
                type="text"
                placeholder="Enter Evaluation ID or name (e.g., 'Math Exam 2024' or '6129becb-22a2-481d-bc0e-10aaddbea718')"
                value={searchInput}
                onChange={(e) => handleSearchInputChange(e.target.value)}
                onFocus={() => {
                  // Show initial suggestions when focused if no search results
                  if (searchSuggestions.length === 0 && initialSuggestions.length > 0 && !searchInput) {
                    setShowSuggestions(true);
                  } else if (searchSuggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                onBlur={() => {
                  // Delay hiding suggestions to allow for clicks
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                className="w-full"
              />

              {/* Search Suggestions Dropdown */}
              {showSuggestions && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {/* Show search results if available */}
                  {searchSuggestions.length > 0 ? (
                    searchSuggestions.map((suggestion) => (
                      <div
                        key={suggestion.job_id}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                        onClick={() => handleSuggestionSelect(suggestion)}
                      >
                        <div className="font-medium text-sm">{suggestion.job_name}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          <StatusBadge status={suggestion.status} />
                          <span>{suggestion.total_students} students</span>
                          <span>{new Date(suggestion.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    /* Show initial suggestions if no search results */
                    initialSuggestions.length > 0 && !searchInput && (
                      <>
                        <div className="px-4 py-2 text-xs text-gray-500 font-medium bg-gray-50 border-b">
                          Recent Jobs
                        </div>
                        {initialSuggestions.map((suggestion) => (
                          <div
                            key={suggestion.job_id}
                            className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                            onClick={() => handleSuggestionSelect(suggestion)}
                          >
                            <div className="font-medium text-sm">{suggestion.job_name}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-2">
                              <StatusBadge status={suggestion.status} />
                              <span>{suggestion.total_students} students</span>
                              <span>{new Date(suggestion.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </>
                    )
                  )}

                  {/* Loading state for suggestions */}
                  {loadingSuggestions && (
                    <div className="px-4 py-3 text-center text-xs text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                      Loading suggestions...
                    </div>
                  )}
                </div>
              )}
            </div>
            <Button type="submit" disabled={loading || searching}>
              <Search className="h-4 w-4 mr-2" />
              {searching ? 'Searching...' : 'Search'}
            </Button>
            {(jobId || searchInput) && (
              <Button type="button" variant="outline" onClick={handleClear}>
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            )}
          </form>

          {/* Search Progress Bar */}
          {searching && (
            <div className="mt-4">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Searching for jobs...</span>
              </div>
              <Progress value={undefined} className="w-full h-2" />
            </div>
          )}

          {error && !loading && !searching && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* All Evaluations or No Results Message */}
      {!jobId && !loading && !searching && (
        <Card>
          <CardContent className="pt-6">
            {loadingAllEvaluations ? (
              <div className="text-center py-8">
                <Loader2 className="h-12 w-12 text-gray-400 mx-auto mb-4 animate-spin" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Loading evaluations...</h3>
                <p className="text-gray-600">Please wait while we fetch your evaluations</p>
              </div>
            ) : allEvaluationsError ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading evaluations</h3>
                <p className="text-gray-600 mb-4">{allEvaluationsError}</p>
                <Button onClick={loadAllEvaluations} variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </div>
            ) : allEvaluations.length === 0 ? (
              <div className="text-center py-8">
                <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No evaluations found</h3>
                <p className="text-gray-600">You haven't created any evaluations yet. Upload answer sheets to get started.</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-medium text-gray-900">Your Evaluations</h3>
                  <Button onClick={loadAllEvaluations} variant="outline" size="sm">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>
                <div className="space-y-3">
                  {allEvaluations.map((evaluation) => (
                    <div
                      key={evaluation.job_id}
                      className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => {
                        setJobId(evaluation.job_id);
                        setSearchInput(evaluation.job_id);
                        navigate(`/results?job_id=${encodeURIComponent(evaluation.job_id)}`);
                        loadJobData(evaluation.job_id);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-medium text-gray-900">{evaluation.job_name}</h4>
                            <StatusBadge status={evaluation.status} />
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>
                              Students: {evaluation.processed_students} / {evaluation.total_students}
                            </span>
                            <span>
                              Created: {new Date(evaluation.created_at).toLocaleDateString()}
                            </span>
                            {evaluation.completed_at && (
                              <span>
                                Completed: {new Date(evaluation.completed_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500 mb-1">Job ID</div>
                          <div className="text-xs font-mono text-gray-700">
                            {evaluation.job_id.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}


      {/* Results Section */}
      {results && results.status === 'completed' && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{results.summary?.total_students || 0}</div>
                <p className="text-xs text-muted-foreground">Total Students</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{results.summary?.average_score || 0}%</div>
                <p className="text-xs text-muted-foreground">Average Score</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{results.summary?.highest_score || 0}%</div>
                <p className="text-xs text-muted-foreground">Highest Score</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{results.summary?.lowest_score || 0}%</div>
                <p className="text-xs text-muted-foreground">Lowest Score</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{(results.summary?.pass_rate || 0).toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">Pass Rate</p>
              </CardContent>
            </Card>
          </div>

          {/* Results Table */}
          <Card>
            <CardHeader>
              <CardTitle>Student Results</CardTitle>
            </CardHeader>
            <CardContent>
              <ResultsTableNew results={results.student_results} />
            </CardContent>
          </Card>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Evaluation Job</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this evaluation job? This action cannot be undone.
              {jobStatus && (
                <div className="mt-3 p-3 bg-gray-50 rounded-md">
                  <div className="text-sm font-medium">Job Details:</div>
                  <div className="text-sm text-gray-600 mt-1">
                    <div>Name: {jobStatus.job_name || 'Unnamed Job'}</div>
                    <div>ID: {jobStatus.job_id}</div>
                    <div>Status: {jobStatus.status}</div>
                    <div>Students: {jobStatus.total_students}</div>
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteJob}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Job
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Results;
