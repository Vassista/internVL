/**
 * API Service for Grade Genius
 * Handles communication with FastAPI backend
 */

const API_BASE_URL = 'http://localhost:8000'; // Change this for production



export interface StudentAnswer {
  sn: number;
  answer: string;
}

export interface StudentResult {
  roll_number: string;
  answers: StudentAnswer[];
  score: number;
  total_questions: number;
  percentage: number;
  status: string;
}

export interface EvaluationResults {
  job_id: string;
  job_name: string;
  status: string;
  model_answers: StudentAnswer[];
  student_results: StudentResult[];
  summary: {
    total_students: number;
    average_score: number;
    highest_score: number;
    lowest_score: number;
    pass_rate: number;
    grade_distribution: {
      [key: string]: number;
    };
  };
  created_at: string;
  completed_at?: string;
}

export interface JobSearchResult {
  job_id: string;
  job_name: string;
  status: string;
  total_students: number;
  processed_students: number;
  created_at: string;
  completed_at?: string;
}

export interface JobSearchResponse {
  query: string | null;
  total_found: number;
  jobs: JobSearchResult[];
}

export interface JobStatus {
  job_id: string;
  status: string;
  total_students: number;
  processed_students: number;
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

export interface DashboardStats {
  total_evaluations: number;
  pending_evaluations: number;
  completed_evaluations: number;
  failed_evaluations: number;
  total_students_processed: number;
  average_score: number;
}

export interface RecentEvaluation {
  job_id: string;
  job_name: string;
  roll_number: string;
  score: number;
  total_questions: number;
  percentage: number;
  status: string;
  created_at: string;
  completed_at?: string;
}

export interface UploadResponse {
  job_id: string;
  message: string;
  status: string;
  model_answer_received: boolean;
  student_sheets_count: number;
}

export interface JobSuggestion {
  job_id: string;
  job_name: string;
  status: string;
  total_students: number;
  created_at: string;
}

export interface JobSuggestionsResponse {
  suggestions: JobSuggestion[];
  total: number;
}

class ApiService {
  async checkHealth() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      return await response.json();
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  }

  async uploadEvaluation(
    modelAnswer: File,
    studentSheets: File,
    jobName: string
  ): Promise<UploadResponse> {
    try {
      const formData = new FormData();
      formData.append('model_answer', modelAnswer);
      formData.append('student_sheets', studentSheets);
      formData.append('job_name', jobName);

      const response = await fetch(`${API_BASE_URL}/upload/evaluation`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Upload failed: ${error}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  }

  async uploadIndividualImages(
    modelAnswer: File,
    studentImages: File[],
    jobName: string
  ): Promise<UploadResponse> {
    try {
      const formData = new FormData();
      formData.append('model_answer', modelAnswer);
      studentImages.forEach((file) => {
        formData.append('student_images', file);
      });
      formData.append('job_name', jobName);

      const response = await fetch(`${API_BASE_URL}/upload/individual`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Upload failed: ${error}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  }

  async getJobStatus(jobId: string): Promise<JobStatus> {
    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

    const response = await fetch(`${API_BASE_URL}/evaluation/${jobId}/status`, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to get job status: ${response.statusText}`);
    }

    return await response.json();
  }

  async getResults(jobId: string): Promise<EvaluationResults> {
    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

    const response = await fetch(`${API_BASE_URL}/results/${jobId}`, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to get results: ${response.statusText}`);
    }

    return await response.json();
  }

  async searchJobs(query?: string): Promise<JobSearchResponse> {
    const url = query
      ? `${API_BASE_URL}/jobs/search?q=${encodeURIComponent(query)}`
      : `${API_BASE_URL}/jobs/search`;

    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // Increased to 8 seconds for better UX when server is busy

    try {
      const response = await fetch(url, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Handle server busy/timeout gracefully
        if (response.status === 503 || response.status === 504) {
          throw new Error('Server is currently busy processing evaluations. Please try again in a moment.');
        }
        throw new Error(`Failed to search jobs: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Search request timed out. The server may be busy with evaluations.');
      }

      throw error;
    }
  }

  async getDashboardStats(): Promise<DashboardStats> {
    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${API_BASE_URL}/dashboard/stats`, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to get dashboard stats: ${response.statusText}`);
    }

    return await response.json();
  }

  async getRecentEvaluations(limit: number = 10): Promise<RecentEvaluation[]> {
    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${API_BASE_URL}/dashboard/recent?limit=${limit}`, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to get recent evaluations: ${response.statusText}`);
    }

    return await response.json();
  }

  async deleteJob(jobId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete job: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Delete job failed:', error);
      throw error;
    }
  }

  async getJobSuggestions(limit: number = 10): Promise<JobSuggestionsResponse> {
    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    try {
      const response = await fetch(`${API_BASE_URL}/jobs/suggestions?limit=${limit}`, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Handle server busy/timeout gracefully for suggestions
        if (response.status === 503 || response.status === 504) {
          throw new Error('Server is currently busy processing evaluations.');
        }
        throw new Error(`Failed to get job suggestions: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out. The server may be busy with evaluations.');
      }

      throw error;
    }
  }
}

export const apiService = new ApiService();
