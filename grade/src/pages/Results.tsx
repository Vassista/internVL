import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, RefreshCw, CheckCircle, Clock, AlertCircle, Search, X } from 'lucide-react';
import { apiService, EvaluationResults, JobStatus, JobSearchResult } from '@/services/apiService';
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
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [searching, setSearching] = useState<boolean>(false);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [results, setResults] = useState<EvaluationResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Search for jobs by name to provide suggestions
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

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: JobSearchResult) => {
    setSearchInput(suggestion.job_name);
    setJobId(suggestion.job_id);
    setShowSuggestions(false);
    // Update URL and load data
    navigate(`/results?job_id=${encodeURIComponent(suggestion.job_id)}`);
    loadJobData(suggestion.job_id);
  };

  // Load data when component mounts or jobId changes
  useEffect(() => {
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
          setError('Failed to search for jobs. Please try again.');
          setSearchSuggestions([]);
          setShowSuggestions(false);
        } finally {
          setSearching(false);
        }
      }
    } else {
      setError('Please enter a job ID or job name');
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
    setJobStatus(null);
    setResults(null);
    setError(null);
    setLoading(false);
    // Clear URL parameters
    navigate('/results');
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
            <Button onClick={handleRefresh} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
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
                placeholder="Enter job ID or job name (e.g., 'Math Exam 2024' or '6129becb-22a2-481d-bc0e-10aaddbea718')"
                value={searchInput}
                onChange={(e) => handleSearchInputChange(e.target.value)}
                onFocus={() => {
                  if (searchSuggestions.length > 0) {
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
              {showSuggestions && searchSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {searchSuggestions.map((suggestion) => (
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

      {/* No Results Message */}
      {!jobId && !loading && !searching && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No evaluation searched</h3>
              <p className="text-gray-600">Enter a job ID or job name above to view evaluation results</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Job Status Card */}
      {jobStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Processing Status
              {results?.job_name && (
                <span className="text-base font-normal text-gray-600 ml-2">- {results.job_name}</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-500">Status</div>
                <div className="font-medium">
                  <StatusBadge status={jobStatus.status} />
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Progress</div>
                <div className="font-medium">
                  {jobStatus.processed_students} / {jobStatus.total_students} students
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Started</div>
                <div className="font-medium text-sm">
                  {new Date(jobStatus.created_at).toLocaleString()}
                </div>
              </div>
              {jobStatus.completed_at && (
                <div>
                  <div className="text-sm text-gray-500">Completed</div>
                  <div className="font-medium text-sm">
                    {new Date(jobStatus.completed_at).toLocaleString()}
                  </div>
                </div>
              )}
            </div>

            {jobStatus.error_message && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>{jobStatus.error_message}</AlertDescription>
              </Alert>
            )}

            {(jobStatus.status === 'processing' || jobStatus.status === 'pending') && (
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${(jobStatus.processed_students / jobStatus.total_students) * 100}%`
                    }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Processing student answer sheets... This may take several minutes.
                </p>
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
                <div className="text-2xl font-bold">{results.summary.total_students}</div>
                <p className="text-xs text-muted-foreground">Total Students</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{results.summary.average_score}%</div>
                <p className="text-xs text-muted-foreground">Average Score</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{results.summary.highest_score}%</div>
                <p className="text-xs text-muted-foreground">Highest Score</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{results.summary.lowest_score}%</div>
                <p className="text-xs text-muted-foreground">Lowest Score</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{results.summary.pass_rate.toFixed(1)}%</div>
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
    </div>
  );
};

export default Results;
