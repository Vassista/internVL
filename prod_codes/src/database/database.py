"""
Database models and connection for InternVL API using PostgreSQL
"""
import asyncio
from datetime import datetime
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, DateTime, Text, Float, Integer, JSON, delete
import json
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://vassista:vassista@localhost/internvl_db")

# Create async engine
engine = create_async_engine(DATABASE_URL, echo=False)

# Create async session factory
async_session = async_sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    picture: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    role: Mapped[str] = mapped_column(String(20), default="user")  # 'user' or 'admin'
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Integer, default=1)

class EvaluationJob(Base):
    __tablename__ = "evaluation_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True)  # Link to user
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="processing")
    total_files: Mapped[int] = mapped_column(Integer, default=0)
    processed_files: Mapped[int] = mapped_column(Integer, default=0)
    # Currently processing file info
    current_file: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    current_roll: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Store results as JSON
    results: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    summary_stats: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    model_answers: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

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
        # Ensure newly added columns exist (lightweight migration safeguard)
        try:
            await conn.exec_driver_sql(
                "ALTER TABLE evaluation_jobs ADD COLUMN IF NOT EXISTS current_file VARCHAR(255)"
            )
            await conn.exec_driver_sql(
                "ALTER TABLE evaluation_jobs ADD COLUMN IF NOT EXISTS current_roll VARCHAR(50)"
            )
        except Exception as e:
            # Non-fatal; log to stdout (avoid raising to keep startup healthy)
            print(f"Warning: could not ensure new columns exist: {e}")

async def get_db_session() -> AsyncSession:
    """Get a database session"""
    async with async_session() as session:
        return session

async def save_evaluation_job(job_id: str, job_name: str, total_files: int, user_id: int) -> None:
    """Save a new evaluation job"""
    async with async_session() as session:
        job = EvaluationJob(
            id=job_id,
            user_id=user_id,
            name=job_name,
            status="processing",
            total_files=total_files,
            processed_files=0
        )
        session.add(job)
        await session.commit()

# User management functions
async def get_or_create_user(email: str, name: str, picture: str = None, role: str = "user", update_role: bool = False) -> dict:
    """Get existing user or create new one

    Args:
        email: User email
        name: User name
        picture: User picture URL
        role: Role for new users (ignored for existing users unless update_role=True)
        update_role: Whether to update role for existing users
    """
    async with async_session() as session:
        from sqlalchemy import select
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if user:
            # Update last login and user info
            user.last_login = datetime.utcnow()
            user.name = name  # Update name in case it changed
            if update_role:  # Only update role if explicitly requested
                user.role = role
            if picture:
                user.picture = picture
            await session.commit()

            return {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "picture": user.picture,
                "role": user.role,
                "created_at": user.created_at.isoformat(),
                "last_login": user.last_login.isoformat() if user.last_login else None,
                "is_active": bool(user.is_active)
            }
        else:
            # Create new user
            new_user = User(
                email=email,
                name=name,
                picture=picture,
                role=role,  # Use provided role
                last_login=datetime.utcnow()
            )
            session.add(new_user)
            await session.commit()
            await session.refresh(new_user)

            return {
                "id": new_user.id,
                "email": new_user.email,
                "name": new_user.name,
                "picture": new_user.picture,
                "role": new_user.role,
                "created_at": new_user.created_at.isoformat(),
                "last_login": new_user.last_login.isoformat() if new_user.last_login else None,
                "is_active": bool(new_user.is_active)
            }

async def get_user_by_id(user_id: int) -> Optional[dict]:
    """Get user by ID"""
    async with async_session() as session:
        user = await session.get(User, user_id)
        if user:
            return {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "picture": user.picture,
                "role": user.role,
                "created_at": user.created_at.isoformat(),
                "last_login": user.last_login.isoformat() if user.last_login else None,
                "is_active": bool(user.is_active)
            }
        return None

