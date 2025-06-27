"""API Data Models for Grading"""
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class StudentAnswer(BaseModel):
    sn: int
    answer: str

class StudentResult(BaseModel):
    roll_number: str
    answers: List[StudentAnswer]
    score: int
    total_questions: int
    percentage: float
    status: str = "completed"

class JobStatus(BaseModel):
    job_id: str
    status: str
    total_students: int
    processed_students: int
    created_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

class EvaluationResults(BaseModel):
    job_id: str
    job_name: str
    status: str
    model_answers: List[StudentAnswer]
    student_results: List[StudentResult]
    summary: Dict[str, Any]
    created_at: datetime
    completed_at: Optional[datetime] = None

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    gpu_available: bool
    timestamp: datetime

class UploadResponse(BaseModel):
    job_id: str
    message: str
    status: str
    model_answer_received: bool
    student_sheets_count: int
