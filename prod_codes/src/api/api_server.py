"""
AutoEval API server — Automatic Evaluation of Handwritten True/False Answer Sheets
"""

import os
import uuid
import tempfile
import asyncio
import pandas as pd
import json
import traceback
import re
from datetime import datetime
from typing import Dict, List, Optional
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import torch
import uvicorn
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from utils.autoeval_ocr import load_model_and_tokenizer, run_internvl_ocr, post_process_response
from models.api_models import (
    HealthResponse, UploadResponse, JobStatus,
    EvaluationResults, StudentResult, StudentAnswer,
    User, LoginRequest, LoginResponse, UserManagementRequest, AdminStats
)
from utils.api_utils import (
    extract_zip_file, extract_roll_number_from_filename,
    validate_image_file, validate_csv_file, parse_ocr_response, compare_answers,
    calculate_score, create_summary_stats, cleanup_temp_files, parse_csv_model_answers
)
from database.database import (
    init_database, save_evaluation_job, update_job_progress,
    update_job_progress_with_file,
    complete_evaluation_job, save_student_evaluation,
    get_evaluation_job, get_student_evaluations, get_all_evaluation_jobs,
    get_dashboard_statistics, get_recent_evaluations, delete_evaluation_job,
    get_or_create_user, get_user_by_id, get_all_users, update_user_role, toggle_user_status,
    delete_user_and_data
)


app = FastAPI(
    title="AutoEval API",
    description="Automatic Evaluation of Handwritten True/False Answer Sheets",
    version="1.0.0"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = None
tokenizer = None

UPLOAD_DIR = "temp_uploads"
MAX_FILE_SIZE = 100 * 1024 * 1024
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif'}

# Google JWT verification
import jwt
from jwt import PyJWTError
import requests

def verify_google_token(token: str) -> dict:
    """Verify Google JWT token and return user info"""

    # For development/testing purposes - bypass verification for test tokens
    if token == "test_admin_token":
        return {
            'email': 'admin@test.com',
            'name': 'Test Admin',
            'picture': '',
            'sub': 'test_admin_id',
            'role': 'admin'
        }
    elif token == "test_user_token":
        return {
            'email': 'user@test.com',
            'name': 'Test User',
            'picture': '',
            'sub': 'test_user_id',
            'role': 'user'
        }

    try:
        # Use Google's built-in verification for real tokens
        CLIENT_ID = "785901153005-4igf1m6v4cptnl6utaml3bivga1f1ovq.apps.googleusercontent.com"

        # Verify the token
        idinfo = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            CLIENT_ID
        )

        # Verify the issuer
        if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
            raise ValueError('Wrong issuer.')

        return idinfo

    except Exception as e:
        print(f"Token verification failed: {e}")
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

# Authentication middleware
from typing import Optional