async def get_all_users() -> List[dict]:
    """Get all users (admin only)"""
    async with async_session() as session:
        from sqlalchemy import select
        result = await session.execute(select(User).order_by(User.created_at.desc()))
        users = result.scalars().all()

        return [
            {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "picture": user.picture,
                "role": user.role,
                "created_at": user.created_at.isoformat(),
                "last_login": user.last_login.isoformat() if user.last_login else None,
                "is_active": bool(user.is_active)
            }
            for user in users
        ]

async def update_user_role(user_id: int, role: str) -> bool:
    """Update user role (admin only)"""
    async with async_session() as session:
        user = await session.get(User, user_id)
        if user:
            user.role = role
            await session.commit()
            return True
        return False

async def toggle_user_status(user_id: int) -> bool:
    """Toggle user active status (admin only)"""
    async with async_session() as session:
        user = await session.get(User, user_id)
        if user:
            user.is_active = not user.is_active
            await session.commit()
            return True
        return False

async def delete_user_and_data(user_id: int) -> bool:
    """Delete a user and all of their associated data (jobs, student evaluations)."""
    async with async_session() as session:
        from sqlalchemy import select

        # Ensure user exists
        user = await session.get(User, user_id)
        if not user:
            return False

        # Get all job ids for the user
        result = await session.execute(
            select(EvaluationJob.id).where(EvaluationJob.user_id == user_id)
        )
        job_ids = [row[0] for row in result.all()]

        # Delete student evaluations for those jobs
        if job_ids:
            await session.execute(
                delete(StudentEvaluation).where(StudentEvaluation.job_id.in_(job_ids))
            )

            # Delete the jobs themselves
            await session.execute(
                delete(EvaluationJob).where(EvaluationJob.id.in_(job_ids))
            )

        # Finally delete the user
        await session.delete(user)
        await session.commit()
        return True

async def update_job_progress(job_id: str, processed_files: int) -> None:
    """Update job progress"""
    async with async_session() as session:
        job = await session.get(EvaluationJob, job_id)
        if job:
            job.processed_files = processed_files
            await session.commit()

async def update_job_progress_with_file(job_id: str, processed_files: int, current_file: Optional[str] = None, current_roll: Optional[str] = None) -> None:
    """Update job progress and current file/roll being processed"""
    async with async_session() as session:
        job = await session.get(EvaluationJob, job_id)
        if job:
            job.processed_files = processed_files
            if current_file is not None:
                job.current_file = current_file
            if current_roll is not None:
                job.current_roll = current_roll
            await session.commit()

