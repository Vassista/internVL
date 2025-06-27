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

  async getJobStatus(jobId: string): Promise<JobStatus> {
    try {
      const response = await fetch(`${API_BASE_URL}/evaluation/${jobId}/status`);

      if (!response.ok) {
        throw new Error(`Failed to get job status: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get job status failed:', error);
      throw error;
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
      console.error('Get results failed:', error);
      throw error;
    }
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