async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Get current user from Authorization header"""
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Authorization header required")

    token = authorization.split(' ')[1]
    user_info = verify_google_token(token)

    # Get or create user in database
    user = await get_or_create_user(
        email=user_info['email'],
        name=user_info['name'],
        picture=user_info.get('picture'),
        role=user_info.get('role', 'user')
    )

    return user

async def get_admin_user(current_user: dict = Depends(get_current_user)) -> dict:
    """Ensure current user is admin"""
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
def fix_json_response(response_text: str) -> str:
    """Fix common JSON formatting issues in InternVL responses."""
    cleaned = response_text.strip()
    lines = cleaned.split('\n')
    valid_entries = []
    for line in lines:
        line = line.strip()
        if not line or line in ['[', ']', ',']:
            continue
        if '"sn":' in line and '"answer":' in line:
            answer_match = re.search(r'"answer":\s*"([^"]*)"', line)
            if answer_match:
                answer = answer_match.group(1)
                valid_entries.append(answer)
        elif '"sn":' in line:
            parts = line.split('"sn":')
            if len(parts) > 1:
                remainder = parts[1].strip()
                answer_match = re.search(r'[,s]*\d+[,s]*"?([^",}\s]+)"?', remainder)
                if answer_match:
                    answer = answer_match.group(1).lower().strip()
                    if answer in ['true', 'false', 't', 'f', 'na']:
                        valid_entries.append(answer)
                    else:
                        valid_entries.append('na')
                else:
                    valid_entries.append('na')
    while len(valid_entries) < 10:
        valid_entries.append('na')
    valid_entries = valid_entries[:10]
    json_entries = [f'  {{"sn": {i}, "answer": "{answer}"}}' for i, answer in enumerate(valid_entries, 1)]
    result = '[\n' + ',\n'.join(json_entries) + '\n]'
    return result
    return result

def run_ocr_with_global_model(image_path: str):
    """Run OCR using the globally loaded InternVL model (avoids reloading)."""
    global model, tokenizer
    if model is None or tokenizer is None:
        print("❌ Model not loaded in global context")
        return None
    try:
        from utils.internvl import load_image, load_prompt
        from utils.autoeval_ocr import post_process_response
        prompt = load_prompt()
        question = "<image>\n" + prompt
        pixel_values = load_image(image_path, max_num=12).to(torch.bfloat16).cuda()
        generation_config = dict(
            max_new_tokens=1024,
            do_sample=True,
            eos_token_id=151645,
            pad_token_id=151645
        )
        response = model.chat(tokenizer, pixel_values, question, generation_config)
        cleaned_response = post_process_response(response)
        fixed_response = fix_json_response(cleaned_response)
        try:
            parsed_data = json.loads(fixed_response)
            df = pd.DataFrame(parsed_data)
            return df
        except json.JSONDecodeError as e:
            print(f"Failed to parse JSON: {e}")
            print(f"Raw response: {response}")
            print(f"Cleaned response: {cleaned_response}")
            print(f"Fixed response: {fixed_response}")
            return None
    except Exception as e:
        print(f"❌ Error in OCR processing: {e}")
        traceback.print_exc()
        return None

@app.on_event("startup")
async def startup_event():
    """Initialize the InternVL model and database on startup"""
    global model, tokenizer

    try:
        # Initialize database
        await init_database()
        print("✅ Database initialized successfully!")

        print("Loading InternVL model...")
        model, tokenizer = load_model_and_tokenizer()
        print("✅ Model loaded successfully!")

        # Create upload directory
        os.makedirs(UPLOAD_DIR, exist_ok=True)

    except Exception as e:
        print(f"❌ Error during startup: {e}")
        # gotta exit here in production

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    global model, tokenizer

    if model is not None:
        del model
        torch.cuda.empty_cache()

    print("🔄 Server shutdown complete")

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check API health and model status"""
    return HealthResponse(
        status="healthy" if model is not None else "model_not_loaded",
        model_loaded=model is not None,
        gpu_available=torch.cuda.is_available(),
        timestamp=datetime.now()
    )