async def complete_evaluation_job(
    job_id: str,
    results: dict,
    summary_stats: dict,
    model_answers: list = None,
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
            job.model_answers = json.dumps(model_answers) if model_answers else None
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

async def get_evaluation_job(job_id: str, user_id: int = None, user_role: str = "user") -> Optional[dict]:
    """Get evaluation job by ID"""
    async with async_session() as session:
        job = await session.get(EvaluationJob, job_id)
        if job:
            # Check if user has access to this job
            if user_role != "admin" and user_id and job.user_id != user_id:
                return None  # User can only access their own jobs unless they're admin
            # Parse JSON fields safely
            results = None
            if job.results:
                try:
                    results = json.loads(job.results)
                except json.JSONDecodeError:
                    results = None

            summary_stats = None
            if job.summary_stats:
                try:
                    summary_stats = json.loads(job.summary_stats)
                except json.JSONDecodeError:
                    summary_stats = None

            model_answers = None
            if job.model_answers:
                try:
                    model_answers = json.loads(job.model_answers)
                except json.JSONDecodeError:
                    model_answers = None

            return {
                "id": job.id,
                "name": job.name,
                "status": job.status,
                "total_files": job.total_files,
                "processed_files": job.processed_files,
                "current_file": job.current_file,
                "current_roll": job.current_roll,
                "created_at": job.created_at.isoformat(),
                "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                "error_message": job.error_message,
                "results": results,
                "summary_stats": summary_stats,
                "model_answers": model_answers
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

async def get_all_evaluation_jobs(user_id: int = None, user_role: str = "user") -> List[dict]:
    """Get all evaluation jobs, filtered by user for regular users"""
    async with async_session() as session:
        from sqlalchemy import select

        if user_role == "admin":
            # Admins can see all jobs
            result = await session.execute(
                select(EvaluationJob).order_by(EvaluationJob.created_at.desc())
            )
        else:
            # Regular users can only see their own jobs
            result = await session.execute(
                select(EvaluationJob)
                .where(EvaluationJob.user_id == user_id)
                .order_by(EvaluationJob.created_at.desc())
            )

        jobs = result.scalars().all()

        return [
            {
                "id": job.id,
                "user_id": job.user_id,
                "name": job.name,
                "status": job.status,
                "total_files": job.total_files,
                "processed_files": job.processed_files,
                "current_file": job.current_file,
                "current_roll": job.current_roll,
                "created_at": job.created_at.isoformat(),
                "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                "error_message": job.error_message,
                "results": json.loads(job.results) if job.results else None,
                "summary_stats": json.loads(job.summary_stats) if job.summary_stats else None
            }
            for job in jobs
        ]

async def get_dashboard_statistics(user_id: int = None, user_role: str = "user") -> dict:
    """Get dashboard statistics"""
    async with async_session() as session:
        from sqlalchemy import select, func, and_

        # Build base query with user filtering
        base_query = select(func.count(EvaluationJob.id))
        if user_role != "admin" and user_id:
            base_query = base_query.where(EvaluationJob.user_id == user_id)

        # Get total jobs
        total_jobs_result = await session.execute(base_query)
        total_jobs = total_jobs_result.scalar()

        # Get completed jobs
        completed_query = select(func.count(EvaluationJob.id)).where(EvaluationJob.status == "completed")
        if user_role != "admin" and user_id:
            completed_query = completed_query.where(EvaluationJob.user_id == user_id)
        completed_jobs_result = await session.execute(completed_query)
        completed_jobs = completed_jobs_result.scalar()

        # Get failed jobs
        failed_query = select(func.count(EvaluationJob.id)).where(EvaluationJob.status == "failed")
        if user_role != "admin" and user_id:
            failed_query = failed_query.where(EvaluationJob.user_id == user_id)
        failed_jobs_result = await session.execute(failed_query)
        failed_jobs = failed_jobs_result.scalar()

        # Get total students evaluated (join with jobs to filter by user)
        students_query = select(func.count(StudentEvaluation.id))
        if user_role != "admin" and user_id:
            students_query = students_query.join(EvaluationJob, StudentEvaluation.job_id == EvaluationJob.id).where(EvaluationJob.user_id == user_id)
        total_students_result = await session.execute(students_query)
        total_students = total_students_result.scalar()

        # Get average score
        avg_query = select(func.avg(StudentEvaluation.percentage))
        if user_role != "admin" and user_id:
            avg_query = avg_query.join(EvaluationJob, StudentEvaluation.job_id == EvaluationJob.id).where(EvaluationJob.user_id == user_id)
        avg_score_result = await session.execute(avg_query)
        avg_score = avg_score_result.scalar() or 0

        return {
            "total_evaluations": total_jobs or 0,
            "completed_evaluations": completed_jobs or 0,
            "failed_evaluations": failed_jobs or 0,
            "pending_evaluations": (total_jobs or 0) - (completed_jobs or 0) - (failed_jobs or 0),
            "total_students_processed": total_students or 0,
            "average_score": round(avg_score, 2) if avg_score else 0
        }

async def get_recent_evaluations(user_id: int = None, user_role: str = "user", limit: int = 10) -> List[dict]:
    """Get recent evaluations"""
    async with async_session() as session:
        from sqlalchemy import select

        query = select(EvaluationJob).order_by(EvaluationJob.created_at.desc()).limit(limit)
        if user_role != "admin" and user_id:
            query = query.where(EvaluationJob.user_id == user_id)

        result = await session.execute(query)
        jobs = result.scalars().all()

        return [
            {
                "id": job.id,
                "name": job.name,
                "status": job.status,
                "total_files": job.total_files,
                "processed_files": job.processed_files,
                "current_file": job.current_file,
                "current_roll": job.current_roll,
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
