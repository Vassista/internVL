/**
 * API Service for Grade Genius
 * Handles communication with FastAPI backend
 */

const API_BASE_URL = 'http://localhost:8000'; // Change this for production

// Mock data for testing when API server is not available
const MOCK_JOBS: JobSearchResult[] = [
  {
    job_id: '6129becb-22a2-481d-bc0e-10aaddbea718',
    job_name: 'Math Exam 2024 - Final',
    status: 'completed',
    total_students: 25,
    processed_students: 25,
    created_at: '2024-12-15T10:30:00Z',
    completed_at: '2024-12-15T11:45:00Z'
  },
  {
    job_id: 'a8f3d2c1-5678-4321-9abc-def123456789',
    job_name: 'Physics Test - Chapter 5',
    status: 'completed',
    total_students: 18,
    processed_students: 18,
    created_at: '2024-12-10T14:20:00Z',
    completed_at: '2024-12-10T15:30:00Z'
  },
  {
    job_id: 'b2e4f6a8-9012-3456-7890-abcdef123456',
    job_name: 'Chemistry Lab Quiz',
    status: 'processing',
    total_students: 20,
    processed_students: 12,
    created_at: '2024-12-20T09:15:00Z'
  },
  {
    job_id: 'c3f5a7b9-1234-5678-9012-3456789abcde',
    job_name: 'Biology Midterm Exam',
    status: 'completed',
    total_students: 30,
    processed_students: 30,
    created_at: '2024-12-01T11:00:00Z',
    completed_at: '2024-12-01T12:30:00Z'
  },
  {
    job_id: 'd4g6b8c0-2345-6789-0123-456789abcdef',
    job_name: 'History Essay Evaluation',
    status: 'failed',
    total_students: 15,
    processed_students: 8,
    created_at: '2024-11-25T16:45:00Z'
  }
];

const MOCK_JOB_STATUS: { [key: string]: JobStatus } = {
  '6129becb-22a2-481d-bc0e-10aaddbea718': {
    job_id: '6129becb-22a2-481d-bc0e-10aaddbea718',
    status: 'completed',
    total_students: 25,
    processed_students: 25,
    created_at: '2024-12-15T10:30:00Z',
    completed_at: '2024-12-15T11:45:00Z'
  },
  'a8f3d2c1-5678-4321-9abc-def123456789': {
    job_id: 'a8f3d2c1-5678-4321-9abc-def123456789',
    status: 'completed',
    total_students: 18,
    processed_students: 18,
    created_at: '2024-12-10T14:20:00Z',
    completed_at: '2024-12-10T15:30:00Z'
  },
  'b2e4f6a8-9012-3456-7890-abcdef123456': {
    job_id: 'b2e4f6a8-9012-3456-7890-abcdef123456',
    status: 'processing',
    total_students: 20,
    processed_students: 12,
    created_at: '2024-12-20T09:15:00Z'
  }
};

const MOCK_RESULTS: { [key: string]: EvaluationResults } = {
  '6129becb-22a2-481d-bc0e-10aaddbea718': {
    job_id: '6129becb-22a2-481d-bc0e-10aaddbea718',
    job_name: 'Math Exam 2024 - Final',
    status: 'completed',
    model_answers: [
      { sn: 1, answer: '42' },
      { sn: 2, answer: 'x = 5' },
      { sn: 3, answer: 'Area = πr²' }
    ],
    student_results: [
      {
        roll_number: 'S001',
        answers: [
          { sn: 1, answer: '42' },
          { sn: 2, answer: 'x = 5' },
          { sn: 3, answer: 'Area = π × r²' }
        ],
        score: 2.5,
        total_questions: 3,
        percentage: 83.33,
        status: 'completed'
      },
      {
        roll_number: 'S002',
        answers: [
          { sn: 1, answer: '40' },
          { sn: 2, answer: 'x = 4' },
          { sn: 3, answer: 'Area = πr²' }
        ],
        score: 1,
        total_questions: 3,
        percentage: 33.33,
        status: 'completed'
      }
    ],
    summary: {
      total_students: 25,
      average_score: 75.5,
      highest_score: 95,
      lowest_score: 45,
      pass_rate: 84.0,
      grade_distribution: {
        'A': 8,
        'B': 12,
        'C': 3,
        'D': 1,
        'F': 1
      }
    },
    created_at: '2024-12-15T10:30:00Z',
    completed_at: '2024-12-15T11:45:00Z'
  }
};

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

export interface UploadResponse {
  job_id: string;
  message: string;
  status: string;
  model_answer_received: boolean;
  student_sheets_count: number;
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
    try {
      const response = await fetch(`${API_BASE_URL}/evaluation/${jobId}/status`);

      if (!response.ok) {
        throw new Error(`Failed to get job status: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.warn('API server not available, using mock data:', error);

      // Use mock data when API is not available
      const mockStatus = MOCK_JOB_STATUS[jobId];
      if (mockStatus) {
        return mockStatus;
      } else {
        throw new Error('Job not found');
      }
    }
  }

  async getResults(jobId: string): Promise<EvaluationResults> {
    try {
      const response = await fetch(`${API_BASE_URL}/results/${jobId}`);

      if (!response.ok) {
        throw new Error(`Failed to get results: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.warn('API server not available, using mock data:', error);

      // Use mock data when API is not available
      const mockResults = MOCK_RESULTS[jobId];
      if (mockResults) {
        return mockResults;
      } else {
        throw new Error('Results not found');
      }
    }
  }

  async searchJobs(query?: string): Promise<JobSearchResponse> {
    try {
      const url = query
        ? `${API_BASE_URL}/jobs/search?query=${encodeURIComponent(query)}`
        : `${API_BASE_URL}/jobs/search`;

      // Create an AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

      const response = await fetch(url, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to search jobs: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.warn('API server not available, using mock data:', error);

      // Use mock data when API is not available
      return this.searchMockJobs(query);
    }
  }

  private searchMockJobs(query?: string): JobSearchResponse {
    let filteredJobs = [...MOCK_JOBS];

    if (query) {
      const lowerQuery = query.toLowerCase();
      filteredJobs = MOCK_JOBS.filter(job =>
        job.job_name.toLowerCase().includes(lowerQuery) ||
        job.job_id.toLowerCase().includes(lowerQuery)
      );
    }

    // Sort by creation date (newest first)
    filteredJobs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      query: query || null,
      total_found: filteredJobs.length,
      jobs: filteredJobs
    };
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
}

export const apiService = new ApiService();