# Authentication endpoints
@app.post("/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """Login with Google credential"""
    try:
        user_info = verify_google_token(request.credential)

        # Get or create user in database
        user = await get_or_create_user(
            email=user_info['email'],
            name=user_info['name'],
            picture=user_info.get('picture'),
            role=user_info.get('role', 'user')
        )

        return LoginResponse(
            user=User(**user),
            message="Login successful"
        )

    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

@app.get("/auth/me", response_model=User)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user information"""
    return User(**current_user)

# Admin endpoints
@app.get("/admin/users", response_model=List[User])
async def get_all_users_admin(admin_user: dict = Depends(get_admin_user)):
    """Get all users (admin only)"""
    users = await get_all_users()
    return [User(**user) for user in users]

@app.get("/admin/stats", response_model=AdminStats)
async def get_admin_stats(admin_user: dict = Depends(get_admin_user)):
    """Get admin dashboard statistics"""
    # Get all users
    users = await get_all_users()

    # Get all jobs for stats
    all_jobs = await get_all_evaluation_jobs(user_role="admin")

    # Calculate stats
    total_users = len(users)
    active_users = len([u for u in users if u['is_active']])
    total_evaluations = len(all_jobs)

    # Count evaluations today
    today = datetime.now().date()
    evaluations_today = len([
        job for job in all_jobs
        if datetime.fromisoformat(job['created_at']).date() == today
    ])

    # Count users by role
    users_by_role = {}
    for user in users:
        role = user['role']
        users_by_role[role] = users_by_role.get(role, 0) + 1

    return AdminStats(
        total_users=total_users,
        active_users=active_users,
        total_evaluations=total_evaluations,
        evaluations_today=evaluations_today,
        users_by_role=users_by_role
    )

@app.post("/admin/users/manage")
async def manage_user(request: UserManagementRequest, admin_user: dict = Depends(get_admin_user)):
    """Manage user (admin only)"""
    if request.action == "toggle_status":
        success = await toggle_user_status(request.user_id)
        if success:
            return {"message": "User status updated successfully"}
        else:
            raise HTTPException(status_code=404, detail="User not found")

    elif request.action == "change_role":
        if not request.new_role or request.new_role not in ['user', 'admin']:
            raise HTTPException(status_code=400, detail="Invalid role")

        success = await update_user_role(request.user_id, request.new_role)
        if success:
            return {"message": "User role updated successfully"}
        else:
            raise HTTPException(status_code=404, detail="User not found")

    else:
        raise HTTPException(status_code=400, detail="Invalid action")

@app.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: int, admin_user: dict = Depends(get_admin_user)):
    """Delete a user and all their data (admin only)."""
    # Prevent self-deletion via API for safety
    if admin_user.get('id') == user_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account.")

    success = await delete_user_and_data(user_id)
    if success:
        return {"message": "User and all associated data deleted successfully"}
    else:
        raise HTTPException(status_code=404, detail="User not found")

@app.post("/upload/evaluation", response_model=UploadResponse)
async def upload_evaluation(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    model_csv: UploadFile = File(...),
    student_sheets: UploadFile = File(...),
    job_name: str = Form(None)
):
    """
    Upload model answer CSV and student sheets (ZIP file) for evaluation
    """
    # Validate model is loaded
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    # Validate file types
    if not validate_csv_file(model_csv.filename):
        raise HTTPException(status_code=400, detail="Model answer must be a CSV file")

    if not student_sheets.filename.lower().endswith('.zip'):
        raise HTTPException(status_code=400, detail="Student sheets must be a ZIP file")

    return await process_upload(background_tasks, model_csv, None, [student_sheets], job_name, "zip", current_user['id'])

@app.post("/upload/individual", response_model=UploadResponse)
async def upload_individual_images(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    model_csv: UploadFile = File(...),
    student_images: List[UploadFile] = File(...),
    job_name: str = Form(None)
):
    """
    Upload model answer CSV and individual student images for evaluation
    """
    # Validate model is loaded
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    # Validate file types
    if not validate_csv_file(model_csv.filename):
        raise HTTPException(status_code=400, detail="Model answer must be a CSV file")

    # Validate all student images
    for img in student_images:
        if not validate_image_file(img.filename):
            raise HTTPException(status_code=400, detail=f"All student files must be images: {img.filename}")

    if len(student_images) == 0:
        raise HTTPException(status_code=400, detail="At least one student image is required")

    if len(student_images) > 50:  # Reasonable limit
        raise HTTPException(status_code=400, detail="Maximum 50 student images allowed")

    return await process_upload(background_tasks, model_csv, student_images, None, job_name, "individual", current_user['id'])

