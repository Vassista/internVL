
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { apiService, EvaluationResults, JobStatus } from '@/services/apiService';
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

  // Get job ID from URL parameters
  const jobId = searchParams.get('job_id');

  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [results, setResults] = useState<EvaluationResults | null>(null);
  const [loading, setLoading] = useState(true);
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
      setError(err instanceof Error ? err.message : 'Failed to load evaluation data');
    } finally {
      setLoading(false);
    }
  };

  // Load data when component mounts or jobId changes
  useEffect(() => {
    if (jobId) {
      loadJobData(jobId);
    } else {
      setLoading(false);
      setError('No job ID provided');
    }
  }, [jobId]);

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

  // Render error state
  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={handleRefresh} className="mt-4" variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
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
          {results && (
            <p className="text-gray-600 mt-1">{results.job_name}</p>
          )}
        </div>
        <div className="flex items-center gap-4">
          {jobStatus && <StatusBadge status={jobStatus.status} />}
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Job Status Card */}
      {jobStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Processing Status</CardTitle>
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
