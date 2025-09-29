/**
 * API Service for AutoEval
 * API Service for AutoEval
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
  job_name?: string;
  status: string;
  total_students: number;
  processed_students: number;
  current_file?: string;
  current_roll?: string;
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
  id: string;
  name?: string;
  status: string;
  total_files: number;
  processed_files: number;
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
  private authToken: string | null = null;

  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  private getAuthHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  private async makeRequest(url: string, options: RequestInit = {}): Promise<any> {
    const defaultHeaders = this.getAuthHeaders();

    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  async get(url: string): Promise<any> {
    return this.makeRequest(url, { method: 'GET' });
  }

  async post(url: string, data?: any): Promise<any> {
    return this.makeRequest(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete(url: string): Promise<any> {
    return this.makeRequest(url, { method: 'DELETE' });
  }

  async checkHealth() {
    try {
      // Create a timeout controller for the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(`${API_BASE_URL}/health`, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('Health check request timed out');
        throw new Error('Request timed out');
      }
      console.error('Health check failed:', error);
      throw error;
    }
  }

  async getPublicStats() {
    try {
      // Create a timeout controller for the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(`${API_BASE_URL}/public/stats`, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('Public stats request timed out');
        throw new Error('Request timed out');
      }
      console.error('Public stats check failed:', error);
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
      formData.append('model_csv', modelAnswer);
      formData.append('student_sheets', studentSheets);
      formData.append('job_name', jobName);

      const headers: HeadersInit = {};
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/upload/evaluation`, {
        method: 'POST',
        headers,
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
  }  async uploadIndividualImages(
    modelAnswer: File,
    studentImages: File[],
    jobName: string
  ): Promise<UploadResponse> {
    try {
      const formData = new FormData();
      formData.append('model_csv', modelAnswer);
      studentImages.forEach((file) => {
        formData.append('student_images', file);
      });
      formData.append('job_name', jobName);

      const headers: HeadersInit = {};
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const response = await fetch(`${API_BASE_URL}/upload/individual`, {
        method: 'POST',
        headers,
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
    return this.get(`/evaluation/${jobId}/status`);
  }

  async getResults(jobId: string): Promise<EvaluationResults> {
    return this.get(`/results/${jobId}`);
  }

  async searchJobs(query?: string): Promise<JobSearchResponse> {
    const url = query
      ? `/jobs/search?q=${encodeURIComponent(query)}`
      : `/jobs/search`;

    return this.get(url);
  }

  async getAllEvaluations(limit: number = 20): Promise<JobSearchResponse> {
    return this.get(`/jobs/search?limit=${limit}`);
  }

  async getDashboardStats(): Promise<DashboardStats> {
    return this.get('/dashboard/stats');
  }

  async getRecentEvaluations(limit: number = 10): Promise<RecentEvaluation[]> {
    const data = await this.get(`/dashboard/recent?limit=${limit}`);
    return data.recent_jobs || [];
  }

  async deleteJob(jobId: string): Promise<void> {
    await this.delete(`/jobs/${jobId}`);
  }

  async getJobSuggestions(limit: number = 10): Promise<JobSuggestionsResponse> {
    return this.get(`/jobs/suggestions?limit=${limit}`);
  }

  // Admin-only methods
  async getAdminUsers(): Promise<any[]> {
    return this.get('/admin/users');
  }

  async getAdminStats(): Promise<any> {
    return this.get('/admin/stats');
  }

  async manageUser(userId: number, action: string, newRole?: string): Promise<void> {
    const payload: any = {
      user_id: userId,
      action: action
    };

    if (newRole) {
      payload.new_role = newRole;
    }

    return this.post('/admin/users/manage', payload);
  }

  async deleteUser(userId: number): Promise<void> {
    return this.delete(`/admin/users/${userId}`);
  }
}

export const apiService = new ApiService();