async def process_upload(
    background_tasks: BackgroundTasks,
    model_csv: UploadFile,
    student_images: List[UploadFile] = None,
    student_zip: List[UploadFile] = None,
    job_name: str = "",
    upload_type: str = "zip",
    user_id: int = None
):
    """
    Common upload processing for both ZIP and individual image uploads
    """
    # Generate unique job ID
    job_id = str(uuid.uuid4())

    # Create temporary directory for this job
    job_temp_dir = os.path.join(UPLOAD_DIR, job_id)
    os.makedirs(job_temp_dir, exist_ok=True)

    try:
        # Save model answer CSV file
        model_csv_path = os.path.join(job_temp_dir, f"model_answers.csv")
        with open(model_csv_path, "wb") as f:
            content = await model_csv.read()
            f.write(content)

        student_files = []

        if upload_type == "zip" and student_zip:
            # Handle ZIP file upload
            zip_file = student_zip[0]  # student_zip is a list with one ZIP file
            zip_path = os.path.join(job_temp_dir, f"student_sheets_{zip_file.filename}")

            # Write ZIP file
            with open(zip_path, "wb") as f:
                content = await zip_file.read()
                f.write(content)

            # Extract ZIP and get student files
            extract_dir = os.path.join(job_temp_dir, "extracted")
            student_files = extract_zip_file(zip_path, extract_dir)

        elif upload_type == "individual" and student_images:
            # Handle individual images upload
            individual_dir = os.path.join(job_temp_dir, "individual")
            os.makedirs(individual_dir, exist_ok=True)

            for i, student_img in enumerate(student_images):
                # Save each individual image
                img_path = os.path.join(individual_dir, student_img.filename)
                with open(img_path, "wb") as f:
                    content = await student_img.read()
                    f.write(content)
                student_files.append(img_path)

        else:
            raise HTTPException(status_code=400, detail="Invalid upload configuration")

        # Save job to database
        await save_evaluation_job(job_id, job_name, len(student_files), user_id)

        # Start background processing
        background_tasks.add_task(
            process_evaluation_job,
            job_id,
            job_name,
            model_csv_path,
            student_files,
            job_temp_dir,
            upload_type
        )

        return UploadResponse(
            job_id=job_id,
            message=f"Files uploaded successfully ({upload_type}). Processing started.",
            status="pending",
            model_answer_received=True,
            student_sheets_count=len(student_files)
        )

    except Exception as e:
        # Cleanup on error
        cleanup_temp_files(job_temp_dir)
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.get("/evaluation/{job_id}/status", response_model=JobStatus)
async def get_evaluation_status(job_id: str, current_user: dict = Depends(get_current_user)):
    """Get the status of an evaluation job"""

    job = await get_evaluation_job(job_id, current_user['id'], current_user['role'])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobStatus(
        job_id=job_id,
        job_name=job.get("name"),
        status=job["status"],
        total_students=job["total_files"],
        processed_students=job["processed_files"],
        current_file=job.get("current_file"),
        current_roll=job.get("current_roll"),
        created_at=datetime.fromisoformat(job["created_at"]),
        completed_at=datetime.fromisoformat(job["completed_at"]) if job["completed_at"] else None,
        error_message=job.get("error_message")
    )

@app.get("/results/{job_id}", response_model=EvaluationResults)
async def get_evaluation_results(job_id: str, current_user: dict = Depends(get_current_user)):
    """Get the results of a completed evaluation job"""

    job = await get_evaluation_job(job_id, current_user['id'], current_user['role'])
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["status"] != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Job not completed yet. Current status: {job['status']}"
        )

    # Get student evaluations
    students = await get_student_evaluations(job_id)

    # Parse results and summary stats from job (already parsed by database layer)
    results = job.get("results", []) or []
    summary_stats = job.get("summary_stats", {}) or {}
    model_answers = job.get("model_answers", []) or []

    return EvaluationResults(
        job_id=job_id,
        job_name=job.get("name") or f"Evaluation_{job_id[:8]}",
        status=job["status"],
        model_answers=model_answers,
        student_results=results,
        summary=summary_stats,
        created_at=datetime.fromisoformat(job["created_at"]),
        completed_at=datetime.fromisoformat(job["completed_at"]) if job["completed_at"] else None
    )

