"""
Database models and connection for InternVL API using SQLite
"""
import asyncio
from datetime import datetime
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, DateTime, Text, Float, Integer, JSON
import json
import os

# Database configuration
DATABASE_URL = "sqlite+aiosqlite:///./internvl_evaluations.db"

# Create async engine
engine = create_async_engine(DATABASE_URL, echo=False)

# Create async session factory
async_session = async_sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

class EvaluationJob(Base):
    __tablename__ = "evaluation_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    status: Mapped[str] = mapped_column(String(20), default="processing")
    total_files: Mapped[int] = mapped_column(Integer, default=0)
    processed_files: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Store results as JSON
    results: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    summary_stats: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

class StudentEvaluation(Base):
    __tablename__ = "student_evaluations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(String(36), index=True)
    roll_number: Mapped[str] = mapped_column(String(50))
    filename: Mapped[str] = mapped_column(String(255))

    # OCR and processing results
    ocr_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    processed_answers: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON

    # Scoring
    total_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    max_possible_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    percentage: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Timestamps
    processed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

# Database utility functions
async def init_database():
    """Initialize the database tables"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_db_session() -> AsyncSession:
    """Get a database session"""
    async with async_session() as session:
        return session

async def save_evaluation_job(job_id: str, total_files: int) -> None:
    """Save a new evaluation job"""
    async with async_session() as session:
        job = EvaluationJob(
            id=job_id,
            status="processing",
            total_files=total_files,
            processed_files=0
        )
        session.add(job)
        await session.commit()

async def update_job_progress(job_id: str, processed_files: int) -> None:
    """Update job progress"""
    async with async_session() as session:
        job = await session.get(EvaluationJob, job_id)
        if job:
            job.processed_files = processed_files
            await session.commit()

async def complete_evaluation_job(
    job_id: str,
    results: dict,
    summary_stats: dict,
    error_message: Optional[str] = None
) -> None:
    """Mark a job as completed and save results"""
    async with async_session() as session:
        job = await session.get(EvaluationJob, job_id)
        if job:
            job.status = "completed" if error_message is None else "failed"
            job.completed_at = datetime.utcnow()
            job.results = json.dumps(results) if results else None
            job.summary_stats = json.dumps(summary_stats) if summary_stats else None
            job.error_message = error_message
            await session.commit()

async def save_student_evaluation(
    job_id: str,
    roll_number: str,
    filename: str,
    ocr_text: str,
    processed_answers: dict,
    total_score: float,
    max_possible_score: float,
    percentage: float
) -> None:
    """Save individual student evaluation results"""
    async with async_session() as session:
        evaluation = StudentEvaluation(
            job_id=job_id,
            roll_number=roll_number,
            filename=filename,
            ocr_text=ocr_text,
            processed_answers=json.dumps(processed_answers),
            total_score=total_score,
            max_possible_score=max_possible_score,
            percentage=percentage
        )
        session.add(evaluation)
        await session.commit()

async def get_evaluation_job(job_id: str) -> Optional[dict]:
    """Get evaluation job by ID"""
    async with async_session() as session:
        job = await session.get(EvaluationJob, job_id)
        if job:
            return {
                "id": job.id,
                "status": job.status,
                "total_files": job.total_files,
                "processed_files": job.processed_files,
                "created_at": job.created_at.isoformat(),
                "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                "error_message": job.error_message,
                "results": json.loads(job.results) if job.results else None,
                "summary_stats": json.loads(job.summary_stats) if job.summary_stats else None
            }
        return None

async def get_student_evaluations(job_id: str) -> List[dict]:
    """Get all student evaluations for a job"""
    async with async_session() as session:
        from sqlalchemy import select
        result = await session.execute(
            select(StudentEvaluation).where(StudentEvaluation.job_id == job_id)
        )
        evaluations = result.scalars().all()

        return [
            {
                "id": eval.id,
                "roll_number": eval.roll_number,
                "filename": eval.filename,
                "ocr_text": eval.ocr_text,
                "processed_answers": json.loads(eval.processed_answers) if eval.processed_answers else None,
                "total_score": eval.total_score,
                "max_possible_score": eval.max_possible_score,
                "percentage": eval.percentage,
                "processed_at": eval.processed_at.isoformat()
            }
            for eval in evaluations
        ]

async def get_all_evaluation_jobs() -> List[dict]:
    """Get all evaluation jobs ordered by creation date"""
    async with async_session() as session:
        from sqlalchemy import select
        result = await session.execute(
            select(EvaluationJob).order_by(EvaluationJob.created_at.desc())
        )
        jobs = result.scalars().all()

        return [
            {
                "id": job.id,
                "status": job.status,
                "total_files": job.total_files,
                "processed_files": job.processed_files,
                "created_at": job.created_at.isoformat(),
                "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                "error_message": job.error_message,
                "results": json.loads(job.results) if job.results else None,
                "summary_stats": json.loads(job.summary_stats) if job.summary_stats else None
            }
            for job in jobs
        ]

async def get_dashboard_statistics() -> dict:
    """Get dashboard statistics"""
    async with async_session() as session:
        from sqlalchemy import select, func

        # Get total jobs
        total_jobs_result = await session.execute(
            select(func.count(EvaluationJob.id))
        )
        total_jobs = total_jobs_result.scalar()

        # Get completed jobs
        completed_jobs_result = await session.execute(
            select(func.count(EvaluationJob.id)).where(EvaluationJob.status == "completed")
        )
        completed_jobs = completed_jobs_result.scalar()

        # Get failed jobs
        failed_jobs_result = await session.execute(
            select(func.count(EvaluationJob.id)).where(EvaluationJob.status == "failed")
        )
        failed_jobs = failed_jobs_result.scalar()

        # Get total students evaluated
        total_students_result = await session.execute(
            select(func.count(StudentEvaluation.id))
        )
        total_students = total_students_result.scalar()

        # Get average score
        avg_score_result = await session.execute(
            select(func.avg(StudentEvaluation.percentage))
        )
        avg_score = avg_score_result.scalar() or 0

        return {
            "total_evaluations": total_jobs or 0,
            "completed_evaluations": completed_jobs or 0,
            "failed_evaluations": failed_jobs or 0,
            "pending_evaluations": (total_jobs or 0) - (completed_jobs or 0) - (failed_jobs or 0),
            "total_students_processed": total_students or 0,
            "average_score": round(avg_score, 2) if avg_score else 0
        }

async def get_recent_evaluations(limit: int = 10) -> List[dict]:
    """Get recent evaluations"""
    async with async_session() as session:
        from sqlalchemy import select
        result = await session.execute(
            select(EvaluationJob)
            .order_by(EvaluationJob.created_at.desc())
            .limit(limit)
        )
        jobs = result.scalars().all()

        return [
            {
                "id": job.id,
                "status": job.status,
                "total_files": job.total_files,
                "processed_files": job.processed_files,
                "created_at": job.created_at.isoformat(),
                "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                "error_message": job.error_message
            }
            for job in jobs
        ]

async def delete_evaluation_job(job_id: str) -> bool:
    """Delete an evaluation job and its associated student evaluations"""
    async with async_session() as session:
        from sqlalchemy import select

        # Delete student evaluations first
        student_evals_result = await session.execute(
            select(StudentEvaluation).where(StudentEvaluation.job_id == job_id)
        )
        student_evals = student_evals_result.scalars().all()

        for eval in student_evals:
            await session.delete(eval)

        # Delete the job
        job = await session.get(EvaluationJob, job_id)
        if job:
            await session.delete(job)
            await session.commit()
            return True

        return False