@app.get("/jobs/suggestions")
async def get_job_suggestions(current_user: dict = Depends(get_current_user), limit: int = 10):
    """Get recent job suggestions for search autocomplete"""

    jobs = await get_all_evaluation_jobs(current_user['id'], current_user['role'])

    # Limit results
    jobs = jobs[:limit]

    suggestions = []
    for job in jobs:
        suggestion = {
            "job_id": job["id"],
            "job_name": job.get("name") or f"Evaluation_{job['id'][:8]}",
            "status": job["status"],
            "total_students": job["total_files"],
            "created_at": job["created_at"],
        }
        suggestions.append(suggestion)

    return {
        "suggestions": suggestions,
        "total": len(suggestions)
    }

@app.get("/jobs/search")
async def search_jobs(current_user: dict = Depends(get_current_user), query: Optional[str] = None, limit: int = 20):
    """Search for jobs by name or list all jobs"""

    # Get all jobs from database
    jobs = await get_all_evaluation_jobs(current_user['id'], current_user['role'])

    # Filter by query if provided
    if query:
        query_lower = query.lower()
        jobs = [job for job in jobs if (
            query_lower in job["id"].lower() or
            (job.get("name") and query_lower in job["name"].lower())
        )]

    # Limit results
    jobs = jobs[:limit]

    # Convert to serializable format
    jobs_list = []
    for job in jobs:
        job_dict = {
            "job_id": job["id"],
            "job_name": job.get("name") or f"Evaluation_{job['id'][:8]}",
            "status": job["status"],
            "total_students": job["total_files"],
            "processed_students": job["processed_files"],
            "created_at": job["created_at"],
            "completed_at": job["completed_at"],
        }
        jobs_list.append(job_dict)

    return {
        "query": query,
        "total_found": len(jobs_list),
        "jobs": jobs_list
    }

@app.get("/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    """Get dashboard statistics"""

    stats = await get_dashboard_statistics(current_user['id'], current_user['role'])
    return stats

@app.get("/dashboard/recent")
async def get_recent_evaluations_endpoint(current_user: dict = Depends(get_current_user), limit: int = 10):
    """Get recent evaluations for dashboard"""

    recent_jobs = await get_recent_evaluations(current_user['id'], current_user['role'], limit)
    return {"recent_jobs": recent_jobs}

async def process_evaluation_job(
    job_id: str,
    job_name: str,
    model_csv_path: str,
    student_files: List[str],
    temp_dir: str,
    upload_type: str
):
    """
    Background task to process the evaluation job
    """
    global model, tokenizer

    try:
        # Parse model answers from CSV file
        print(f"Parsing model answers from CSV for job {job_id}")
        model_answers = parse_csv_model_answers(model_csv_path)

        if not model_answers:
            await complete_evaluation_job(job_id, {}, {}, "Failed to parse model answers from CSV")
            return

        print(f"✅ Successfully parsed {len(model_answers)} model answers from CSV")

        # Process each student sheet
        student_results = []
        processed_count = 0

        for i, student_file in enumerate(student_files):
            try:
                print(f"Processing student {i+1}/{len(student_files)}: {student_file}")

                # Extract roll number from filename
                roll_number = extract_roll_number_from_filename(os.path.basename(student_file))

                # Persist CURRENT file/roll before OCR so frontend shows it immediately
                try:
                    await update_job_progress_with_file(
                        job_id,
                        processed_count,  # processed_count reflects already completed ones
                        os.path.basename(student_file),
                        roll_number
                    )
                except NameError:
                    await update_job_progress(job_id, processed_count)

                # Process student answer sheet
                student_df = run_ocr_with_global_model(student_file)

                if student_df is not None and not student_df.empty:
                    # Convert to StudentAnswer objects
                    student_answers = []
                    student_answers_dict = []
                    for _, row in student_df.iterrows():
                        answer_obj = StudentAnswer(
                            sn=int(row['sn']),
                            answer=str(row['answer'])
                        )
                        student_answers.append(answer_obj)
                        student_answers_dict.append({
                            "sn": int(row['sn']),
                            "answer": str(row['answer'])
                        })

                    # Calculate score
                    score_info = calculate_score(student_answers, model_answers)

                    # Save individual student evaluation to database
                    await save_student_evaluation(
                        job_id=job_id,
                        roll_number=roll_number,
                        filename=os.path.basename(student_file),
                        ocr_text=student_df.to_json(),
                        processed_answers=student_answers_dict,
                        total_score=float(score_info["correct"]),
                        max_possible_score=float(score_info["total"]),
                        percentage=float(score_info["percentage"])
                    )

                    # Create student result for summary
                    student_result = StudentResult(
                        roll_number=roll_number,
                        answers=student_answers,
                        score=score_info["correct"],
                        total_questions=score_info["total"],
                        percentage=score_info["percentage"],
                        status="completed"
                    )

                    student_results.append(student_result)
                    processed_count += 1

                else:
                    print(f"Failed to process student: {student_file}")

                # After successful (or attempted) processing, update processed count & keep current file/roll
                try:
                    await update_job_progress_with_file(
                        job_id,
                        processed_count,
                        os.path.basename(student_file),
                        roll_number
                    )
                except NameError:
                    await update_job_progress(job_id, processed_count)

            except Exception as e:
                print(f"Error processing student {student_file}: {e}")
                continue

        # Generate summary statistics
        summary = create_summary_stats(student_results)

        # Convert student_results to JSON-serializable format
        results_dict = []
        for result in student_results:
            results_dict.append({
                "roll_number": result.roll_number,
                "answers": [{"sn": ans.sn, "answer": ans.answer} for ans in result.answers],
                "score": result.score,
                "total_questions": result.total_questions,
                "percentage": result.percentage,
                "status": result.status
            })

        # Convert model_answers to JSON-serializable format
        model_answers_dict = []
        for ans in model_answers:
            model_answers_dict.append({
                "sn": ans.sn,
                "answer": ans.answer
            })

        # Determine final job status based on processing results
        total_files = len(student_files)
        processed_files = len(student_results)

        if processed_files == 0:
            # No students processed successfully - mark as failed
            error_message = f"Failed to process any of the {total_files} student files. Please check the file formats and try again."
            await complete_evaluation_job(job_id, results_dict, summary, model_answers_dict, error_message)
            print(f"❌ Job {job_id} failed! Processed 0/{total_files} students.")
        elif processed_files == total_files:
            # All students processed successfully - mark as completed
            await complete_evaluation_job(job_id, results_dict, summary, model_answers_dict, None)
            print(f"✅ Job {job_id} completed successfully! Processed {processed_files}/{total_files} students.")
        else:
            # Partial success - mark as completed with warning
            error_message = f"Partially completed: Successfully processed {processed_files} out of {total_files} student files. Some files may have had formatting issues."
            await complete_evaluation_job(job_id, results_dict, summary, model_answers_dict, error_message)
            print(f"⚠️ Job {job_id} partially completed! Processed {processed_files}/{total_files} students.")

    except Exception as e:
        print(f"❌ Error processing job {job_id}: {e}")
        await complete_evaluation_job(job_id, {}, {}, str(e))

    finally:
        # Cleanup temporary files after processing
        cleanup_temp_files(temp_dir)

@app.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a job and its associated data"""

    success = await delete_evaluation_job(job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found")

    # Also cleanup files
    job_dir = Path(UPLOAD_DIR) / job_id
    if job_dir.exists():
        cleanup_temp_files(job_dir)

    return {"message": f"Job {job_id} deleted successfully"}

if __name__ == "__main__":
    # Create upload directory if it doesn't exist
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # Run the server
    uvicorn.run(
        "api_server:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
